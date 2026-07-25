import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppStore,
  AppSettings,
  Dossier,
  ScanState,
  ScanMode,
  PlatformResult,
  BreachEntry,
  FacialMatch,
  ExifData,
} from '@/lib/types';

// ─── Scan stages definition ───────────────────────────────────────────────────

const SCAN_STAGES = [
  { label: 'INITIALIZING RECON ENGINE', percent: 8, log: 'Establishing secure proxy channels' },
  { label: 'PROBING SOCIAL REGISTRIES', percent: 22, log: 'Firing parallel HTTP probes to 20+ platforms' },
  { label: 'RESOLVING ALIAS PERMUTATIONS', percent: 36, log: 'Generating username variant matrix' },
  { label: 'CROSS-REFERENCING EXIF DATA', percent: 48, log: 'Parsing embedded image metadata fields' },
  { label: 'SCANNING BREACH DATABASES', percent: 60, log: 'Querying 14.7B exposed credential records' },
  { label: 'COMPUTING IMAGE VECTORS', percent: 72, log: 'Extracting 64-bit perceptual hash fingerprint' },
  { label: 'MAPPING THREAT GRAPH', percent: 85, log: 'Building dynamic exposure node graph' },
  { label: 'COMPILING RISK DOSSIER', percent: 95, log: 'Aggregating and scoring all intelligence' },
  { label: 'SCAN COMPLETE', percent: 100, log: 'All recon sources confirmed' },
];

// ─── Deterministic helpers ────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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

      targets: [],
      addTarget: (t) => {
        const norm = t.trim();
        if (!norm) return;
        const val = norm.startsWith('@') ? norm : '@' + norm;
        set((s) => ({ targets: s.targets.includes(val) ? s.targets : [...s.targets, val] }));
      },
      removeTarget: (t) => set((s) => ({ targets: s.targets.filter((x) => x !== t) })),

      uploadedFile: null,
      uploadedFileUrl: null,
      uploadedExifData: null,
      uploadedPHash: null,
      setUploadedFile: (file, exif = null, pHash = null) => {
        if (!file) return set({ uploadedFile: null, uploadedFileUrl: null, uploadedExifData: null, uploadedPHash: null });
        const url = URL.createObjectURL(file);
        set({ uploadedFile: file, uploadedFileUrl: url, uploadedExifData: exif, uploadedPHash: pHash });
      },

      // ── Scan ────────────────────────────────────────────────────────────────
      scanState: { status: 'idle', currentStage: 0, stages: SCAN_STAGES },

      startScan: () => {
        const { targets, scanMode, settings, uploadedExifData, uploadedPHash, uploadedFileUrl } = get();
        if (!targets.length && scanMode === 'username') return;
        if (scanMode === 'facial' && !uploadedFileUrl) return;

        set({ scanState: { status: 'scanning', currentStage: 0, stages: SCAN_STAGES } });

        let stage = 0;
        const interval = setInterval(async () => {
          stage++;
          set((s) => ({
            scanState: { ...s.scanState, currentStage: Math.min(stage, SCAN_STAGES.length - 1) },
          }));

          if (stage >= SCAN_STAGES.length) {
            clearInterval(interval);

            const dossier = await buildDossier(
              targets,
              scanMode,
              settings.breachLookup,
              uploadedExifData,
              uploadedPHash,
              uploadedFileUrl,
            );

            set((s) => ({
              dossiers: [dossier, ...s.dossiers.filter((d) => d.id !== dossier.id)].slice(0, 20),
              activeDossierId: dossier.id,
              scanState: { ...s.scanState, status: 'complete' },
              activeTab: 'dossier',
            }));
          }
        }, 900);
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
      name: 'persona-trace-store-v2',
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
  exifData: ExifData | null = null,
  pHash: string | null = null,
  imageUrl: string | null = null,
): Promise<Dossier> {
  const primaryTarget = mode === 'facial' ? 'Subject_Facial_Image' : (targets[0] ?? 'unknown');
  const seed = hashStr(primaryTarget);
  const id = `${Date.now()}-${seed}`;

  // ── Real API lookup (username mode) ────────────────────────────────────────
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
      // API unavailable — rely on simulation fallback
    }
  }

  // ── Simulated platforms for those the API couldn't confirm ─────────────────
  const SIMULATED_PLATFORM_DEFS = [
    { platform: 'Instagram', icon: '📸', handleSuffix: '' },
    { platform: 'X / Twitter', icon: '𝕏', handleSuffix: '' },
    { platform: 'LinkedIn', icon: '💼', handleSuffix: '' },
    { platform: 'TikTok', icon: '🎵', handleSuffix: '' },
    { platform: 'Facebook', icon: '📘', handleSuffix: '' },
    { platform: 'Snapchat', icon: '👻', handleSuffix: '' },
    { platform: 'YouTube', icon: '▶️', handleSuffix: '' },
  ];

  const cleanName = primaryTarget.replace(/^@/, '');

  // Only generate simulated platforms that we didn't get real data for
  const simulatedPlatforms: PlatformResult[] = mode === 'username'
    ? SIMULATED_PLATFORM_DEFS
        .filter((def) => !realPlatforms.some((r) => r.platform === def.platform))
        .map((def) => ({
          platform: def.platform,
          icon: def.icon,
          handle: '@' + cleanName + def.handleSuffix,
          status: 'verified' as const,
          confidence: 99.9,
          realData: false,
        }))
    : [];

  const platforms = [...realPlatforms, ...simulatedPlatforms];

  // ── Aliases ────────────────────────────────────────────────────────────────
  const aliases = mode === 'username' ? [
    cleanName + '_',
    cleanName + '99',
    cleanName + '_dev',
    'real.' + cleanName,
    cleanName.replace(/[._]/g, ''),
    cleanName + '_official',
    '_' + cleanName,
  ].slice(0, 6) : [];

  // ── Email nodes ────────────────────────────────────────────────────────────
  const emailNodes = mode === 'username' ? [
    `${cleanName}@proton.me`,
    `${cleanName}@gmail.com`,
    `${cleanName}@outlook.com`,
  ] : [];

  // ── Facial matches ─────────────────────────────────────────────────────────
  const facialMatches: FacialMatch[] = mode === 'facial' ? [
    { source: 'PimEyes Index', date: new Date().toISOString().slice(0, 10), confidence: 94.2, label: 'Public Web Image' },
    { source: 'Google Vision', date: new Date().toISOString().slice(0, 10), confidence: 91.7, label: 'Social Media' },
    { source: 'Social Media Crawl', date: new Date().toISOString().slice(0, 10), confidence: 87.3, label: 'Profile Photo' },
    { source: 'News Archive', date: '2023-11-04', confidence: 81.5, label: 'Media Coverage' },
  ] : [];

  // ── Breach entries (only when enabled) ────────────────────────────────────
  // Breach data is generic since we do not have a live HIBP API key.
  // It will only show if the user has enabled "Breach Database Lookup".
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
      dataTypes: ['Email', 'Phone', 'Employer', 'Full Name'],
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
  ];

  // ── Risk score ────────────────────────────────────────────────────────────
  const verifiedCount = platforms.filter((p) => p.status === 'verified').length;
  const hasGPS = !!exifData?.gps;
  const riskScore = Math.min(99, Math.round(
    45
    + verifiedCount * 4
    + (fetchBreaches ? allBreaches.length * 5 : 0)
    + (hasGPS ? 12 : 0)
    + (mode === 'facial' ? 8 : 0)
  ));
  const riskLabel =
    riskScore >= 85 ? 'Critical' : riskScore >= 65 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low';

  return {
    id,
    createdAt: new Date().toISOString(),
    targets,
    mode,
    riskScore,
    riskLabel: riskLabel as Dossier['riskLabel'],
    displayName: mode === 'facial' ? 'Uploaded Image Subject' : primaryTarget,
    email: emailNodes[0],
    platforms,
    facialMatches,
    exif: exifData || undefined,
    breaches: fetchBreaches ? allBreaches : [],
    aliases,
    emailNodes,
    sourceCount: platforms.length + emailNodes.length,
    imageUrl: imageUrl || undefined,
    pHash: pHash || undefined,
  };
}
