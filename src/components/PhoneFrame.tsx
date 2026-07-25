'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { ReconScreen } from './screens/ReconScreen';
import { DossierScreen } from './screens/DossierScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'recon' | 'dossier' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'recon', label: 'Recon Hub' },
  { id: 'dossier', label: 'Dossiers' },
  { id: 'settings', label: 'Settings' },
];

export function PhoneFrame() {
  const { activeTab, setActiveTab } = useStore();
  const [time, setTime] = useState('');

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes();
      setTime(`${h}:${m < 10 ? '0' + m : m}`);
    };
    updateTime();
    const t = setInterval(updateTime, 15000);
    return () => clearInterval(t);
  }, []);

  const handleTabClick = (id: Tab) => {
    setActiveTab(id);
    // Scroll to top
    document.getElementById('main-scroller')?.scrollTo({ top: 0 });
  };

  return (
    <div className="phone-frame">
      {/* Dynamic Island */}
      <div className="island">
        <div className="island-dot" />
        <div className="island-lens" />
      </div>

      {/* Status Bar */}
      <div className="statusbar">
        <span className="st-time">{time}</span>
        <div className="flex items-center gap-[5px]">
          <span className="text-[12px] font-semibold text-white">5G</span>
          {/* Signal bars */}
          <div className="flex items-end gap-[2px]">
            {[4, 7, 10, 13].map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-[1px] bg-white"
                style={{ height: `${h}px`, opacity: i < 2 ? 0.4 + i * 0.15 : 0.75 + i * 0.1 }}
              />
            ))}
          </div>
          {/* Battery */}
          <div className="flex items-center gap-[1px]">
            <div className="w-[23px] h-[11px] border-[1.5px] border-white/60 rounded-[3px] p-[1.5px] flex items-center">
              <div className="h-full w-[76%] bg-white rounded-[1px]" />
            </div>
            <div className="w-[2px] h-[5px] bg-white/55 rounded-[0_1px_1px_0]" />
          </div>
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 overflow-hidden relative">
        <div id="main-scroller" className="h-full overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
          {/* Screens */}
          <div
            className={`screen ${activeTab === 'recon' ? 'active' : ''}`}
            style={{ display: activeTab === 'recon' ? 'block' : 'none' }}
          >
            <ReconScreen />
          </div>
          <div
            className={`screen ${activeTab === 'dossier' ? 'active' : ''}`}
            style={{ display: activeTab === 'dossier' ? 'block' : 'none' }}
          >
            <DossierScreen />
          </div>
          <div
            className={`screen ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ display: activeTab === 'settings' ? 'block' : 'none' }}
          >
            <SettingsScreen />
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tabbar">
        {TABS.map(({ id, label }) => {
          const isActive = activeTab === id;
          const strokeColor = isActive ? 'rgba(59,126,248,1)' : 'rgba(255,255,255,0.3)';
          return (
            <button key={id} className={`tab ${isActive ? 'active' : ''}`} onClick={() => handleTabClick(id)}>
              <div className="tab-pip" />
              {id === 'recon' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              )}
              {id === 'dossier' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              )}
              {id === 'settings' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              )}
              <span className="tab-lbl">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Home indicator */}
      <div className="flex justify-center py-[6px] pb-[10px]">
        <div className="w-[130px] h-[4px] bg-white/28 rounded-full" />
      </div>
    </div>
  );
}
