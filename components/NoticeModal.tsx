import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Notice } from '../types';
import { Icons } from './Icons';

// Individual Card Component to handle Expand/Collapse State locally
const NoticeCard: React.FC<{ notice: Notice }> = ({ notice }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Determine if message is long enough to require truncation
  const isLong = notice.message.length > 100; 

  const toggleExpand = (e: React.MouseEvent) => {
    if (isLong) {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div 
      onClick={toggleExpand}
      className={`p-5 rounded-none border bg-white relative overflow-hidden group transition-all duration-200 ${
        isLong ? 'cursor-pointer hover:bg-gray-50' : ''
      } ${
        notice.isImportant 
          ? 'border-l-[6px] border-l-amber-400 border-y-amber-100 border-r-amber-100' 
          : 'border-l-[6px] border-l-emerald-600 border-y-gray-200 border-r-gray-200'
      }`}
    >
      {/* Background Icon Watermark */}
      <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none transform rotate-12 scale-125">
          {notice.isImportant ? <Icons.Star filled /> : <Icons.Info />}
      </div>

      <div className="flex gap-4 items-start relative z-10">
        {/* Compact Calendar Date Block */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center bg-white border border-gray-200 w-[52px] shadow-sm mt-0.5">
            <div className={`w-full h-1.5 ${notice.isImportant ? 'bg-amber-500' : 'bg-emerald-700'}`}></div>
            <div className="py-2 text-center w-full">
              <span className="block text-lg font-black text-gray-800 leading-none">
                  {new Date(notice.date).getDate()}
              </span>
              <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  {new Date(notice.date).toLocaleDateString('en-US', { month: 'short' })}
              </span>
            </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Header Area */}
          <div className="flex flex-col gap-1 mb-2">
            {notice.isImportant && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-600 w-fit mb-0.5">
                <Icons.Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Important
              </span>
            )}
            <h3 className="font-black text-gray-900 text-lg font-islamic leading-tight break-words">
              {notice.title}
            </h3>
          </div>
          
          {/* Message Content with Truncation */}
          <div className={`text-gray-600 text-sm leading-relaxed font-medium transition-all duration-300 relative ${
            !isExpanded && isLong ? 'line-clamp-2 max-h-[3rem] overflow-hidden' : ''
          }`}>
             {notice.message}
          </div>

          {/* Expiry Date Indicator (New) */}
          {notice.expiryDate && (
             <div className="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Icons.Calendar className="w-3 h-3 text-gray-300" />
                <span>Expires: {new Date(notice.expiryDate).toLocaleDateString()}</span>
             </div>
          )}

          {/* Expand/Collapse Trigger */}
          {isLong && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 group-hover:text-emerald-800 transition-colors">
              <span>{isExpanded ? 'Show Less' : 'Read Full Notice'}</span>
              <div className={`transition-transform duration-300 ${isExpanded ? '-rotate-90' : 'rotate-90'}`}>
                 <Icons.ChevronRight />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  notices: Notice[];
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ isOpen, onClose, notices }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-emerald-950/90 backdrop-blur-md transition-all">
       {/* Pattern Overlay on Backdrop */}
       <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg width="100%" height="100%">
                <pattern id="pattern-modal" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="white"/>
                </pattern>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-modal)" />
            </svg>
      </div>

      {/* Click outside to close handler */}
      <div className="absolute inset-0" onClick={onClose}></div>

      <div 
        className="w-full max-w-lg bg-gray-50 rounded-none shadow-2xl flex flex-col max-h-[85vh] animate-scale-in border-4 border-emerald-800 relative z-10"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
      >
        <div className="bg-white px-5 py-4 border-b-2 border-emerald-100 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800 text-white rounded-none shadow-md">
              <Icons.Bell className="w-5 h-5" />
            </div>
            <div>
                 <h2 className="text-xl font-black text-gray-900 tracking-tight font-islamic leading-none">Notices</h2>
                 <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">Community Board</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all rounded-none border border-gray-200"
          >
            <Icons.Close />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar scroll-smooth">
          {notices.length === 0 ? (
            <div className="text-center py-16 opacity-40 flex flex-col items-center justify-center h-full">
              <Icons.Bell className="w-12 h-12 text-gray-400 mb-3 stroke-1" />
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">No active notices</p>
            </div>
          ) : (
            notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))
          )}
        </div>
      </div>
      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        /* Styled Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f9fafb;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #d1fae5;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #10b981;
        }
      `}</style>
    </div>,
    document.body
  );
};