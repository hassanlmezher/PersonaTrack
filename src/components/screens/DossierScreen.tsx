'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import type { Dossier, PlatformResult, QuickLink } from '@/lib/types';

// ─── Force-Directed Graph Engine ──────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  type: 'primary' | 'platform' | 'breach' | 'alias';
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface GraphEdge { source: string; target: string; }

function buildGraph(dossier: Dossier): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = 177, cy = 130;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  nodes.push({ id: 'primary', label: dossier.displayName.replace('@', '').slice(0, 12), type: 'primary', x: cx, y: cy, vx: 0, vy: 0 });

  const confirmed = dossier.platforms.filter(p => p.status === 'verified');
  const angleStep = (2 * Math.PI) / Math.max(1, confirmed.length);
  confirmed.slice(0, 8).forEach((p, i) => {
    const r = 68 + (i % 2) * 20;
    const angle = i * angleStep - Math.PI / 2;
    const id = 'platform-' + p.platform;
    nodes.push({ id, label: p.platform.split(' ')[0].slice(0, 8), type: 'platform', x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 });
    edges.push({ source: 'primary', target: id });
  });

  dossier.breaches.slice(0, 3).forEach((b, i) => {
    const angle = (i / 3) * Math.PI + Math.PI / 4;
    const id = 'breach-' + b.service;
    nodes.push({ id, label: b.service.slice(0, 8), type: 'breach', x: cx + 105 * Math.cos(angle), y: cy + 105 * Math.sin(angle), vx: 0, vy: 0 });
    edges.push({ source: 'primary', target: id });
  });

  dossier.aliases.slice(0, 3).forEach((alias, i) => {
    const angle = (i / 3) * (-Math.PI) - Math.PI / 5;
    const id = 'alias-' + i;
    nodes.push({ id, label: alias.slice(0, 9), type: 'alias', x: cx + 85 * Math.cos(angle), y: cy + 85 * Math.sin(angle), vx: 0, vy: 0 });
    edges.push({ source: 'primary', target: id });
  });

  return { nodes, edges };
}

function DynamicGraph({ dossier }: { dossier: Dossier }) {
  const { nodes: initNodes, edges } = buildGraph(dossier);
  const [nodes, setNodes] = useState<GraphNode[]>(initNodes);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    setNodes((prev) => {
      const next = prev.map((n) => ({ ...n }));
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const dx = next[j].x - next[i].x, dy = next[j].y - next[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const f = 380 / (dist * dist);
          next[i].vx -= (dx / dist) * f; next[i].vy -= (dy / dist) * f;
          next[j].vx += (dx / dist) * f; next[j].vy += (dy / dist) * f;
        }
      }
      for (const e of edges) {
        const s = next.find(n => n.id === e.source), t = next.find(n => n.id === e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        s.vx += dx * 0.018; s.vy += dy * 0.018; t.vx -= dx * 0.018; t.vy -= dy * 0.018;
      }
      for (const n of next) {
        if (n.id === 'primary') continue;
        n.vx += (177 - n.x) * 0.004; n.vy += (130 - n.y) * 0.004;
        n.vx *= 0.87; n.vy *= 0.87;
        n.x = Math.max(14, Math.min(340, n.x + n.vx));
        n.y = Math.max(14, Math.min(246, n.y + n.vy));
      }
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [edges]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    const stop = setTimeout(() => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, 5000);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); clearTimeout(stop); };
  }, [tick]);

  const colorMap = { primary: 'rgba(0,210,255,0.5)', platform: 'rgba(255,255,255,0.16)', breach: 'rgba(255,59,48,0.4)', alias: 'rgba(255,255,255,0.1)' };
  const strokeMap = { primary: 'rgba(0,210,255,0.9)', platform: 'rgba(255,255,255,0.22)', breach: 'rgba(255,59,48,0.8)', alias: 'rgba(255,255,255,0.15)' };
  const rMap = { primary: 22, platform: 13, breach: 14, alias: 10 };

  return (
    <div className="bg-surface2 border border-border rounded-xl overflow-hidden relative">
      <svg width="100%" height="260" viewBox="0 0 354 260">
        <defs>
          <pattern id="gg" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0L0 0 0 22" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="354" height="260" fill="url(#gg)" />
        {edges.map(e => {
          const s = nodes.find(n => n.id === e.source), t = nodes.find(n => n.id === e.target);
          if (!s || !t) return null;
          return <line key={`${e.source}-${e.target}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={e.target.startsWith('breach') ? 'rgba(255,59,48,0.18)' : 'rgba(0,210,255,0.1)'} strokeWidth="1" strokeDasharray="3 3" />;
        })}
        {nodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={rMap[n.type]} fill={colorMap[n.type]} stroke={strokeMap[n.type]} strokeWidth="1.2" />
            {n.type === 'primary' && <circle cx={n.x} cy={n.y} r={rMap[n.type] + 7} fill="none" stroke="rgba(0,210,255,0.15)" strokeWidth="1" />}
            <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.85)" fontSize={n.type === 'primary' ? 7.5 : 6.5} fontWeight={n.type === 'primary' ? '700' : '500'} fontFamily="monospace">{n.label}</text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <div className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
        <span className="text-[8px] text-green font-semibold font-mono">LIVE GRAPH</span>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DossierScreen() {
  const { getActiveDossier, dossiers, setActiveDossierId, pivotScan } = useStore();
  const dossier = getActiveDossier();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    confirmed: true,
    quicklinks: true,
    facial: false,
    exif: false,
    graph: false,
    emails: true,
  });

  useEffect(() => {
    setOpenSections({ confirmed: true, quicklinks: true, facial: false, exif: false, graph: false, emails: true });
  }, [dossier?.id]);

  const toggle = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

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
          <span className="badge badge-muted">Real API Lookups</span>
          <span className="badge badge-muted">EXIF Analysis</span>
          <span className="badge badge-muted">Threat Graph</span>
        </div>
      </div>
    );
  }

  const riskColor = dossier.riskLabel === 'Critical' ? 'text-red' : dossier.riskLabel === 'High' ? 'text-amber' : 'text-green';
  const verifiedPlatforms = dossier.platforms.filter(p => p.status === 'verified');
  const notFoundPlatforms = dossier.platforms.filter(p => p.status === 'not_found');

  return (
    <div className="px-[18px] pt-3 pb-28 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className={`text-[10px] font-semibold tracking-[1.5px] uppercase mb-0.5 ${riskColor}`}>{dossier.riskLabel} Exposure</p>
          <h1 className="text-[26px] font-bold text-t1 tracking-tight leading-none">Dossier</h1>
        </div>
        <div className="flex gap-2">
          {dossiers.length > 1 && (
            <select className="h-9 px-2 bg-surface2 border border-border rounded-[10px] text-t3 text-[10px] cursor-pointer" onChange={(e) => setActiveDossierId(e.target.value)} value={dossier.id}>
              {dossiers.map(d => <option key={d.id} value={d.id}>{d.displayName} · {new Date(d.createdAt).toLocaleDateString()}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Target card */}
      <div className="card p-4 border-border-strong">
        <div className="flex items-center gap-[14px]">
          <div className="relative flex-shrink-0">
            <div className="w-[60px] h-[60px] rounded-2xl bg-surface3 border border-border-strong overflow-hidden flex items-center justify-center">
              {dossier.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={dossier.imageUrl} alt="Subject" className="w-full h-full object-cover" />
                : <PersonIcon />}
            </div>
            <div className={`absolute -bottom-[2px] -right-[2px] w-[10px] h-[10px] rounded-full border-2 border-bg ${dossier.riskLabel === 'Critical' ? 'bg-red' : 'bg-amber'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold text-t1 mb-[2px]">{dossier.displayName}</p>
            <div className="flex gap-[5px] flex-wrap mt-1">
              <span className={`badge ${dossier.riskLabel === 'Critical' ? 'badge-red' : 'badge-amber'}`}>{dossier.riskLabel} Risk</span>
              <span className="badge badge-green">{verifiedPlatforms.length} Confirmed</span>
              {notFoundPlatforms.length > 0 && <span className="badge badge-muted">{notFoundPlatforms.length} Not Found</span>}
            </div>
          </div>
          {/* Risk ring */}
          <div className="relative w-[80px] h-[80px] flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80" className="rotate-[-90deg]">
              <defs>
                <linearGradient id="rg2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF3B30" /><stop offset="100%" stopColor="#FF9F0A" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="33" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
              <circle cx="40" cy="40" r="33" fill="none" stroke="url(#rg2)" strokeWidth="5" strokeLinecap="round" strokeDasharray="207" strokeDashoffset={207 * (1 - dossier.riskScore / 100)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[17px] font-bold text-t1">{dossier.riskScore}%</p>
              <p className="text-[8px] font-semibold text-t3 uppercase tracking-[0.5px]">Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: verifiedPlatforms.length, l: 'Confirmed', c: 'text-green' },
          { v: notFoundPlatforms.length, l: 'Not Found', c: 'text-t3' },
          { v: dossier.quickLinks.length, l: 'To Check', c: 'text-amber' },
        ].map(({ v, l, c }) => (
          <div key={l} className="card p-[10px] text-center">
            <p className={`text-[18px] font-bold ${c}`}>{v}</p>
            <p className="text-[9px] text-t3 font-semibold uppercase tracking-[0.5px] mt-[2px]">{l}</p>
          </div>
        ))}
      </div>

      {/* ── EMAIL NODES ── */}
      {dossier.emailNodes.length > 0 && (
        <Accordion
          id="emails"
          open={openSections.emails ?? false}
          onToggle={() => toggle('emails')}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          }
          title="Discovered Email Addresses"
          sub={`${dossier.emailNodes.length} associated accounts`}
        >
          <div className="space-y-2">
            {dossier.emailNodes.map(email => (
              <div key={email} className="bg-surface2 border border-border rounded-xl p-[10px] flex items-center justify-between">
                <div className="flex items-center gap-[10px]">
                  <div className="w-[30px] h-[30px] bg-surface3 rounded-lg flex items-center justify-center text-t2 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-t1 font-mono">{email}</p>
                    <p className="text-[10px] text-t3 mt-[2px]">Primary Contact Node</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); pivotScan(email, 'email'); }}
                  className="bg-accent/10 border border-accent/20 text-accent text-[10px] font-semibold px-3 py-1.5 rounded-lg hover:bg-accent/20 active:scale-95 transition-all"
                >
                  Pivot Scan
                </button>
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* ── CONFIRMED PLATFORMS (real API) ── */}
      <Accordion
        id="confirmed"
        open={openSections.confirmed}
        onToggle={() => toggle('confirmed')}
        icon={<GlobeIcon />}
        title="Confirmed by Real API"
        sub={
          verifiedPlatforms.length > 0
            ? `${verifiedPlatforms.length} profile${verifiedPlatforms.length > 1 ? 's' : ''} confirmed · ${notFoundPlatforms.length} not found`
            : 'No profiles confirmed on scanned platforms'
        }
        badge={<span className="text-[9px] font-bold text-green bg-green/10 px-1.5 py-0.5 rounded-full">REAL DATA</span>}
      >
        {dossier.platforms.length === 0 ? (
          <div className="card-sm p-4 text-center">
            <p className="text-[12px] font-semibold text-t2 mb-1">API scan returned no results</p>
            <p className="text-[11px] text-t4">This could mean the username doesn&apos;t exist on GitHub, Reddit, HackerNews, Dev.to, npm, or Keybase — or the API is rate-limited.</p>
          </div>
        ) : (
          <div className="space-y-[6px]">
            {verifiedPlatforms.map(p => <PlatformCard key={p.platform} platform={p} />)}
            {notFoundPlatforms.map(p => <PlatformCard key={p.platform} platform={p} />)}
          </div>
        )}
      </Accordion>

      {/* ── MANUAL QUICK LINKS ── */}
      {dossier.quickLinks.length > 0 && (
        <Accordion
          id="quicklinks"
          open={openSections.quicklinks}
          onToggle={() => toggle('quicklinks')}
          icon={<LinkIcon />}
          title="Check Manually"
          sub="Tap any platform to verify if the profile exists"
          badge={<span className="text-[9px] font-bold text-amber bg-amber/10 px-1.5 py-0.5 rounded-full">UNVERIFIED</span>}
        >
          {/* Notice */}
          <div className="bg-amber/[0.06] border border-amber/20 rounded-xl p-[10px] mb-2">
            <p className="text-[11px] text-t2 leading-relaxed">
              These platforms (<strong>Instagram, TikTok, LinkedIn</strong>, etc.) use JavaScript rendering which makes server-side verification impossible without official API access. Tap each link — you&apos;ll instantly see if the profile exists.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-[6px]">
            {dossier.quickLinks.map(link => <QuickLinkCard key={link.platform} link={link} />)}
          </div>
        </Accordion>
      )}

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
            {dossier.facialMatches.map(m => (
              <div key={m.source} className="bg-surface2 border border-border rounded-xl overflow-hidden">
                <div className="h-[80px] bg-surface3 flex items-center justify-center relative overflow-hidden">
                  {dossier.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={dossier.imageUrl} alt="Match" className="w-full h-full object-cover opacity-60" />
                    : <PersonIcon size={28} />}
                  <span className="badge badge-blue absolute top-2 right-2">{m.confidence}%</span>
                </div>
                <div className="p-[8px]">
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

      {/* ── EXIF ── */}
      <Accordion
        id="exif"
        open={openSections.exif}
        onToggle={() => toggle('exif')}
        icon={<WarningIcon />}
        iconBg={dossier.exif ? 'bg-red/10 border border-red/20' : 'bg-surface3'}
        title="Metadata & EXIF Risks"
        sub={dossier.exif ? 'Real metadata extracted from uploaded file' : 'No EXIF data — image may be clean or stripped'}
        subColor={dossier.exif ? 'text-red' : 'text-t3'}
      >
        {!dossier.exif ? (
          <div className="card-sm p-4 text-center">
            <p className="text-[13px] font-semibold text-t2 mb-1">No Embedded EXIF Metadata Found</p>
            <p className="text-[11px] text-t4 leading-relaxed">The file headers contain no metadata. The image has been stripped, screenshotted, or captured by a privacy-preserving app.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dossier.exif.gps && (
              <div className="bg-red/[0.08] border border-red/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-red tracking-[0.5px] mb-[5px]">⚠ GPS COORDINATES EXPOSED</p>
                <p className="font-mono text-[12px] text-t1 mb-2">{dossier.exif.gps.latitude.toFixed(6)}° N, {dossier.exif.gps.longitude.toFixed(6)}° E</p>
              </div>
            )}
            {(dossier.exif.device?.make || dossier.exif.image?.timestamp) && (
              <div className="bg-amber/[0.08] border border-amber/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber tracking-[0.5px] mb-2">⚠ DEVICE FINGERPRINT LEAKED</p>
                {[
                  { k: 'Make', v: dossier.exif.device?.make },
                  { k: 'Model', v: dossier.exif.device?.model },
                  { k: 'Software', v: dossier.exif.device?.software },
                  { k: 'Captured', v: dossier.exif.image?.timestamp, mono: true },
                ].filter(r => r.v).map(({ k, v, mono }) => (
                  <div key={k} className="row py-[3px]">
                    <span className="text-[11px] text-t3">{k}</span>
                    <span className={`text-[11px] text-t1 font-medium ${mono ? 'font-mono' : ''}`}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Accordion>

      {/* ── THREAT GRAPH ── */}
      <Accordion
        id="graph"
        open={openSections.graph}
        onToggle={() => toggle('graph')}
        icon={<GraphIcon />}
        title="Threat Shadow Map"
        sub={`${verifiedPlatforms.length} confirmed nodes · ${dossier.breaches.length} breach links`}
        badge={<span className="flex items-center gap-1"><span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse inline-block" /><span className="text-[9px] font-semibold text-green">LIVE</span></span>}
      >
        <div className="space-y-3">
          <DynamicGraph dossier={dossier} />
          {dossier.breaches.length > 0 && (
            <div>
              <p className="sec-label mb-2">Known Data Breaches</p>
              {dossier.breaches.map(b => (
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

// ─── Platform Card (confirmed API results only) ───────────────────────────────

function PlatformCard({ platform: p }: { platform: PlatformResult }) {
  const { pivotScan } = useStore();
  const isFound = p.status === 'verified';
  return (
    <div className={`bg-surface2 border rounded-xl p-[10px] transition-opacity ${isFound ? 'border-border' : 'border-border opacity-40'}`}>
      <div className="flex items-center gap-[10px]">
        <div className="w-[34px] h-[34px] bg-surface3 rounded-[10px] flex items-center justify-center text-base flex-shrink-0">{p.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px]">
            <div className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${isFound ? 'bg-green' : 'bg-t4'}`} />
            <span className="text-[13px] font-medium text-t1">{p.platform}</span>
            <span className="text-[8px] text-green font-bold bg-green/10 px-1.5 py-0.5 rounded-full">REAL API</span>
          </div>
          <p className="text-[10px] text-t3 font-mono mt-[1px]">{p.handle}</p>
          {p.realData && p.metadata && (
            <div className="flex gap-2 flex-wrap mt-[4px]">
              {p.metadata.followers && <span className="text-[9px] text-t4">{p.metadata.followers} followers</span>}
              {p.metadata.repos && <span className="text-[9px] text-t4">{p.metadata.repos} repos</span>}
              {p.metadata.karma && <span className="text-[9px] text-t4">{p.metadata.karma} karma</span>}
              {p.metadata.location && <span className="text-[9px] text-t4">📍 {p.metadata.location}</span>}
              {p.metadata.joined && <span className="text-[9px] text-t4">Joined {p.metadata.joined}</span>}
            </div>
          )}
        </div>
        <span className={`badge flex-shrink-0 text-[9px] ${isFound ? 'badge-green' : 'badge-muted'}`}>
          {isFound ? 'Confirmed' : 'Not Found'}
        </span>
      </div>
      {isFound && (
        <div className="mt-[8px] flex gap-2">
          {p.profileUrl && (
            <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-[6px] py-[7px] rounded-[9px] bg-green/10 border border-green/25 text-[11px] font-semibold text-green hover:bg-green/15 active:scale-[0.98] transition-all">
              <ExternalLinkIcon />Open Profile
            </a>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); pivotScan(p.handle, 'name'); }}
            className="flex-1 flex items-center justify-center gap-[6px] py-[7px] rounded-[9px] bg-accent/10 border border-accent/25 text-[11px] font-semibold text-accent hover:bg-accent/15 active:scale-[0.98] transition-all"
          >
            Pivot Scan
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Quick Link Card (manual check) ──────────────────────────────────────────

function QuickLinkCard({ link }: { link: QuickLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-[10px] bg-surface2 border border-border rounded-xl p-[10px] hover:border-border-strong hover:bg-surface2/80 active:scale-[0.98] transition-all group"
    >
      <div className="w-[34px] h-[34px] bg-surface3 rounded-[10px] flex items-center justify-center text-base flex-shrink-0">{link.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-t1">{link.platform}</p>
        <p className="text-[10px] text-t3 font-mono">{link.handle}</p>
      </div>
      <div className="flex items-center gap-1 text-t3 group-hover:text-t2 transition-colors flex-shrink-0">
        <span className="text-[10px] font-medium">Tap to check</span>
        <ExternalLinkIcon />
      </div>
    </a>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({ open, onToggle, icon, iconBg, title, sub, subColor, badge, children }: {
  id: string; open: boolean; onToggle: () => void; icon: React.ReactNode; iconBg?: string;
  title: string; sub: string; subColor?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-[13px] cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-[10px]">
          <div className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center ${iconBg ?? 'bg-surface3'}`}>{icon}</div>
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
      <div className="overflow-hidden transition-all duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ maxHeight: open ? '2000px' : '0px' }}>
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PersonIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-t3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function FileIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-t3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function GlobeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
}
function LinkIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
}
function FaceIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>;
}
function WarningIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5"><path d="m10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function GraphIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-t2"><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="19" r="2" /><line x1="14.12" y1="10.88" x2="17.42" y2="6.58" /><line x1="9.88" y1="13.12" x2="6.58" y2="17.42" /><line x1="14.12" y1="13.12" x2="17.42" y2="17.42" /><line x1="9.88" y1="10.88" x2="6.58" y2="6.58" /></svg>;
}
function ExternalLinkIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}
