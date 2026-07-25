'use client';

import { useStore } from '@/store/useStore';
import type { AppSettings } from '@/lib/types';

const SCAN_SETTINGS: { key: keyof AppSettings; label: string; sub: string }[] = [
  { key: 'stealthMode', label: 'Stealth Mode', sub: 'Route via Tor network' },
  { key: 'proxyRotation', label: 'Proxy Rotation', sub: '10s IP cycle interval' },
  { key: 'autoArchive', label: 'Auto-Archive Results', sub: 'Encrypted local storage' },
  { key: 'realtimeAlerts', label: 'Real-time Alerts', sub: 'Push breach notifications' },
];

const API_CONNECTIONS = [
  { icon: '🔑', name: 'Shodan API', status: 'Connected', color: 'text-green' },
  { icon: '🔍', name: 'Hunter.io', status: 'Connected', color: 'text-green' },
  { icon: '🛡️', name: 'HaveIBeenPwned', status: 'Connected', color: 'text-green' },
  { icon: '👁️', name: 'PimEyes API', status: 'Rate Limited', color: 'text-amber' },
];

export function SettingsScreen() {
  const { settings, toggleSetting, dossiers } = useStore();

  const totalScans = dossiers.length;
  const usagePct = Math.min(100, Math.round((totalScans / 100) * 100));

  return (
    <div className="px-[18px] pt-3 pb-28 space-y-3">
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold text-t4 tracking-[2px] uppercase mb-0.5">Configuration</p>
        <h1 className="text-[26px] font-bold text-t1 tracking-tight leading-none">Settings</h1>
      </div>

      {/* Profile card */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-[14px]">
          <div className="w-[50px] h-[50px] bg-accent rounded-[14px] flex items-center justify-center text-[16px] font-bold text-white flex-shrink-0">
            PT
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-t1">Operator Profile</p>
            <p className="text-[11px] text-t3">Elite Tier · Unlimited Scans</p>
            <p className="text-[10px] text-green font-medium mt-[2px]">API Keys Active</p>
          </div>
          <span className="badge badge-blue">PRO</span>
        </div>
        <div className="bg-surface3 rounded-[10px] p-3">
          <div className="flex justify-between mb-[6px]">
            <span className="text-[11px] text-t3">Sessions Archived</span>
            <span className="text-[11px] text-t1 font-medium">{totalScans} / ∞</span>
          </div>
          <div className="h-[4px] bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, usagePct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scan Engine */}
      <p className="sec-label">Scan Engine</p>
      <div className="card px-[14px] py-0">
        {SCAN_SETTINGS.map(({ key, label, sub }) => (
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

      {/* API Connections */}
      <p className="sec-label">API Connections</p>
      <div className="card px-[14px] py-0">
        {API_CONNECTIONS.map(({ icon, name, status, color }) => (
          <div key={name} className="row">
            <div className="flex items-center gap-[10px]">
              <div className="w-[28px] h-[28px] bg-surface3 rounded-[8px] flex items-center justify-center text-[13px]">
                {icon}
              </div>
              <div>
                <p className="text-[13px] font-medium text-t1">{name}</p>
                <p className={`text-[10px] ${color}`}>{status}</p>
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-t4">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        ))}
      </div>

      {/* Stats */}
      <p className="sec-label">Session Stats</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="card p-3 text-center">
          <p className="text-[22px] font-bold text-t1">{totalScans}</p>
          <p className="text-[9px] text-t3 font-semibold uppercase tracking-[0.5px] mt-[2px]">Scans Run</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[22px] font-bold text-t1">{dossiers.reduce((a, d) => a + d.breaches.length, 0)}</p>
          <p className="text-[9px] text-t3 font-semibold uppercase tracking-[0.5px] mt-[2px]">Breaches Found</p>
        </div>
      </div>

      {/* Danger Zone */}
      <p className="sec-label" style={{ color: 'rgba(229,72,77,0.5)' }}>Danger Zone</p>
      <div className="card px-[14px] py-0 border-red/20">
        <button
          className="row w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            if (confirm('Purge all dossiers? This cannot be undone.')) {
              useStore.setState({ dossiers: [], activeDossierId: null });
            }
          }}
        >
          <span className="text-[13px] font-medium text-red">Purge All Dossiers</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <div className="row">
          <span className="text-[13px] font-medium text-red">Reset API Credentials</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>

      {/* Version */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[11px] text-t4">PersonaTrace v2.4.1 · Build 20240315</p>
        <p className="text-[10px] text-t4 opacity-50 mt-[3px]">For authorized security research only</p>
      </div>
    </div>
  );
}
