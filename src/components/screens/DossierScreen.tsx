'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import type { Dossier, PlatformResult } from '@/lib/types';

// ─── Force-Directed Graph Engine ──────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  type: 'primary' | 'platform' | 'breach' | 'alias' | 'email';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

function buildGraph(dossier: Dossier): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = 177;
  const cy = 130;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  nodes.push({ id: 'primary', label: dossier.displayName.slice(0, 12), type: 'primary', x: cx, y: cy, vx: 0, vy: 0 });

  const angleStep = (2 * Math.PI) / Math.max(1, dossier.platforms.filter(p => p.status !== 'not_found').length);
  let angleIdx = 0;

  dossier.platforms
    .filter((p) => p.status !== 'not_found')
    .slice(0, 10)
    .forEach((p) => {
      const r = 72 + (angleIdx % 2) * 18;
      const angle = angleIdx * angleStep - Math.PI / 2;
      const id = 'platform-' + p.platform;
      nodes.push({
        id,
        label: p.platform.split(' ')[0].slice(0, 8),
        type: 'platform',
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: 0, vy: 0,
      });
      edges.push({ source: 'primary', target: id });
      angleIdx++;
    });

  dossier.breaches.slice(0, 3).forEach((b, i) => {
    const angle = (i / 3) * Math.PI + Math.PI / 6;
    const id = 'breach-' + b.service;
    nodes.push({
      id,
      label: b.service.slice(0, 8),
      type: 'breach',
      x: cx + 104 * Math.cos(angle),
      y: cy + 104 * Math.sin(angle),
      vx: 0, vy: 0,
    });
    edges.push({ source: 'primary', target: id });
  });

  dossier.aliases.slice(0, 3).forEach((alias, i) => {
    const angle = (i / 3) * (-Math.PI) - Math.PI / 6;
    const id = 'alias-' + i;
    nodes.push({
      id,
      label: alias.slice(0, 9),
      type: 'alias',
      x: cx + 90 * Math.cos(angle),
      y: cy + 90 * Math.sin(angle),
      vx: 0, vy: 0,
    });
    edges.push({ source: 'primary', target: id });
  });

  return { nodes, edges };
}

function DynamicGraph({ dossier }: { dossier: Dossier }) {
  const { nodes: initNodes, edges } = buildGraph(dossier);
  const [nodes, setNodes] = useState<GraphNode[]>(initNodes);
  const rafRef = useRef<number | null>(null);
  const nodeRef = useRef(initNodes);

  const tick = useCallback(() => {
    setNodes((prev) => {
      const next = prev.map((n) => ({ ...n }));
      const REPULSION = 400;
      const ATTRACTION = 0.02;
      const DAMPING = 0.88;

      // Repulsion
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const dx = next[j].x - next[i].x;
          const dy = next[j].y - next[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = REPULSION / (dist * dist);
          next[i].vx -= (dx / dist) * force;
          next[i].vy -= (dy / dist) * force;
          next[j].vx += (dx / dist) * force;
          next[j].vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const s = next.find((n) => n.id === edge.source);
        const t = next.find((n) => n.id === edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        s.vx += dx * ATTRACTION;
        s.vy += dy * ATTRACTION;
        t.vx -= dx * ATTRACTION;
        t.vy -= dy * ATTRACTION;
      }

      // Centre gravity
      for (const n of next) {
        if (n.id === 'primary') continue;
        n.vx += (177 - n.x) * 0.005;
        n.vy += (130 - n.y) * 0.005;
      }

      // Integrate + clamp
      for (const n of next) {
        if (n.id === 'primary') continue;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x = Math.max(16, Math.min(338, n.x + n.vx));
        n.y = Math.max(14, Math.min(246, n.y + n.vy));
      }

      nodeRef.current = next;
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [edges]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    const stop = setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }, 6000); // stop physics after 6s for battery
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(stop);
    };
  }, [tick]);

  const colorMap: Record<GraphNode['type'], string> = {
    primary: 'rgba(0,210,255,0.55)',
    platform: 'rgba(255,255,255,0.18)',
    breach: 'rgba(255,59,48,0.45)',
    alias: 'rgba(255,255,255,0.12)',
    email: 'rgba(255,159,10,0.35)',
  };
  const strokeMap: Record<GraphNode['type'], string> = {
    primary: 'rgba(0,210,255,0.9)',
    platform: 'rgba(255,255,255,0.25)',
    breach: 'rgba(255,59,48,0.8)',
    alias: 'rgba(255,255,255,0.18)',
    email: 'rgba(255,159,10,0.7)',
  };
  const radiusMap: Record<GraphNode['type'], number> = {
    primary: 22,
    platform: 13,
    breach: 14,
    alias: 11,
    email: 11,
  };

  return (
    <div className="bg-surface2 border border-border rounded-xl overflow-hidden relative">
      <svg width="100%" height="260" viewBox="0 0 354 260">
        <defs>
          <pattern id="g2" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0L0 0 0 22" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="354" height="260" fill="url(#g2)" />

        {/* Edges */}
        {edges.map((e) => {
          const s = nodes.find((n) => n.id === e.source);
          const t = nodes.find((n) => n.id === e.target);
          if (!s || !t) return null;
          const isRed = e.target.startsWith('breach');
          return (
            <line
              key={`${e.source}-${e.target}`}
              x1={s.x} y1={s.y}
              x2={t.x} y2={t.y}
              stroke={isRed ? 'rgba(255,59,48,0.2)' : 'rgba(0,210,255,0.12)'}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x} cy={n.y}
              r={radiusMap[n.type]}
              fill={colorMap[n.type]}
              stroke={strokeMap[n.type]}
              strokeWidth="1.2"
            />
            {n.type === 'primary' && (
              <circle cx={n.x} cy={n.y} r={radiusMap[n.type] + 6} fill="none" stroke="rgba(0,210,255,0.18)" strokeWidth="1" />
            )}
            <text
              x={n.x} y={n.y + (n.type === 'primary' ? 0 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.85)"
              fontSize={n.type === 'primary' ? 7.5 : 6.5}
              fontWeight={n.type === 'primary' ? '700' : '500'}
              fontFamily="'JetBrains Mono', monospace"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute top-2 right-2 flex flex-col gap-[5px]">
        {[
          { color: 'bg-accent/60', label: 'Primary' },
          { color: 'bg-white/25', label: 'Platform' },
          { color: 'bg-red/50', label: 'Breach' },
          { color: 'bg-white/15', label: 'Alias' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-[5px] h-[5px] rounded-full ${color}`} />
            <span className="text-[8px] text-t4">{label}</span>
          </div>
        ))}
      </div>

      {/* Live badge */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <div className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
        <span className="text-[8px] text-green font-semibold font-mono">LIVE GRAPH</span>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DossierScreen() {
  const { getActiveDossier, dossiers, setActiveDossierId } = useStore();
  const dossier = getActiveDossier();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    social: true,
    facial: false,
    exif: false,
    graph: false,
  });
  const [ringOffset, setRingOffset] = useState(251);

  useEffect(() => {
    if (!dossier) return;
    const t = setTimeout(() => {
      setRingOffset(251 * (1 - dossier.riskScore / 100));
    }, 300);
    return () => clearTimeout(t);
  }, [dossier?.id]);

  const toggle = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!dossier) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
        <div className="w-16 h-16 bg-surface2 border border-border rounded-2xl flex items-center justify-center">
          <FileIcon />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-t1 mb-1">No Dossiers Yet</p>
          <p className="text-[12px] text-t3 leading-relaxed">
            Run a scan from the Recon Hub to generate your first intelligence dossier.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <span className="badge badge-muted">20+ Platforms</span>
          <span className="badge badge-muted">EXIF Analysis</span>
          <span className="badge badge-muted">Threat Graph</span>
        </div>
      </div>
    );
  }

  const riskColor =
    dossier.riskLabel === 'Critical' ? 'text-red' :
    dossier.riskLabel === 'High' ? 'text-amber' :
    dossier.riskLabel === 'Medium' ? 'text-amber' : 'text-green';

  const verifiedCount = dossier.platforms.filter((p) => p.status === 'verified').length;

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
          {dossiers.length > 1 && (
            <select
              className="w-9 h-9 bg-surface2 border border-border rounded-[10px] text-t3 text-[10px] cursor-pointer appearance-none"
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
          {/* Avatar — real image if facial mode, else initials */}
          <div className="relative flex-shrink-0">
            <div className="w-[60px] h-[60px] rounded-2xl bg-surface3 border border-border-strong overflow-hidden flex items-center justify-center">
              {dossier.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dossier.imageUrl} alt="Subject" className="w-full h-full object-cover" />
              ) : (
                <PersonIcon />
              )}
            </div>
            <div className={`absolute -bottom-[2px] -right-[2px] w-[10px] h-[10px] rounded-full border-2 border-bg ${
              dossier.riskLabel === 'Critical' ? 'bg-red' : 'bg-amber'
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold text-t1 mb-[2px]">{dossier.displayName}</p>
            <p className="text-[10px] text-t3 mb-2 truncate font-mono">{dossier.email ?? '—'}</p>
            <div className="flex gap-[5px] flex-wrap">
              <span className={`badge ${dossier.riskLabel === 'Critical' ? 'badge-red' : 'badge-amber'}`}>
                {dossier.riskLabel} Risk
              </span>
              <span className="badge badge-muted">{dossier.sourceCount} Sources</span>
              {dossier.pHash && (
                <span className="badge badge-blue font-mono">pHash</span>
              )}
            </div>
          </div>

          {/* Risk ring */}
          <div className="relative w-[88px] h-[88px] flex-shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88" className="rotate-[-90deg]">
              <defs>
                <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF3B30" />
                  <stop offset="100%" stopColor="#FF9F0A" />
                </linearGradient>
              </defs>
              <circle cx="44" cy="44" r="36" fill="none" stroke="var(--surface-3)" strokeWidth="6" />
              <circle
                cx="44" cy="44" r="36"
                fill="none" stroke="url(#rg)" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="226"
                strokeDashoffset={226 * (1 - dossier.riskScore / 100)}
                style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[18px] font-bold text-t1">{dossier.riskScore}%</p>
              <p className="text-[9px] font-semibold text-t3 uppercase tracking-[0.5px]">Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: verifiedCount, l: 'Verified', c: 'text-green' },
          { v: dossier.breaches.length, l: 'Breaches', c: 'text-red' },
          { v: dossier.aliases.length, l: 'Aliases', c: 'text-t1' },
        ].map(({ v, l, c }) => (
          <div key={l} className="card p-[10px] text-center">
            <p className={`text-[18px] font-bold ${c}`}>{v}</p>
            <p className="text-[9px] text-t3 font-semibold uppercase tracking-[0.5px] mt-[2px]">{l}</p>
          </div>
        ))}
      </div>

      {/* pHash fingerprint display */}
      {dossier.pHash && (
        <div className="card p-3">
          <p className="sec-label mb-2">Perceptual Hash Fingerprint</p>
          <p className="font-mono text-[11px] text-accent tracking-wider break-all">{dossier.pHash}</p>
          <p className="text-[10px] text-t4 mt-1">64-bit visual fingerprint computed from image pixel data</p>
        </div>
      )}

      {/* ── SOCIAL FOOTPRINT ── */}
      <Accordion
        id="social"
        open={openSections.social}
        onToggle={() => toggle('social')}
        icon={<GlobeIcon />}
        title="Social Footprint"
        sub={`${verifiedCount} verified · ${dossier.platforms.filter(p => p.status === 'not_found').length} not found`}
      >
        <div className="space-y-[6px]">
          {dossier.platforms.length === 0 ? (
            <p className="text-[12px] text-t4 text-center py-2">No platforms scanned yet.</p>
          ) : (
            dossier.platforms.map((p) => (
              <PlatformCard key={p.platform} platform={p} />
            ))
          )}
        </div>
      </Accordion>

      {/* ── FACIAL MATCHES ── */}
      {dossier.mode === 'facial' && dossier.facialMatches.length > 0 && (
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
                <div className="h-[80px] bg-surface3 flex items-center justify-center relative overflow-hidden">
                  {dossier.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dossier.imageUrl} alt="Match" className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <PersonIcon size={28} />
                  )}
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
      )}

      {/* ── EXIF / METADATA ── */}
      <Accordion
        id="exif"
        open={openSections.exif}
        onToggle={() => toggle('exif')}
        icon={<WarningIcon />}
        iconBg={dossier.exif ? 'bg-red/10 border border-red/20' : 'bg-surface3'}
        title="Metadata & EXIF Risks"
        sub={dossier.exif ? 'Real embedded metadata extracted from file' : 'No EXIF data — image may be clean'}
        subColor={dossier.exif ? 'text-red' : 'text-t3'}
      >
        <div className="space-y-2">
          {!dossier.exif ? (
            <div className="card-sm p-4 text-center">
              <p className="text-[13px] font-semibold text-t2 mb-1">No Embedded EXIF Metadata</p>
              <p className="text-[11px] text-t4 leading-relaxed">
                No metadata found in the file headers. The image has been stripped or was captured by a privacy-preserving app.
              </p>
            </div>
          ) : (
            <>
              {dossier.exif.gps && (
                <div className="bg-red/[0.08] border border-red/20 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red tracking-[0.5px] mb-[5px]">⚠ GPS COORDINATES EXPOSED</p>
                  <p className="font-mono text-[12px] text-t1 mb-2">
                    {dossier.exif.gps.latitude.toFixed(6)}° N, {dossier.exif.gps.longitude.toFixed(6)}° E
                  </p>
                  <div className="bg-[#0a1018] border border-accent/15 rounded-[10px] overflow-hidden relative h-[76px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#091420] to-[#0d1c2e]" />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 76" preserveAspectRatio="none">
                      {[19, 38, 57].map((y) => <line key={y} x1="0" y1={y} x2="340" y2={y} stroke="rgba(0,210,255,0.12)" strokeWidth="0.8" />)}
                      {[68, 170, 272].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="76" stroke="rgba(0,210,255,0.12)" strokeWidth="0.8" />)}
                    </svg>
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-red rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_5px_rgba(255,59,48,0.2)]" />
                    <p className="absolute bottom-[6px] left-2 font-mono text-[9px] text-t4">
                      {dossier.exif.gps.locationName ?? `${dossier.exif.gps.latitude.toFixed(4)}, ${dossier.exif.gps.longitude.toFixed(4)}`}
                    </p>
                  </div>
                </div>
              )}

              {(dossier.exif.device?.make || dossier.exif.device?.model || dossier.exif.image?.timestamp) && (
                <div className="bg-amber/[0.08] border border-amber/20 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-amber tracking-[0.5px] mb-2">⚠ DEVICE FINGERPRINT LEAKED</p>
                  {[
                    { k: 'Make', v: dossier.exif.device?.make },
                    { k: 'Model', v: dossier.exif.device?.model },
                    { k: 'Software', v: dossier.exif.device?.software },
                    { k: 'Captured', v: dossier.exif.image?.timestamp, mono: true },
                  ].filter((r) => r.v).map(({ k, v, mono }) => (
                    <div key={k} className="row py-[4px]">
                      <span className="text-[11px] text-t3">{k}</span>
                      <span className={`text-[11px] text-t1 font-medium ${mono ? 'font-mono' : ''}`}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {(dossier.exif.camera || dossier.exif.image?.width || dossier.exif.author?.artist) && (
                <div className="card-sm p-3">
                  <p className="text-[10px] font-bold text-t3 tracking-[0.5px] mb-[7px]">ADDITIONAL SIGNALS</p>
                  <div className="text-[11px] text-t2 leading-[1.9]">
                    {dossier.exif.camera?.focalLength && <div>· Focal length: {dossier.exif.camera.focalLength}</div>}
                    {dossier.exif.camera?.fNumber && <div>· Aperture: f/{dossier.exif.camera.fNumber}</div>}
                    {dossier.exif.camera?.exposureTime && <div>· Exposure: {dossier.exif.camera.exposureTime}</div>}
                    {dossier.exif.camera?.iso && <div>· ISO: {dossier.exif.camera.iso}</div>}
                    {dossier.exif.image?.width && <div>· Resolution: {dossier.exif.image.width}×{dossier.exif.image.height}</div>}
                    {dossier.exif.author?.artist && <div>· Artist: {dossier.exif.author.artist}</div>}
                    {dossier.exif.author?.copyright && <div>· Copyright: {dossier.exif.author.copyright}</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Accordion>

      {/* ── THREAT SHADOW MAP (dynamic) ── */}
      <Accordion
        id="graph"
        open={openSections.graph}
        onToggle={() => toggle('graph')}
        icon={<GraphIcon />}
        title="Threat Shadow Map"
        sub={`${dossier.platforms.filter(p => p.status !== 'not_found').length} nodes · ${dossier.breaches.length} breach links`}
        badge={<span className="flex items-center gap-1"><span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse inline-block" /><span className="text-[9px] font-semibold text-green">LIVE</span></span>}
      >
        <div className="space-y-3">
          <DynamicGraph dossier={dossier} />
          {dossier.breaches.length > 0 && (
            <div>
              <p className="sec-label mb-2">Recovered Breach Entries</p>
              {dossier.breaches.map((b) => (
                <div key={b.service} className="border-l-2 border-red/30 pl-3 mb-[10px]">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-semibold text-t1">{b.service}</p>
                    <span className={`badge badge-${b.severity === 'critical' ? 'red' : b.severity === 'high' ? 'amber' : 'muted'}`}>{b.severity}</span>
                  </div>
                  <p className="text-[10px] text-t3 mt-[1px]">{b.dataTypes.join(', ')} · {b.recordCount} records · {b.year}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Accordion>
    </div>
  );
}

// ─── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({ platform: p }: { platform: PlatformResult }) {
  const dotClass =
    p.status === 'verified' ? 'bg-green' :
    p.status === 'probable' || p.status === 'likely' ? 'bg-amber' : 'bg-t4';

  const badgeClass =
    p.status === 'verified' ? 'badge-green' :
    p.status === 'probable' || p.status === 'likely' ? 'badge-amber' :
    p.status === 'not_found' ? 'badge-muted' : 'badge-muted';

  const label =
    p.status === 'verified' ? 'Verified' :
    p.status === 'probable' ? 'Probable' :
    p.status === 'likely' ? 'Likely' :
    p.status === 'not_found' ? 'Not Found' : 'Possible';

  return (
    <div className={`bg-surface2 border rounded-xl p-[10px] ${
      p.status === 'not_found' ? 'opacity-40 border-border' : 'border-border'
    }`}>
      <div className="flex items-center gap-[10px]">
        <div className="w-[34px] h-[34px] bg-surface3 rounded-[10px] flex items-center justify-center text-base flex-shrink-0">
          {p.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px] mb-[1px]">
            <div className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${dotClass}`} />
            <span className="text-[13px] font-medium text-t1">{p.platform}</span>
            {p.realData && p.status !== 'not_found' && (
              <span className="text-[8px] text-green font-semibold bg-green/10 px-1.5 py-0.5 rounded-full">LIVE</span>
            )}
          </div>
          <p className="text-[10px] text-t3 font-mono">{p.handle}</p>
          {p.metadata?.note && (
            <p className="text-[9px] text-amber mt-[2px]">{p.metadata.note}</p>
          )}
        </div>
        <span className={`badge ${badgeClass} flex-shrink-0 text-[9px]`}>{label}</span>
      </div>

      {/* Confidence bar */}
      {p.status !== 'not_found' && (
        <div className="flex items-center gap-[7px] mt-[8px]">
          <div className="flex-1 h-[2px] bg-surface3 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${p.confidence}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-t2 font-mono">{p.confidence}%</span>
        </div>
      )}

      {/* Real metadata row */}
      {p.realData && (p.metadata?.followers || p.metadata?.karma || p.metadata?.repos) && (
        <div className="flex gap-3 flex-wrap mt-[6px]">
          {p.metadata.followers && <span className="text-[9px] text-t4">{p.metadata.followers} followers</span>}
          {p.metadata.repos && <span className="text-[9px] text-t4">{p.metadata.repos} repos</span>}
          {p.metadata.karma && <span className="text-[9px] text-t4">{p.metadata.karma} karma</span>}
          {p.metadata.location && <span className="text-[9px] text-t4">📍 {p.metadata.location}</span>}
        </div>
      )}

      {/* Open Profile button — always shown when profileUrl exists */}
      {p.profileUrl && p.status !== 'not_found' && (
        <a
          href={p.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-[8px] flex items-center justify-center gap-[6px] w-full py-[7px] rounded-[9px] bg-surface3 border border-border text-[11px] font-semibold text-t2 hover:text-t1 hover:border-border-strong hover:bg-surface2 active:scale-[0.98] transition-all"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open Profile
        </a>
      )}
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
        style={{ maxHeight: open ? '2000px' : '0px' }}
      >
        <div className="px-3 pb-3">{children}</div>
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5">
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
