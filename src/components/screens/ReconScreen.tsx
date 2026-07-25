'use client';

import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { extractExif } from '@/lib/exif';

export function ReconScreen() {
  const {
    scanMode, setScanMode,
    targets, addTarget, removeTarget,
    uploadedFileUrl, setUploadedFile,
    scanState, startScan,
    settings, toggleSetting,
  } = useStore();

  const [inputVal, setInputVal] = useState('');
  const [dragging, setDragging] = useState(false);
  const [readout, setReadout] = useState('ANALYZING BIOMETRIC MARKERS_');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const READOUTS = [
    'ANALYZING BIOMETRIC MARKERS_',
    'EXTRACTING EXIF METADATA_',
    'MAPPING FACIAL GEOMETRY_',
    'CROSS-REFERENCING IMAGE INDEX_',
    'COMPUTING MATCH VECTORS_',
  ];
  const readoutIdxRef = useRef(0);

  // ── Tag chip management ───────────────────────────────────────────────────

  const handleAddTarget = useCallback(() => {
    const v = inputVal.trim();
    if (!v) return;
    addTarget(v);
    setInputVal('');
  }, [inputVal, addTarget]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTarget(); }
  };

  // ── File handling ─────────────────────────────────────────────────────────

  const startReadoutCycle = useCallback(() => {
    if (readoutTimerRef.current) return;
    readoutTimerRef.current = setInterval(() => {
      readoutIdxRef.current = (readoutIdxRef.current + 1) % READOUTS.length;
      setReadout(READOUTS[readoutIdxRef.current]);
    }, 2000);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadedFile(file);
    startReadoutCycle();
    // Extract real EXIF in background
    const exifData = await extractExif(file);
    setUploadedFile(file, exifData);
  }, [setUploadedFile, startReadoutCycle]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Scan button ───────────────────────────────────────────────────────────

  const isScanning = scanState.status === 'scanning';
  const currentStage = scanState.stages[scanState.currentStage] ?? scanState.stages[scanState.stages.length - 1];
  const logLines = scanState.stages.slice(0, scanState.currentStage + 1).map((s) => s.log);

  const canScan = scanMode === 'username' ? targets.length > 0 : !!uploadedFileUrl;

  return (
    <div className="px-[18px] pt-3 pb-28 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold text-t4 tracking-[2px] uppercase mb-0.5">PersonaTrace</p>
          <h1 className="text-[26px] font-bold text-t1 tracking-tight leading-none">Recon Hub</h1>
        </div>
        <div className="w-10 h-10 bg-surface2 border border-border rounded-xl flex items-center justify-center">
          <SearchIcon />
        </div>
      </div>

      {/* Segmented control */}
      <div className="bg-surface3 rounded-[10px] p-[3px] flex">
        <button
          onClick={() => setScanMode('username')}
          className={`flex-1 py-[7px] text-[13px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer ${
            scanMode === 'username' ? 'bg-surface1 text-t1 shadow-sm' : 'text-t3'
          }`}
        >
          Username Matrix
        </button>
        <button
          onClick={() => setScanMode('facial')}
          className={`flex-1 py-[7px] text-[13px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer ${
            scanMode === 'facial' ? 'bg-surface1 text-t1 shadow-sm' : 'text-t3'
          }`}
        >
          Facial Index
        </button>
      </div>

      {/* ── USERNAME PANEL ── */}
      {scanMode === 'username' && (
        <>
          <div className="card p-[14px]">
            <p className="sec-label">Target Identifiers</p>
            <div className="flex gap-2 mb-[10px]">
              <input
                className="inp flex-1 px-3 py-[10px]"
                type="text"
                placeholder="@username or alias"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleAddTarget}
                className="w-[42px] bg-surface3 border border-border rounded-[10px] text-t2 text-xl flex items-center justify-center flex-shrink-0 hover:bg-surface2 transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-[6px] min-h-[22px]">
              {targets.map((t) => (
                <div key={t} className="chip">
                  {t}{' '}
                  <span className="chip-x" onClick={() => removeTarget(t)}>
                    ×
                  </span>
                </div>
              ))}
              {targets.length === 0 && (
                <span className="text-[11px] text-t4">Add at least one target</span>
              )}
            </div>
          </div>

          <div className="card px-[14px] py-0">
            <p className="sec-label pt-3 pb-2">Scan Configuration</p>
            {(
              [
                { key: 'deepSocialCrawl', label: 'Deep Social Crawl', sub: '350+ platforms indexed' },
                { key: 'breachLookup', label: 'Breach Database Lookup', sub: 'HaveIBeenPwned + dark web' },
                { key: 'aliasEngine', label: 'Alias Variation Engine', sub: 'Generates 80+ permutations' },
              ] as const
            ).map(({ key, label, sub }) => (
              <div key={key} className="row">
                <div>
                  <p className="text-[13px] font-medium text-t1">{label}</p>
                  <p className="text-[11px] text-t3 mt-[1px]">{sub}</p>
                </div>
                <div
                  className={`toggle ${settings[key] ? 'on' : ''}`}
                  onClick={() => toggleSetting(key)}
                >
                  <div className="knob" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── FACIAL PANEL ── */}
      {scanMode === 'facial' && (
        <>
          <div
            className={`drop-zone ${dragging ? 'over' : ''} overflow-hidden relative`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {!uploadedFileUrl ? (
              <div className="py-9 px-4 text-center">
                <div className="w-[52px] h-[52px] bg-surface3 rounded-[14px] flex items-center justify-center mx-auto mb-3 float-anim">
                  <ImageIcon />
                </div>
                <p className="text-[14px] font-medium text-t1 mb-1">Drop portrait image here</p>
                <p className="text-[12px] text-t3">Tap or drag · JPG, PNG, HEIC</p>
                <div className="flex justify-center gap-[6px] mt-3">
                  <span className="badge badge-blue">Facial Recognition</span>
                  <span className="badge badge-muted">EXIF Extraction</span>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedFileUrl} alt="Upload preview" className="w-full h-44 object-cover block" />
                <div className="scan-grid" />
                <div className="scan-line" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 border border-accent/60 rounded-full" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bg/90 to-transparent px-3 py-3">
                  <p className="font-mono text-[10px] text-accent font-medium">{readout}</p>
                </div>
              </div>
            )}
          </div>

          <div className="card p-[12px]">
            <p className="sec-label">Image Index Sources</p>
            <div className="flex flex-wrap gap-[5px]">
              {['PimEyes', 'Google Vision', 'Social Media', 'News Archives', 'Public Records'].map((s) => (
                <span key={s} className="badge badge-muted">{s}</span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Progress */}
      {isScanning && (
        <div className="card p-[14px] bg-surface2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-[7px] h-[7px] rounded-full bg-accent flex-shrink-0 animate-pulse" />
            <p className="font-mono text-[11px] font-semibold text-accent tracking-[0.2px]">
              {currentStage?.label ?? ''}
            </p>
          </div>
          <div className="prog-track mb-[10px]">
            <div
              className="prog-fill transition-all duration-500"
              style={{ width: `${currentStage?.percent ?? 0}%` }}
            />
          </div>
          <div className="font-mono text-[10px] text-t3 leading-[1.9] space-y-0">
            {logLines.slice(-4).map((line, i) => (
              <div
                key={i}
                className={`transition-opacity duration-300 ${
                  i === logLines.slice(-4).length - 1
                    ? logLines.length === scanState.stages.length
                      ? 'text-green'
                      : 'text-t2'
                    : 'text-t3'
                }`}
              >
                &gt; {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan CTA */}
      <button
        className="btn btn-primary"
        onClick={startScan}
        disabled={isScanning || !canScan}
      >
        {isScanning ? (
          <>
            <span className="inline-block w-[15px] h-[15px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Scanning…
          </>
        ) : (
          <>
            <BoltIcon />
            Initialize Deep Recon Scan
          </>
        )}
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: '350+', label: 'Platforms' },
          { value: '12.4B', label: 'Records' },
          { value: '99.4%', label: 'Accuracy' },
        ].map(({ value, label }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-[19px] font-bold text-t1">{value}</p>
            <p className="text-[9px] text-t3 font-semibold uppercase tracking-[0.5px] mt-[2px]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-t3">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-t3">
      <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
