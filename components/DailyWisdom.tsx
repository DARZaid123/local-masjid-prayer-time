import React, { useEffect, useState } from 'react';
import { getDailyWisdom } from '../services/geminiService';

export const DailyWisdom: React.FC = () => {
  const [quote, setQuote] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have a quote cached for today to avoid API spam
    const today = new Date().toDateString();
    const cached = localStorage.getItem('daily_wisdom_cache');
    
    if (cached) {
      const { date, text } = JSON.parse(cached);
      if (date === today) {
        setQuote(text);
        setLoading(false);
        return;
      }
    }

    const fetchQuote = async () => {
      try {
        const text = await getDailyWisdom();
        setQuote(text);
        localStorage.setItem('daily_wisdom_cache', JSON.stringify({
          date: today,
          text
        }));
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, []);

  if (loading) return null;

  return (
    <div className="mx-4 mt-6 mb-8 p-6 bg-emerald-50 rounded-xl border border-emerald-100 text-center relative">
      <div className="text-emerald-200 absolute -top-4 -left-2 text-6xl font-serif leading-none">“</div>
      <p className="text-emerald-800 font-islamic text-lg italic leading-relaxed px-4">
        {quote}
      </p>
      <div className="text-emerald-200 absolute -bottom-8 -right-2 text-6xl font-serif leading-none rotate-180">“</div>
      <p className="text-xs text-emerald-500 mt-3 uppercase tracking-widest font-semibold">Daily Reflection</p>
    </div>
  );
};
