'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import type { Dossier, PlatformResult } from '@/lib/types';

export function DossierScreen() {
  const { getActiveDossier, dossiers, setActiveDossierId } = useStore();
  const dossier = getActiveDossier();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    social: true,
    facial: false,
    exif: false,
    graph: false,
  });
  const [ringOffset, setRingOffset] = useState(251); // starts empty

  // Animate ring on mount / dossier change
  useEffect(() => {
    if (!dossier) return;
    const t = setTimeout(() => {
      setRingOffset(251 * (1 - dossier.riskScore / 100));
    }, 300);
    return () => clearTimeout(t);
  }, [dossier?.id]);

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!dossier) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-16 h-16 bg-surface2 border border-border rounded-2xl flex items-center justify-center mb-4">
          <FileIcon />
        </div>
        <p className="text-[15px] font-semibold text-t1 mb-1">No Dossiers Yet</p>
        <p className="text-[12px] text-t3 leading-relaxed">
          Run a scan from the Recon Hub to generate your first intelligence dossier.
        </p>
      </div>
    );
  }

  const riskColor =
    dossier.riskLabel === 'Critical'
      ? 'text-red'
      : dossier.riskLabel === 'High'
      ? 'text-red/80'
      : dossier.riskLabel === 'Medium'
      ? 'text-amber'
      : 'text-green';

  return (
    <div className="px-[18px] pt-3 pb-28 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className={`text-[10px] font-semibold tracking-[1.5px] uppercase mb-0.5 ${riskColor}`}>
            {dossier.riskLabel} Exposure
          </p>
          <h1 className="text-[26px] font-bold text-t1 tracking-tight leading-none">Dossier</h1>
        </div>
        <div className="flex gap-2">
          <button className="w-9 h-9 bg-surface2 border border-border rounded-[10px] flex items-center justify-center cursor-pointer hover:border-border-strong transition-colors">
            <ShareIcon />
          </button>
          {/* Dossier history picker */}
          {dossiers.length > 1 && (
            <select
              className="w-9 h-9 bg-surface2 border border-border rounded-[10px] text-t3 text-[10px] cursor-pointer appearance-none flex items-center justify-center"
              onChange={(e) => setActiveDossierId(e.target.value)}
              value={dossier.id}
            >
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName} · {new Date(d.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Target card */}
      <div className="card p-4 border-border-strong">
        <div className="flex items-center gap-[14px]">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-[60px] h-[60px] rounded-2xl bg-surface3 border border-border-strong flex items-center justify-center">
              <PersonIcon />
            </div>
            <div className={`absolute -bottom-[2px] -right-[2px] w-[10px] h-[10px] rounded-full border-2 border-bg ${dossier.riskLabel === 'Critical' ? 'bg-red' : 'bg-amber'}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold text-t1 mb-[2px]">{dossier.displayName}</p>
            <p className="text-[10px] text-t3 mb-2 truncate">{dossier.email}</p>
            <div className="flex gap-[5px] flex-wrap">
              <span className={`badge ${dossier.riskLabel === 'Critical' ? 'badge-red' : 'badge-amber'}`}>
                {dossier.riskLabel} Risk
              </span>
              <span className="badge badge-muted">{dossier.sourceCount} Sources</span>
            </div>
          </div>

          {/* Risk ring */}
          <div className="relative w-[96px] h-[96px] flex-shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
              <defs>
                <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E5484D" />
                  <stop offset="100%" stopColor="#F97316" />
                </linearGradient>
              </defs>
              <circle cx="48" cy="48" r="40" fill="none" stroke="var(--surface-3)" strokeWidth="7" />
              <circle
                cx="48" cy="48" r="40"
                fill="none" stroke="url(#rg)" strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="251"
                strokeDashoffset={ringOffset}
                style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[20px] font-bold text-t1">{dossier.riskScore}%</p>
              <p className="text-[9px] font-semibold text-t3 uppercase tracking-[0.5px]">Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: dossier.platforms.filter((p) => p.status !== 'not_found').length, l: 'Platforms', c: 'text-t1' },
          { v: dossier.breaches.length, l: 'Breaches', c: 'text-red' },
          { v: dossier.aliases.length, l: 'Aliases', c: 'text-t1' },
        ].map(({ v, l, c }) => (
          <div key={l} className="card p-[10px] text-center">
            <p className={`text-[18px] font-bold ${c}`}>{v}</p>
            <p className="text-[9px] text-t3 font-semibold uppercase tracking-[0.5px] mt-[2px]">{l}</p>
          </div>
        ))}
      </div>

      {/* ── SOCIAL FOOTPRINT ── */}
      <Accordion
        id="social"
        open={openSections.social}
        onToggle={() => toggle('social')}
        icon={<GlobeIcon />}
        title="Social Footprint"
        sub={`${dossier.platforms.filter((p) => p.status !== 'not_found').length} matches across platforms`}
      >
        <div className="space-y-[6px]">
          {dossier.platforms.map((p) => (
            <PlatformCard key={p.platform} platform={p} />
          ))}
        </div>
      </Accordion>

      {/* ── FACIAL MATCHES ── */}
      <Accordion
        id="facial"
        open={openSections.facial}
        onToggle={() => toggle('facial')}
        icon={<FaceIcon />}
        title="Facial Biometric Matches"
        sub={`${dossier.facialMatches.length} hits · avg ${(dossier.facialMatches.reduce((a, b) => a + b.confidence, 0) / dossier.facialMatches.length).toFixed(1)}% confidence`}
      >
        <div className="grid grid-cols-2 gap-2">
          {dossier.facialMatches.map((m) => (
            <div key={m.source} className="bg-surface2 border border-border rounded-xl overflow-hidden">
              <div className="h-[80px] bg-surface3 flex items-center justify-center relative">
                <PersonIcon size={28} />
                <span className="badge badge-blue absolute top-2 right-2">{m.confidence}%</span>
              </div>
              <div className="p-[8px] pb-[10px]">
                <p className="text-[11px] font-semibold text-t1">{m.source}</p>
                <p className="text-[9px] text-t3 mt-[1px]">{m.label} · {m.date}</p>
                <div className="h-[2px] bg-surface3 rounded-full overflow-hidden mt-[6px]">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${m.confidence}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      {/* ── EXIF / METADATA ── */}
      <Accordion
        id="exif"
        open={openSections.exif}
        onToggle={() => toggle('exif')}
        icon={<WarningIcon />}
        iconBg={dossier.exif ? "bg-red/10 border border-red/20" : "bg-surface3"}
        title="Metadata & EXIF Risks"
        sub={dossier.exif ? "Vulnerabilities detected in uploaded file" : "No real EXIF data available"}
        subColor={dossier.exif ? "text-red" : "text-t3"}
      >
        <div className="space-y-2">
          {!dossier.exif ? (
            <div className="card-sm p-3 text-center text-[12px] text-t4">
              Upload an image in the Recon Hub to extract real metadata.
            </div>
          ) : (
            <>
              {/* GPS */}
              {dossier.exif.gps && (
                <div className="bg-red/[0.08] border border-red/20 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red tracking-[0.5px] mb-[5px]">GPS COORDINATES EXPOSED</p>
                  <p className="font-mono text-[12px] text-t1 mb-2">{dossier.exif.gps.latitude}° N, {dossier.exif.gps.longitude}° E</p>
                  <div className="bg-[#0a1018] border border-accent/15 rounded-[10px] overflow-hidden relative h-[76px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#091420] to-[#0d1c2e]" />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 76" preserveAspectRatio="none">
                      {[19, 38, 57].map((y) => <line key={y} x1="0" y1={y} x2="340" y2={y} stroke="rgba(59,126,248,0.12)" strokeWidth="0.8" />)}
                      {[68, 170, 272].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="76" stroke="rgba(59,126,248,0.12)" strokeWidth="0.8" />)}
                      <path d="M20,18 Q60,28 100,22 Q140,16 180,26 Q220,36 260,30 Q300,24 340,28" stroke="rgba(59,126,248,0.2)" strokeWidth="1" fill="none" />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-red rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_5px_rgba(229,72,77,0.2)]" />
                    <p className="absolute bottom-[6px] left-2 font-mono text-[9px] text-t4">{dossier.exif.gps.locationName ?? 'Location mapped'}</p>
                  </div>
                </div>
              )}
              {/* Device */}
              {(dossier.exif.device || dossier.exif.image) && (
                <div className="bg-amber/[0.08] border border-amber/20 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-amber tracking-[0.5px] mb-2">DEVICE FINGERPRINT LEAKED</p>
                  {[
                    { k: 'Make', v: dossier.exif.device?.make },
                    { k: 'Model', v: dossier.exif.device?.model },
                    { k: 'Software', v: dossier.exif.device?.software },
                    { k: 'Timestamp', v: dossier.exif.image?.timestamp, mono: true },
                  ].filter(x => x.v).map(({ k, v, mono }) => (
                    <div key={k} className="row py-[4px]">
                      <span className="text-[11px] text-t3">{k}</span>
                      <span className={`text-[11px] text-t1 font-medium ${mono ? 'font-mono' : ''}`}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Other flags */}
              <div className="card-sm p-3">
                <p className="text-[10px] font-bold text-t3 tracking-[0.5px] mb-[7px]">ADDITIONAL FLAGS</p>
                <div className="text-[11px] text-t2 leading-[1.9]">
                  {dossier.exif.camera && <div>· Camera: {dossier.exif.camera.focalLength ?? 'Unknown'} f/{dossier.exif.camera.fNumber ?? '?'} {dossier.exif.camera.exposureTime ?? ''}</div>}
                  {dossier.exif.image?.width && <div>· Resolution: {dossier.exif.image.width}x{dossier.exif.image.height}</div>}
                  {dossier.exif.author?.artist && <div>· Artist: {dossier.exif.author.artist}</div>}
                  {!dossier.exif.camera && !dossier.exif.image?.width && !dossier.exif.author?.artist && (
                    <div className="text-t4">No additional metadata found.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Accordion>

      {/* ── THREAT SHADOW MAP ── */}
      <Accordion
        id="graph"
        open={openSections.graph}
        onToggle={() => toggle('graph')}
        icon={<GraphIcon />}
        title="Data Leak Exposure Graph"
        sub="Threat Shadow Map"
        badge={<span className="flex items-center gap-1"><span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse inline-block" /><span className="text-[9px] font-semibold text-green">LIVE</span></span>}
      >
        <div className="space-y-3">
          <NodeGraph dossier={dossier} />
          <div>
            <p className="sec-label mb-2">Recovered Breach Entries</p>
            {dossier.breaches.map((b) => (
              <div key={b.service} className="border-l-2 border-red/30 pl-3 mb-[10px]">
                <p className="text-[12px] font-semibold text-t1">{b.service} — {b.year}</p>
                <p className="text-[10px] text-t3 mt-[1px]">{b.dataTypes.join(', ')} · {b.recordCount} records</p>
              </div>
            ))}
          </div>
        </div>
      </Accordion>
    </div>
  );
}

// ─── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({ platform: p }: { platform: PlatformResult }) {
  const dotClass =
    p.status === 'verified' ? 'bg-green' :
    p.status === 'probable' || p.status === 'likely' ? 'bg-amber' :
    p.status === 'not_found' ? 'bg-t4' : 'bg-t4';

  const badgeClass =
    p.status === 'verified' ? 'badge-green' :
    p.status === 'probable' ? 'badge-amber' :
    p.status === 'likely' ? 'badge-amber' :
    'badge-muted';

  const label =
    p.status === 'verified' ? 'Verified' :
    p.status === 'probable' ? 'Probable' :
    p.status === 'likely' ? 'Likely' :
    p.status === 'not_found' ? 'Not Found' : 'Possible';

  return (
    <div className="bg-surface2 border border-border rounded-xl p-[10px] flex items-center gap-[10px]">
      <div className="w-[34px] h-[34px] bg-surface3 rounded-[10px] flex items-center justify-center text-base flex-shrink-0">
        {p.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[6px] mb-[1px]">
          <div className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${dotClass}`} />
          <span className="text-[13px] font-medium text-t1">{p.platform}</span>
          {p.realData && <span className="text-[8px] text-green font-semibold bg-green/10 px-1.5 py-0.5 rounded-full">LIVE</span>}
        </div>
        <p className="text-[10px] text-t3 mb-[6px] font-mono">{p.handle}</p>
        {p.status !== 'not_found' && (
          <div className="flex items-center gap-[7px]">
            <div className="flex-1 h-[2px] bg-surface3 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${p.confidence}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-t2">{p.confidence}%</span>
          </div>
        )}
        {/* GitHub-specific metadata */}
        {p.realData && p.metadata && p.platform === 'GitHub' && p.metadata.followers && (
          <div className="mt-[5px] flex gap-2 flex-wrap">
            <span className="text-[9px] text-t4">{p.metadata.followers} followers</span>
            {p.metadata.repos && <span className="text-[9px] text-t4">{p.metadata.repos} repos</span>}
            {p.metadata.location && <span className="text-[9px] text-t4">📍 {p.metadata.location}</span>}
          </div>
        )}
      </div>
      <span className={`badge ${badgeClass} flex-shrink-0 text-[9px]`}>{label}</span>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({
  open, onToggle, icon, iconBg, title, sub, subColor, badge, children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  sub: string;
  subColor?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-[13px] cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-[10px]">
          <div className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center ${iconBg ?? 'bg-surface3'}`}>
            {icon}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-t1">{title}</p>
            <p className={`text-[11px] ${subColor ?? 'text-t3'}`}>{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <span className={`text-t4 text-[11px] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>
      <div
        className="overflow-hidden transition-all duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ maxHeight: open ? '1400px' : '0px' }}
      >
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}

// ─── Node Graph ───────────────────────────────────────────────────────────────

function NodeGraph({ dossier }: { dossier: Dossier }) {
  const primary = dossier.displayName;
  const aliases = dossier.aliases.slice(0, 2);
  const emails = dossier.emailNodes.slice(0, 2);
  const breaches = dossier.breaches.slice(0, 2);

  return (
    <div className="bg-surface2 border border-border rounded-xl overflow-hidden relative">
      <svg width="100%" height="260" viewBox="0 0 354 260">
        <defs>
          <pattern id="g2" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0L0 0 0 22" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="354" height="260" fill="url(#g2)" />
        {/* Lines */}
        <line x1="177" y1="130" x2="177" y2="44" stroke="rgba(59,126,248,0.25)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1="177" y1="130" x2="82" y2="80" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1="177" y1="130" x2="272" y2="80" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1="177" y1="130" x2="60" y2="176" stroke="rgba(229,72,77,0.25)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1="177" y1="130" x2="294" y2="176" stroke="rgba(229,72,77,0.2)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1="177" y1="130" x2="122" y2="226" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1="177" y1="130" x2="232" y2="226" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,3" />
        {/* Primary */}
        <circle cx="177" cy="130" r="24" fill="rgba(59,126,248,0.12)" stroke="rgba(59,126,248,0.4)" strokeWidth="1.5" />
        <circle cx="177" cy="130" r="17" fill="rgba(59,126,248,0.18)" stroke="rgba(59,126,248,0.6)" strokeWidth="1" />
        <text x="177" y="127" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="8" fontWeight="600" fontFamily="'JetBrains Mono',monospace">{primary.slice(0, 10)}</text>
        <text x="177" y="137" textAnchor="middle" fill="rgba(59,126,248,0.7)" fontSize="6.5" fontFamily="Inter,sans-serif">PRIMARY</text>
        {/* Alias top */}
        <g style={{ animation: 'nf2 4.5s ease-in-out infinite' }}>
          <circle cx="177" cy="44" r="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <text x="177" y="48" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="7" fontWeight="500" fontFamily="Inter,sans-serif">{aliases[0] ?? 'alias'}</text>
        </g>
        {/* Alias left */}
        <g style={{ animation: 'nf1 5s ease-in-out infinite' }}>
          <circle cx="82" cy="80" r="13" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
          <text x="82" y="84" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="7" fontWeight="500" fontFamily="Inter,sans-serif">{aliases[1]?.slice(0, 9) ?? 'alias2'}</text>
        </g>
        {/* Platform right */}
        <g style={{ animation: 'nf3 4s ease-in-out infinite' }}>
          <circle cx="272" cy="80" r="13" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
          <text x="272" y="84" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="7" fontWeight="500" fontFamily="Inter,sans-serif">GitHub</text>
        </g>
        {/* Breach nodes */}
        <g style={{ animation: 'nf4 5.5s ease-in-out infinite' }}>
          <circle cx="60" cy="176" r="15" fill="rgba(229,72,77,0.08)" stroke="rgba(229,72,77,0.35)" strokeWidth="1" />
          <text x="60" y="173" textAnchor="middle" fill="rgba(229,72,77,0.9)" fontSize="7" fontWeight="600" fontFamily="'JetBrains Mono',monospace">BREACH</text>
          <text x="60" y="183" textAnchor="middle" fill="rgba(229,72,77,0.5)" fontSize="6" fontFamily="Inter,sans-serif">{breaches[0]?.service.slice(0, 8) ?? 'breach1'}</text>
        </g>
        <g style={{ animation: 'nf2 4s ease-in-out infinite 1s' }}>
          <circle cx="294" cy="176" r="14" fill="rgba(229,72,77,0.06)" stroke="rgba(229,72,77,0.28)" strokeWidth="1" />
          <text x="294" y="173" textAnchor="middle" fill="rgba(229,72,77,0.85)" fontSize="7" fontWeight="600" fontFamily="'JetBrains Mono',monospace">LEAK</text>
          <text x="294" y="183" textAnchor="middle" fill="rgba(229,72,77,0.48)" fontSize="6" fontFamily="Inter,sans-serif">{breaches[1]?.service.slice(0, 8) ?? 'breach2'}</text>
        </g>
        {/* Email nodes */}
        <g style={{ animation: 'nf1 3.8s ease-in-out infinite 0.5s' }}>
          <circle cx="122" cy="226" r="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <text x="122" y="229" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="6.5" fontFamily="'JetBrains Mono',monospace">{emails[0]?.split('@')[0] ?? 'email1'}</text>
        </g>
        <g style={{ animation: 'nf3 4.2s ease-in-out infinite 1.5s' }}>
          <circle cx="232" cy="226" r="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <text x="232" y="229" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="6.5" fontFamily="'JetBrains Mono',monospace">{emails[1]?.split('@')[0] ?? 'email2'}</text>
        </g>
      </svg>
      {/* Legend */}
      <div className="absolute top-2 right-2 flex flex-col gap-[5px]">
        {[
          { color: 'bg-accent/60', label: 'Primary' },
          { color: 'bg-white/30', label: 'Alias' },
          { color: 'bg-red/50', label: 'Breach' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-[5px] h-[5px] rounded-full ${color}`} />
            <span className="text-[8px] text-t4">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PersonIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-t3">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-t3">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t3">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function FaceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2.5">
      <path d="m10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function GraphIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2">
      <circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="19" r="2" />
      <line x1="14.12" y1="10.88" x2="17.42" y2="6.58" /><line x1="9.88" y1="13.12" x2="6.58" y2="17.42" />
      <line x1="14.12" y1="13.12" x2="17.42" y2="17.42" /><line x1="9.88" y1="10.88" x2="6.58" y2="6.58" />
    </svg>
  );
}
