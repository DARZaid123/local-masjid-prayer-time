import React, { useMemo } from 'react';
import { MasjidProfile } from '../types';
import { Icons } from './Icons';

interface HeaderProps {
  profile: MasjidProfile;
  onNoticeClick?: () => void;
  hasUnreadNotices?: boolean;
  noticeCount?: number;
}

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Ula", "Jumada al-Thaniyah", "Rajab", "Sha‘ban",
  "Ramadan", "Shawwal", "Dhu al-Qi‘dah", "Dhu al-Hijjah"
];

export const Header: React.FC<HeaderProps> = ({ 
  profile, 
  onNoticeClick,
  hasUnreadNotices = false,
  noticeCount = 0
}) => {
  const dates = useMemo(() => {
    const today = new Date();
    const gregOptions: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };

    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    
    const parts = formatter.formatToParts(today);
    const day = parts.find(p => p.type === 'day')?.value;
    const monthIndex = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
    const year = parts.find(p => p.type === 'year')?.value;

    return {
      gregorian: today.toLocaleDateString('en-US', gregOptions),
      hijri: `${day} ${HIJRI_MONTHS[monthIndex]} ${year} AH`
    };
  }, []);

  return (
    <header className="bg-emerald-800 text-white pt-10 pb-16 px-6 rounded-b-none shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
             <path d="M0 40L40 0H20L0 20M40 40V20L20 40" stroke="white" strokeWidth="1" fill="none"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-black font-islamic leading-tight mb-1 drop-shadow-sm">
              {profile.name}
            </h1>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest opacity-80">
              {profile.area}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onNoticeClick}
              className={`p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all relative ${hasUnreadNotices ? 'animate-pulse ring-2 ring-white/30 ring-offset-2 ring-offset-emerald-800' : ''}`}
              aria-label="Community Notices"
            >
              <Icons.Bell className="text-white w-6 h-6" />
              {noticeCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full shadow-md border-2 border-emerald-800 text-[10px] font-black ${hasUnreadNotices ? 'bg-amber-400 text-amber-900' : 'bg-emerald-600 text-white'}`}>
                  {noticeCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-0.5">
          <p className="text-sm font-bold text-emerald-100 tracking-wide uppercase">
            {dates.gregorian}
          </p>
          <p className="text-xl font-islamic text-amber-200 font-bold">
            {dates.hijri}
          </p>
        </div>
      </div>
    </header>
  );
};