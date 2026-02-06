import React from 'react';

interface PrayerRowProps {
  name: string;
  azan: string;
  iqamah: string;
  Icon: React.FC;
  isNext?: boolean;
}

export const PrayerRow: React.FC<PrayerRowProps> = ({ 
  name, 
  azan, 
  iqamah, 
  Icon, 
  isNext
}) => {
  
  // Helper to split "5:30 AM" into ["5:30", "AM"] and style them
  const formatTimeDisplay = (timeStr: string) => {
    const [time, period] = timeStr.split(' ');
    return (
      <>
        {time}
        {period && (
           <span className={`text-[8px] sm:text-xs font-extrabold tracking-widest ml-0.5 sm:ml-1 opacity-80 ${isNext ? 'text-emerald-100' : 'text-gray-400'}`}>
             {period}
           </span>
        )}
      </>
    );
  };

  return (
    <div 
      className={`
        flex items-center justify-between py-4 sm:py-5 px-3 sm:px-5 transition-all duration-300
        ${isNext 
          ? 'bg-emerald-600 text-white relative z-10 shadow-lg scale-[1.02] rounded-none sm:rounded-sm' 
          : 'bg-white text-gray-800 hover:bg-gray-50'
        }
      `}
      aria-current={isNext ? 'time' : undefined}
    >
      {/* LEFT: Identity (Icon + Name) */}
      <div className="flex items-center gap-3 sm:gap-5 flex-1 mr-1">
        <div className={`
          flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg 
          ${isNext ? 'bg-white/20 shadow-inner' : 'bg-gray-100 text-gray-600'}
        `}>
          <Icon />
        </div>
        
        <div className="flex flex-col justify-center">
          <h3 className={`text-lg sm:text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap ${isNext ? 'text-white' : 'text-gray-900'}`}>
            {name}
          </h3>
          {isNext && (
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-100 mt-0.5 sm:mt-1 animate-pulse">
              Next Prayer
            </span>
          )}
        </div>
      </div>

      {/* RIGHT: Times Grid - Fixed Widths + flex-shrink-0 to ensure perfect column alignment */}
      <div className="flex items-center flex-shrink-0 ml-1 sm:ml-2">
        
        {/* Azan Column - Width aligned with Header */}
        <div className={`flex items-center justify-center w-16 sm:w-24 border-r ${isNext ? 'border-emerald-500/50' : 'border-gray-100'}`}>
           <span className={`text-base sm:text-xl font-bold tabular-nums tracking-tight flex items-baseline ${isNext ? 'text-white' : 'text-gray-500'}`}>
             {formatTimeDisplay(azan)}
           </span>
        </div>

        {/* Jamaat Column - Width aligned with Header */}
        <div className="flex items-center justify-center w-20 sm:w-28 pl-1">
           <span className={`text-lg sm:text-[22px] font-black tabular-nums tracking-tight leading-none flex items-baseline ${isNext ? 'text-white' : 'text-gray-900'}`}>
             {formatTimeDisplay(iqamah)}
           </span>
        </div>

      </div>
    </div>
  );
};