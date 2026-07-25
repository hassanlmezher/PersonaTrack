// ─── Scan Targets ────────────────────────────────────────────────────────────

export type ScanMode = 'username' | 'facial';

export interface Target {
  id: string;
  value: string; // @username or file URL
  mode: ScanMode;
}

// ─── Platform Results ─────────────────────────────────────────────────────────

export type MatchStatus = 'verified' | 'probable' | 'likely' | 'possible' | 'not_found';

export interface PlatformResult {
  platform: string;
  icon: string;
  handle: string;
  profileUrl?: string;
  status: MatchStatus;
  confidence: number; // 0-100
  realData: boolean; // whether this came from a real API call
  metadata?: Record<string, string>;
}

// ─── EXIF / Metadata ─────────────────────────────────────────────────────────

export interface ExifData {
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    locationName?: string;
  };
  device?: {
    make?: string;
    model?: string;
    software?: string;
    osVersion?: string;
  };
  image?: {
    timestamp?: string;
    width?: number;
    height?: number;
    orientation?: number;
  };
  author?: {
    artist?: string;
    copyright?: string;
    creator?: string;
  };
  camera?: {
    fNumber?: number;
    exposureTime?: string;
    iso?: number;
    focalLength?: string;
    flash?: string;
  };
  raw?: Record<string, unknown>;
}

// ─── Facial Match ─────────────────────────────────────────────────────────────

export interface FacialMatch {
  source: string;
  date: string;
  confidence: number;
  label: string;
  url?: string;
}

// ─── Breach Entry ─────────────────────────────────────────────────────────────

export interface BreachEntry {
  service: string;
  year: string;
  dataTypes: string[];
  recordCount: string;
  severity: 'critical' | 'high' | 'medium';
}

// ─── Dossier ──────────────────────────────────────────────────────────────────

export interface Dossier {
  id: string;
  createdAt: string;
  targets: string[];
  mode: ScanMode;
  riskScore: number;
  riskLabel: 'Critical' | 'High' | 'Medium' | 'Low';
  displayName: string;
  email?: string;
  platforms: PlatformResult[];
  facialMatches: FacialMatch[];
  exif?: ExifData;
  breaches: BreachEntry[];
  aliases: string[];
  emailNodes: string[];
  sourceCount: number;
}

// ─── Scan State ───────────────────────────────────────────────────────────────

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error';

export interface ScanStage {
  label: string;
  percent: number;
  log: string;
}

export interface ScanState {
  status: ScanStatus;
  currentStage: number;
  stages: ScanStage[];
  error?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  stealthMode: boolean;
  proxyRotation: boolean;
  autoArchive: boolean;
  realtimeAlerts: boolean;
  deepSocialCrawl: boolean;
  breachLookup: boolean;
  aliasEngine: boolean;
}

// ─── App Store ────────────────────────────────────────────────────────────────

export interface AppStore {
  // Navigation
  activeTab: 'recon' | 'dossier' | 'settings';
  setActiveTab: (tab: AppStore['activeTab']) => void;

  // Recon
  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;
  targets: string[];
  addTarget: (t: string) => void;
  removeTarget: (t: string) => void;
  uploadedFile: File | null;
  uploadedFileUrl: string | null;
  uploadedExifData: ExifData | null;
  setUploadedFile: (file: File | null, exif?: ExifData | null) => void;

  // Scan
  scanState: ScanState;
  startScan: () => void;

  // Dossiers
  dossiers: Dossier[];
  activeDossierId: string | null;
  setActiveDossierId: (id: string | null) => void;
  getActiveDossier: () => Dossier | null;

  // Settings
  settings: AppSettings;
  toggleSetting: (key: keyof AppSettings) => void;
}
