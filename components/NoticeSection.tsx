import React from 'react';
import { Notice } from '../types';
import { Icons } from './Icons';

interface NoticeSectionProps {
  notices: Notice[];
}

export const NoticeSection: React.FC<NoticeSectionProps> = ({ notices }) => {
  if (notices.length === 0) return null;

  return (
    <div className="mt-10 px-1">
      <div className="flex items-center gap-3 mb-4 px-2">
        <div className="p-2 bg-emerald-100 rounded-xl">
          <Icons.Bell />
        </div>
        <h2 className="text-xl font-black text-gray-800 tracking-tight">Community Notices</h2>
      </div>

      <div className="space-y-4">
        {notices.map((notice) => (
          <div 
            key={notice.id} 
            className={`p-6 rounded-3xl border transition-all ${
              notice.isImportant 
                ? 'bg-amber-50 border-amber-100 shadow-sm' 
                : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {notice.isImportant && (
                  <span className="bg-amber-400 text-[9px] font-black uppercase text-amber-900 px-2 py-0.5 rounded-full">
                    Important
                  </span>
                )}
                <h3 className="font-extrabold text-gray-900 text-lg leading-tight">
                  {notice.title}
                </h3>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {new Date(notice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-medium">
              {notice.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
