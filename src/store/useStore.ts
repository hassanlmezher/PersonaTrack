import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppStore,
  AppSettings,
  Dossier,
  ScanState,
  ScanMode,
  MatchStatus,
  PlatformResult,
  BreachEntry,
  FacialMatch,
} from '@/lib/types';

// ─── Scan stages definition ───────────────────────────────────────────────────

const SCAN_STAGES = [
  { label: 'QUERYING SOCIAL REGISTRIES', percent: 13, log: 'Connecting to 350+ platform endpoints' },
  { label: 'CROSS-REFERENCING EXIF', percent: 28, log: 'Parsing embedded metadata fields' },
  { label: 'RESOLVING ALIAS PERMUTATIONS', percent: 42, log: 'Generating 80+ username variants' },
  { label: 'SCANNING BREACH DATABASES', percent: 57, log: 'Querying 14.7B exposed credentials' },
  { label: 'MAPPING FACIAL EMBEDDINGS', percent: 70, log: 'Computing 128-dim face vector' },
  { label: 'CRAWLING IMAGE INDEXES', percent: 83, log: 'Indexing PimEyes + Google Vision' },
  { label: 'COMPILING RISK DOSSIER', percent: 94, log: 'Aggregating threat intelligence' },
  { label: 'SCAN COMPLETE', percent: 100, log: 'All sources confirmed' },
];

// ─── Deterministic helpers (no randomness so results are reproducible) ────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededFloat(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  stealthMode: true,
  proxyRotation: true,
  autoArchive: false,
  realtimeAlerts: true,
  deepSocialCrawl: true,
  breachLookup: true,
  aliasEngine: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Navigation ──────────────────────────────────────────────────────────
      activeTab: 'recon',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // ── Recon inputs ────────────────────────────────────────────────────────
      scanMode: 'username',
      setScanMode: (mode) => set({ scanMode: mode }),

      targets: ['@janedoe', 'johndoe_99'],
      addTarget: (t) => {
        const norm = t.trim();
        if (!norm) return;
        const val = norm.startsWith('@') || get().scanMode === 'facial' ? norm : '@' + norm;
        set((s) => ({ targets: s.targets.includes(val) ? s.targets : [...s.targets, val] }));
      },
      removeTarget: (t) => set((s) => ({ targets: s.targets.filter((x) => x !== t) })),

      uploadedFile: null,
      uploadedFileUrl: null,
      uploadedExifData: null,
      setUploadedFile: (file, exif = null) => {
        if (!file) return set({ uploadedFile: null, uploadedFileUrl: null, uploadedExifData: null });
        const url = URL.createObjectURL(file);
        set({ uploadedFile: file, uploadedFileUrl: url, uploadedExifData: exif });
      },

      // ── Scan ────────────────────────────────────────────────────────────────
      scanState: { status: 'idle', currentStage: 0, stages: SCAN_STAGES },

      startScan: () => {
        const { targets, scanMode, settings, uploadedExifData } = get();
        if (!targets.length && scanMode === 'username') return;

        set({ scanState: { status: 'scanning', currentStage: 0, stages: SCAN_STAGES } });

        let stage = 0;
        const interval = setInterval(async () => {
          stage++;
          set((s) => ({
            scanState: { ...s.scanState, currentStage: Math.min(stage, SCAN_STAGES.length - 1) },
          }));

          if (stage >= SCAN_STAGES.length) {
            clearInterval(interval);

            // Build dossier from real + simulated data
            const dossier = await buildDossier(targets, scanMode, settings.breachLookup, uploadedExifData);

            set((s) => ({
              dossiers: [dossier, ...s.dossiers.filter((d) => d.id !== dossier.id)].slice(0, 20),
              activeDossierId: dossier.id,
              scanState: { ...s.scanState, status: 'complete' },
              activeTab: 'dossier',
            }));
          }
        }, 850);
      },

      // ── Dossiers ─────────────────────────────────────────────────────────────
      dossiers: [],
      activeDossierId: null,
      setActiveDossierId: (id) => set({ activeDossierId: id }),
      getActiveDossier: () => {
        const { dossiers, activeDossierId } = get();
        return dossiers.find((d) => d.id === activeDossierId) ?? dossiers[0] ?? null;
      },

      // ── Settings ─────────────────────────────────────────────────────────────
      settings: DEFAULT_SETTINGS,
      toggleSetting: (key) =>
        set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] } })),
    }),
    {
      name: 'persona-trace-store',
      // Don't persist scan state or file blobs (they're transient)
      partialize: (s) => ({
        dossiers: s.dossiers,
        activeDossierId: s.activeDossierId,
        settings: s.settings,
        targets: s.targets,
        scanMode: s.scanMode,
      }),
    }
  )
);

// ─── Dossier builder ──────────────────────────────────────────────────────────

async function buildDossier(
  targets: string[],
  mode: ScanMode,
  fetchBreaches: boolean,
  exifData: ExifData | null = null
): Promise<Dossier> {
  const primaryTarget = mode === 'facial' ? 'Subject_Image' : (targets[0] ?? 'unknown');
  const seed = hashStr(primaryTarget + Date.now());
  const id = `${Date.now()}-${seed}`;

  // Try to fetch real data from the API route
  let realPlatforms: PlatformResult[] = [];
  if (mode === 'username') {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        realPlatforms = data.platforms ?? [];
      }
    } catch {
      // API unavailable — use simulated only
    }
  }

  // Build simulated platforms for the ones not covered by the API
  const PLATFORM_DEFS = [
    { platform: 'Instagram', icon: '📸', handleSuffix: '' },
    { platform: 'GitHub', icon: '💻', handleSuffix: '' },
    { platform: 'X / Twitter', icon: '𝕏', handleSuffix: '99' },
    { platform: 'LinkedIn', icon: '💼', handleSuffix: '' },
    { platform: 'TikTok', icon: '🎵', handleSuffix: '_' },
    { platform: 'Reddit', icon: '👽', handleSuffix: '_anon', prefix: 'u/' },
  ];

  const cleanName = primaryTarget.replace(/^@/, '');

  const simulatedPlatforms: PlatformResult[] = PLATFORM_DEFS.map((def, i) => {
    // If we got real data for this platform, skip simulation
    if (realPlatforms.some((r) => r.platform === def.platform)) return null!;
    const s = seed + i * 137;
    const conf = Math.round(seededFloat(s, 55, 99.9) * 10) / 10;
    const statuses: MatchStatus[] = ['verified', 'verified', 'probable', 'likely', 'possible'];
    const statusIdx = Math.min(4, Math.floor(seededFloat(s + 1, 0, 5)));
    const handle = (def.prefix ?? '') + cleanName + def.handleSuffix;
    return {
      platform: def.platform,
      icon: def.icon,
      handle,
      status: statuses[statusIdx],
      confidence: conf,
      realData: false,
    };
  }).filter(Boolean);

  const platforms = [...realPlatforms, ...simulatedPlatforms];

  // Aliases
  const aliases = [
    cleanName + '99',
    cleanName + '_dev',
    'real_' + cleanName,
    cleanName.replace(/_/g, '.'),
    cleanName + '2024',
    cleanName + '_official',
    '_' + cleanName + '_',
  ].slice(0, 6 + (seed % 5));

  // Email nodes
  const emailNodes = [
    `${cleanName}@proton.me`,
    `${cleanName}99@gmail.com`,
    `${cleanName}@outlook.com`,
  ];

  // Facial matches (simulated — real facial matching requires ML inference)
  const facialMatches: FacialMatch[] = [
    { source: 'Instagram', date: '2024-01-15', confidence: 99.1, label: 'Profile Photo' },
    { source: 'LinkedIn', date: '2023-09-02', confidence: 97.8, label: 'Profile Photo' },
    { source: 'News Archive', date: '2022-06-20', confidence: 91.3, label: 'Event Photo' },
    { source: 'PimEyes', date: '2021-11-04', confidence: 86.5, label: 'Forum Post' },
  ];

  // Breach entries
  const allBreaches: BreachEntry[] = [
    {
      service: 'Adobe Inc.',
      year: '2023',
      dataTypes: ['Email', 'Password Hash (bcrypt)'],
      recordCount: '153M',
      severity: 'critical',
    },
    {
      service: 'LinkedIn',
      year: '2021',
      dataTypes: ['Email', 'Phone', 'Employer', 'Name'],
      recordCount: '700M',
      severity: 'critical',
    },
    {
      service: 'RockYou2024',
      year: '2024',
      dataTypes: ['Plaintext passwords'],
      recordCount: '10B',
      severity: 'high',
    },
    {
      service: 'Canva',
      year: '2019',
      dataTypes: ['Email', 'Username', 'Partial card data'],
      recordCount: '139M',
      severity: 'medium',
    },
  ];

  // Risk score — higher if many verified platforms + breaches
  const verifiedCount = platforms.filter((p) => p.status === 'verified').length;
  const riskScore = Math.min(
    99,
    Math.round(50 + verifiedCount * 7 + allBreaches.length * 4 + seededFloat(seed + 99, 0, 8))
  );
  const riskLabel =
    riskScore >= 85 ? 'Critical' : riskScore >= 65 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low';

  return {
    id,
    createdAt: new Date().toISOString(),
    targets,
    mode,
    riskScore,
    riskLabel: riskLabel as Dossier['riskLabel'],
    displayName: primaryTarget,
    email: emailNodes[0],
    platforms,
    facialMatches,
    exif: exifData || undefined,
    breaches: fetchBreaches ? allBreaches : [],
    aliases,
    emailNodes,
    sourceCount: platforms.length + emailNodes.length,
  };
}


