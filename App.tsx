import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppData, ViewState, Role, User, Notice, ExternalLink } from './types.ts';
import { getCloudData, syncToCloud } from './services/storage.ts';
import * as auth from './services/authService.ts';
import { Icons } from './components/Icons.tsx';
import { Header } from './components/Header.tsx';
import { PrayerRow } from './components/PrayerRow.tsx';
import { NoticeModal } from './components/NoticeModal.tsx';
import { DailyWisdom } from './components/DailyWisdom.tsx';

// Helper to convert time string HH:MM to minutes from midnight
const getMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper to convert 24h time to 12h format (1-12) with AM/PM
const formatTime = (time: string) => {
  if (!time) return '--:--';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${mStr} ${ampm}`;
};

export default function App() {
  // App State
  const [view, setView] = useState<ViewState>(ViewState.PUBLIC);
  const [data, setData] = useState<AppData | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard Management
  const [activeTab, setActiveTab] = useState<'times' | 'notices' | 'settings' | 'users'>('times');
  const [formState, setFormState] = useState<AppData | null>(null);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);

  // Settings / Links Management
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // User Management State
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingTargetUser, setEditingTargetUser] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Admin Actions State
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  
  // Notice Management State
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeExpiry, setNoticeExpiry] = useState('');
  const [isNoticeImportant, setIsNoticeImportant] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * REFRESH: Pulls latest data from cloud source of truth.
   */
  const refreshAppData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const latest = await getCloudData();
      setData(latest);
      setFormState(JSON.parse(JSON.stringify(latest)));
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  // Initialization
  useEffect(() => {
    refreshAppData();
    
    // Handle Session
    const session = auth.getActiveSession();
    if (session) {
      setCurrentUser(session);
      // We do not force view to DASHBOARD here to allow "Back" navigation.
      // If user loads app fresh and has session, they stay on Public but button says "Dashboard"
    }

    // Polling & Listeners
    // Update time every second for countdown
    const timeTimer = setInterval(() => setCurrentTime(new Date()), 1000); 
    const syncTimer = setInterval(refreshAppData, 300000); // Auto-sync every 5 mins
    
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    return () => {
      clearInterval(timeTimer);
      clearInterval(syncTimer);
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, [refreshAppData]);

  // Session Activity Monitor
  useEffect(() => {
    // Only monitor if a user is actually logged in
    if (!currentUser) return;

    // 1. Periodic check for session expiry (every 10 seconds)
    const checkInterval = setInterval(() => {
        if (!auth.isSessionValid()) {
            auth.clearSession();
            setCurrentUser(null);
            
            // Only alert/redirect if they were explicitly using the dashboard
            // If they were just viewing the public board, silent logout is better UX
            if (view === ViewState.DASHBOARD) {
                setView(ViewState.PUBLIC);
                alert("Session expired due to inactivity (20 min).");
            }
        }
    }, 10000);

    // 2. Activity Listener to reset timer
    const handleActivity = () => {
        if (currentUser) {
           auth.extendSession();
        }
    };

    // Listen for common interactions to keep session alive
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
        clearInterval(checkInterval);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
        window.removeEventListener('scroll', handleActivity);
    };
  }, [currentUser, view]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    const user = await auth.authenticate(loginEmail, loginPassword);
    if (user) {
      setCurrentUser(user);
      setView(ViewState.DASHBOARD);
      setLoginError('');
      setLoginEmail('');
      setLoginPassword('');
    } else {
      setLoginError('Invalid masjid credentials or disabled account.');
    }
    setIsSyncing(false);
  };

  const handleLogout = () => {
    // Direct logout for reliability on mobile devices (removes browser confirm dialog)
    auth.clearSession();
    setCurrentUser(null);
    setView(ViewState.PUBLIC);
  };

  /**
   * COMMIT: Push local admin changes to the cloud database.
   */
  const handleSyncUpdates = async () => {
    if (!formState) return;
    setIsSyncing(true);
    try {
      await syncToCloud(formState);
      setData(formState);
      setIsConfirmingSave(false);
      alert('Cloud synchronization successful. All devices updated.');
    } catch (err) {
      alert('Network error. Could not sync with the cloud.');
    }
    setIsSyncing(false);
  };

  // Notice Actions
  const handleDeleteNotice = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!data) return;

    if (deletingId === id) {
        // CONFIRMED DELETE
        
        // 1. Calculate New State
        const updatedNotices = data.notices.filter(n => n.id !== id);
        const updatedData = { ...data, notices: updatedNotices };

        // 2. Update UI Immediately (Optimistic)
        setData(updatedData);
        setFormState(updatedData);
        setDeletingId(null);

        // 3. Clear form if we are editing the deleted item
        if (editingNotice?.id === id) {
            setEditingNotice(null);
            setNoticeTitle('');
            setNoticeMessage('');
            setNoticeExpiry('');
            setIsNoticeImportant(false);
        }

        // 4. Sync Background
        try {
            await syncToCloud(updatedData);
        } catch (err) {
            console.error("Deletion sync failed", err);
        }
    } else {
        // FIRST CLICK - ASK FOR CONFIRMATION
        setDeletingId(id);
        // Reset confirmation state after 3 seconds if not clicked
        setTimeout(() => setDeletingId(null), 3000);
    }
  };

  // User Management Handlers
  const openEditModal = (u: User) => {
    setEditingTargetUser(u);
    setEditEmail(u.email);
    setEditPassword(u.password || '');
    setIsEditUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTargetUser) return;
    
    setIsSyncing(true);
    try {
      if (editEmail !== editingTargetUser.email) {
         // Logic handled by service
      }

      await auth.updateCloudUser(editingTargetUser.id, {
        email: editEmail,
        password: editPassword
      });
      
      await refreshAppData();

      if (currentUser && currentUser.id === editingTargetUser.id) {
         const updatedSession = auth.getActiveSession();
         if(updatedSession) setCurrentUser(updatedSession);
      }

      setIsEditUserModalOpen(false);
      setEditingTargetUser(null);
      alert('Credentials updated successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      await auth.registerCloudAdmin(newAdminEmail, newAdminPassword);
      await refreshAppData();
      setNewAdminEmail('');
      setNewAdminPassword('');
      alert('New admin registered successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Logic Memoizations
  const activeNotices = useMemo(() => {
    if (!data) return [];
    
    const now = new Date();
    // Set to beginning of day to allow notices expiring today to still show
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return data.notices
      .filter(n => {
        // If no expiry date, always show
        if (!n.expiryDate) return true;
        
        // Parse expiry date. Input type="date" gives YYYY-MM-DD
        // We create a date object from it.
        const expiry = new Date(n.expiryDate);
        
        // Check if expiry date is today or in the future
        const expiryTimestamp = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()).getTime();
        const todayTimestamp = today.getTime();

        return expiryTimestamp >= todayTimestamp;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  // Determine Next Prayer including Jumma Logic
  const nextPrayerState = useMemo(() => {
    if (!data) return null;
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isFri = now.getDay() === 5;

    // Use full object structure to allow Azan extraction later
    let schedule = [
      { name: 'Fajr', azan: data.prayers.fajr.azan, iqamah: data.prayers.fajr.iqamah },
      { name: 'Zuhr', azan: data.prayers.zuhr.azan, iqamah: data.prayers.zuhr.iqamah },
      { name: 'Asr', azan: data.prayers.asr.azan, iqamah: data.prayers.asr.iqamah },
      { name: 'Maghrib', azan: data.prayers.maghrib.azan, iqamah: data.prayers.maghrib.iqamah },
      { name: 'Isha', azan: data.prayers.isha.azan, iqamah: data.prayers.isha.iqamah },
    ];

    // On Friday, replace Zuhr with Jumma in the schedule
    if (isFri) {
       schedule = schedule.map(p => p.name === 'Zuhr' 
        ? { name: 'Jumma', azan: data.jumma.khutbah, iqamah: data.jumma.jamaat } 
        : p
       );
    }

    // Find next prayer
    let nextIndex = schedule.findIndex(p => getMinutes(p.iqamah) > currentMinutes);
    let next = nextIndex !== -1 ? schedule[nextIndex] : null;
    let isTomorrow = false;
    
    // For progress bar calculation
    let prevPrayerTime = 0;
    let nextPrayerTime = 0;

    if (!next) {
      next = schedule[0]; // Fajr tomorrow
      isTomorrow = true;
      nextIndex = 0;
      
      // Prev was Isha today
      const isha = schedule[4];
      prevPrayerTime = getMinutes(isha.iqamah); // yesterday effectively relative to tomorrow fajr
      nextPrayerTime = getMinutes(next.iqamah) + (24 * 60); // +24 hours
    } else {
       // Prev was the one before this index
       const prevIndex = nextIndex === 0 ? 4 : nextIndex - 1;
       const prev = schedule[prevIndex];
       
       prevPrayerTime = getMinutes(prev.iqamah);
       nextPrayerTime = getMinutes(next.iqamah);
       
       if (nextIndex === 0) {
           // If next is Fajr today, prev was Isha yesterday
           prevPrayerTime -= (24 * 60);
       }
    }

    let progress = 0;
    const totalDuration = nextPrayerTime - prevPrayerTime;
    const elapsed = (isTomorrow ? currentMinutes + (24 * 60) : currentMinutes) - prevPrayerTime;
    
    if (totalDuration > 0) {
        progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    }

    return { ...next, isTomorrow, progress };
  }, [data, currentTime]);

  const countdownStr = useMemo(() => {
    if (!nextPrayerState) return '--:--:--';
    const now = currentTime;
    const [h, m] = nextPrayerState.iqamah.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    
    if (nextPrayerState.isTomorrow) {
      target.setDate(target.getDate() + 1);
    }

    let diff = target.getTime() - now.getTime();
    if (diff < 0) return '00:00:00';

    const hh = Math.floor(diff / (1000 * 60 * 60));
    const mm = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const ss = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }, [nextPrayerState, currentTime]);


  if (isLoading || !data) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-emerald-950 text-white p-10 text-center relative overflow-hidden">
        {/* Background pattern for loading */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg width="100%" height="100%">
                <pattern id="pattern-hex" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M20 0L40 10V30L20 40L0 30V10L20 0Z" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-hex)" />
            </svg>
        </div>
        <Icons.Refresh className="w-16 h-16 animate-spin mb-6 text-amber-400" />
        <h2 className="text-2xl font-black font-islamic tracking-wider">Connecting to Masjid Cloud...</h2>
      </div>
    );
  }

  // --- VIEWS ---

  const renderPublic = () => {
    // Determine icon for next prayer
    let NextPrayerIcon: React.ElementType = Icons.Fajr;
    if (nextPrayerState) {
        if (nextPrayerState.name === 'Zuhr') NextPrayerIcon = Icons.Zuhr;
        else if (nextPrayerState.name === 'Asr') NextPrayerIcon = Icons.Asr;
        else if (nextPrayerState.name === 'Maghrib') NextPrayerIcon = Icons.Maghrib;
        else if (nextPrayerState.name === 'Isha') NextPrayerIcon = Icons.Isha;
        else if (nextPrayerState.name === 'Jumma') NextPrayerIcon = Icons.Jumma;
    }

    return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-20 relative">
      {/* GLOBAL BACKGROUND PATTERN */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0">
         <svg width="100%" height="100%">
             <pattern id="pattern-islamic" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                 <path d="M30 0L60 30L30 60L0 30L30 0Z" fill="none" stroke="#065f46" strokeWidth="1"/>
                 <circle cx="30" cy="30" r="10" fill="none" stroke="#065f46" strokeWidth="1"/>
             </pattern>
             <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-islamic)" />
         </svg>
      </div>

      <div className="w-full max-w-xl bg-white/80 backdrop-blur-sm min-h-screen shadow-2xl relative flex flex-col border-x border-gray-200">
        <Header 
          profile={data.profile} 
          onNoticeClick={() => setIsNoticeModalOpen(true)}
          noticeCount={activeNotices.length}
          hasUnreadNotices={activeNotices.length > 0}
        />

        <div className="px-5 mt-2 relative z-10 flex-1 space-y-4">
          
          {/* TOP SECTION: NEXT PRAYER - SQUARE PROFESSIONAL CARD */}
          <div className="mt-4 bg-white rounded-none border-2 border-emerald-800 relative overflow-hidden group">
             {/* Progress Bar Background */}
             <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full z-20">
                <div 
                    className="h-full bg-amber-400 transition-all duration-1000 ease-linear" 
                    style={{ width: `${nextPrayerState?.progress}%` }}
                ></div>
             </div>

             <div className="relative z-10 p-6">
                {/* Header Row */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">Next Prayer</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <NextPrayerIcon />
                             <h2 className="text-4xl font-black font-islamic text-gray-900 leading-none">{nextPrayerState?.name}</h2>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Begins In</span>
                        <span className="font-mono text-2xl font-black text-emerald-700 block tracking-tight">
                            {countdownStr}
                        </span>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-px bg-gray-200 border border-gray-200">
                    <div className="bg-gray-50 p-4 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <Icons.Bell className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                {nextPrayerState?.name === 'Jumma' ? 'Khutbah' : 'Azan'}
                            </span>
                        </div>
                        <span className="text-xl font-bold tabular-nums text-gray-800">{formatTime(nextPrayerState?.azan || '')}</span>
                    </div>
                    
                    <div className="bg-emerald-900 p-4 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-emerald-800 transform rotate-45 translate-y-10 translate-x-10 opacity-50"></div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="flex items-center gap-2 mb-1">
                                <Icons.Users className="w-3 h-3 text-emerald-400" />
                                <span className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">
                                    {nextPrayerState?.name === 'Jumma' ? 'Jamaat' : 'Jamaat'}
                                </span>
                            </div>
                            <span className="text-2xl font-black tabular-nums text-white">{formatTime(nextPrayerState?.iqamah || '')}</span>
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* MIDDLE SECTION: DAILY PRAYERS */}
          <div className="bg-white rounded-none border border-gray-200 overflow-hidden shadow-sm">
             {/* TABLE HEADER - NEW */}
<<<<<<< HEAD
             <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                 <div className="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Prayer</div>
                 <div className="flex flex-shrink-0 ml-2 text-right">
                     <div className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Azan</div>
                     <div className="w-28 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600 pl-1">Jamaat</div>
=======
             <div className="flex items-center justify-between px-3 sm:px-5 py-3 bg-gray-50 border-b border-gray-200">
                 <div className="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Prayer</div>
                 <div className="flex flex-shrink-0 ml-1 sm:ml-2 text-right">
                     <div className="w-16 sm:w-24 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Azan</div>
                     <div className="w-20 sm:w-28 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600 pl-1">Jamaat</div>
>>>>>>> a238d0a (Initial commit)
                 </div>
             </div>

             {(['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'] as const).map((p, idx) => (
               <div key={p} className={idx !== 4 ? 'border-b border-gray-100' : ''}>
                   <PrayerRow 
                     name={p} 
                     azan={formatTime(data.prayers[p.toLowerCase() as keyof typeof data.prayers].azan)} 
                     iqamah={formatTime(data.prayers[p.toLowerCase() as keyof typeof data.prayers].iqamah)} 
                     Icon={Icons[p]} 
                     isNext={nextPrayerState?.name === p} 
                   />
               </div>
             ))}

             {/* BOTTOM SECTION: JUMMA (FRIDAY ONLY) - INTEGRATED STYLE */}
             {currentTime.getDay() === 5 && (
                <div className="bg-amber-50 border-t border-amber-200">
                    <PrayerRow 
                      name="Jumma" 
                      azan={formatTime(data.jumma.khutbah)} 
                      iqamah={formatTime(data.jumma.jamaat)} 
                      Icon={Icons.Jumma} 
                      isNext={nextPrayerState?.name === 'Jumma'} 
                    />
                </div>
             )}
          </div>

          {/* RAMADAN SECTION (If Enabled) */}
          {data.ramadan.enabled && (
             <div className="bg-amber-50 border-l-4 border-amber-400 rounded-none p-6 shadow-sm">
                <h3 className="text-lg font-black text-amber-900 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Icons.Isha /> Ramadan Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white border border-amber-100 p-4 text-center">
                      <div className="text-[10px] font-black text-amber-600 uppercase mb-1">Suhoor Ends</div>
                      <div className="text-2xl font-black tabular-nums text-gray-800">{formatTime(data.ramadan.suhoor)}</div>
                   </div>
                   <div className="bg-white border border-amber-100 p-4 text-center">
                      <div className="text-[10px] font-black text-amber-600 uppercase mb-1">Iftar</div>
                      <div className="text-2xl font-black tabular-nums text-gray-800">{formatTime(data.ramadan.iftar)}</div>
                   </div>
                </div>
             </div>
          )}

          <DailyWisdom />
          
          {/* QUICK LINKS SECTION (NEW) */}
          {data.links && data.links.length > 0 && (
             <div className="grid grid-cols-2 gap-3 mb-6">
                 {data.links.map(link => (
                     <a 
                       key={link.id} 
                       href={link.url} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-3 p-4 bg-white border border-gray-200 hover:border-emerald-500 transition-colors group"
                     >
                        <div className="p-2 bg-gray-50 group-hover:bg-emerald-50 transition-colors">
                            <Icons.Globe className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 group-hover:text-emerald-800">{link.title}</span>
                     </a>
                 ))}
             </div>
          )}

          {/* FOOTER */}
          <div className="text-center py-6 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-6">
               <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                 {isOnline ? 'System Live' : 'Offline Mode'}
               </span>
               <span className="text-gray-300 mx-1">•</span>
               <span className="text-[10px] font-bold text-gray-400">
                 Updated {new Date(data.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </span>
            </div>
            
            <button 
              onClick={() => {
                if (currentUser) {
                    setView(ViewState.DASHBOARD);
                } else {
                    setView(ViewState.LOGIN);
                }
              }} 
              className="text-[10px] font-black text-gray-300 hover:text-emerald-600 transition-colors uppercase tracking-[0.4em]"
            >
              {currentUser ? 'Return to Dashboard' : 'Admin Panel'}
            </button>
          </div>
        </div>

        <NoticeModal 
          isOpen={isNoticeModalOpen} 
          onClose={() => setIsNoticeModalOpen(false)} 
          notices={activeNotices} 
        />
      </div>
    </div>
  );
  };

  const renderLogin = () => (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg width="100%" height="100%">
                <pattern id="pattern-login" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="white"/>
                </pattern>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-login)" />
            </svg>
      </div>
      <div className="w-full max-w-sm bg-white rounded-none border-4 border-emerald-800 shadow-2xl p-8 relative z-10">
        <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-emerald-900 flex items-center justify-center">
                <Icons.Settings className="text-white w-8 h-8" />
            </div>
        </div>
        <h2 className="text-3xl font-black text-center mb-10 text-emerald-950 font-islamic">Masjid Admin</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Admin Email" required className="w-full p-4 bg-gray-50 border-2 border-gray-200 focus:border-emerald-800 rounded-none outline-none font-bold placeholder-gray-400" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
          <input type="password" placeholder="Password" required className="w-full p-4 bg-gray-50 border-2 border-gray-200 focus:border-emerald-800 rounded-none outline-none font-bold placeholder-gray-400" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
          {loginError && <p className="text-red-600 text-sm font-bold text-center bg-red-50 p-2">{loginError}</p>}
          <button type="submit" disabled={isSyncing} className="w-full bg-emerald-800 hover:bg-emerald-900 text-white py-4 rounded-none font-black text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg">
            {isSyncing ? <Icons.Refresh className="animate-spin" /> : 'Enter Dashboard'}
          </button>
        </form>
        <button onClick={() => setView(ViewState.PUBLIC)} className="w-full mt-6 text-gray-400 font-bold flex items-center justify-center gap-2 hover:text-emerald-800 transition-colors uppercase tracking-widest text-xs">
          <Icons.Back /> Return to Display
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-emerald-900 text-white p-6 pb-20 shadow-lg flex justify-between items-start border-b-4 border-amber-400">
        <div>
          <h2 className="text-2xl font-black font-islamic">Board Manager</h2>
          <p className="text-sm opacity-80 font-mono">{currentUser?.email}</p>
          <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-800 rounded-none text-[9px] font-black uppercase tracking-widest border border-emerald-700">
            {currentUser?.role.replace('_', ' ')}
          </span>
        </div>
        
        {/* Updated Header Buttons: Text Only Back Button & Top Right Logout */}
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setView(ViewState.PUBLIC)} 
                className="text-xs font-black uppercase tracking-widest text-emerald-300 hover:text-white transition-colors px-2 py-2"
            >
                BACK
            </button>
            <button 
                onClick={handleLogout} 
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-none text-xs font-black uppercase tracking-widest shadow-lg transition-all border border-red-400"
            >
                LOGOUT
            </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full -mt-10 px-5 pb-32">
        <div className="flex bg-white rounded-none p-1 shadow-xl mb-6 border border-gray-200">
           <button onClick={() => setActiveTab('times')} className={`flex-1 py-3 rounded-none font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'times' ? 'bg-emerald-800 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Times</button>
           <button onClick={() => setActiveTab('notices')} className={`flex-1 py-3 rounded-none font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'notices' ? 'bg-emerald-800 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Notices</button>
           <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 rounded-none font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'settings' ? 'bg-emerald-800 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Settings</button>
           <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 rounded-none font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'users' ? 'bg-emerald-800 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Users</button>
        </div>

        {activeTab === 'times' && (
          <div className="bg-white rounded-none p-6 shadow-xl border border-gray-200 space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-gray-400 uppercase text-xs tracking-widest">Prayer Schedule</h3>
              <button onClick={() => setIsConfirmingSave(true)} className="bg-emerald-600 text-white px-6 py-2 rounded-none font-black text-sm shadow-lg active:scale-95 hover:bg-emerald-700 transition-colors">Save & Push</button>
            </div>
            
            <div className="space-y-6">
               {(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const).map(p => (
                 <div key={p} className="flex items-center gap-4">
                   <div className="w-16 font-black capitalize text-gray-700">{p}</div>
                   <div className="flex-1">
                      <span className="text-[9px] font-black text-gray-400 block mb-1">AZAN</span>
                      <input type="time" value={formState?.prayers[p].azan} onChange={e => {
                        const next = { ...formState! };
                        next.prayers[p].azan = e.target.value;
                        setFormState(next);
                      }} className="w-full p-3 bg-gray-50 rounded-none font-mono text-center outline-none border-2 border-gray-200 focus:border-emerald-500" />
                   </div>
                   <div className="flex-1">
                      <span className="text-[9px] font-black text-emerald-600 block mb-1">JAMAAT</span>
                      <input type="time" value={formState?.prayers[p].iqamah} onChange={e => {
                        const next = { ...formState! };
                        next.prayers[p].iqamah = e.target.value;
                        setFormState(next);
                      }} className="w-full p-3 bg-emerald-50 rounded-none font-mono text-center text-emerald-900 font-bold border-2 border-emerald-100 outline-none focus:border-emerald-500" />
                   </div>
                 </div>
               ))}
            </div>

            <div className="pt-8 border-t border-gray-100">
              <h3 className="font-black text-emerald-600 uppercase text-[10px] tracking-widest mb-4">Jumma Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <span className="text-[9px] font-black text-gray-400 block mb-1 uppercase">Khutbah</span>
                   <input type="time" value={formState?.jumma.khutbah} onChange={e => setFormState({...formState!, jumma: {...formState!.jumma, khutbah: e.target.value}})} className="w-full p-3 bg-gray-50 rounded-none font-mono text-center border-2 border-gray-200" />
                </div>
                <div>
                   <span className="text-[9px] font-black text-emerald-600 block mb-1 uppercase">Jamaat</span>
                   <input type="time" value={formState?.jumma.jamaat} onChange={e => setFormState({...formState!, jumma: {...formState!.jumma, jamaat: e.target.value}})} className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 rounded-none font-mono text-center font-bold" />
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-amber-600 uppercase text-[10px] tracking-widest">Ramadan Mode</h3>
                <button onClick={() => setFormState({...formState!, ramadan: {...formState!.ramadan, enabled: !formState!.ramadan.enabled}})} className={`px-4 py-1.5 rounded-none text-[10px] font-black uppercase transition-all ${formState?.ramadan.enabled ? 'bg-amber-400 text-amber-900' : 'bg-gray-100 text-gray-400'}`}>
                   {formState?.ramadan.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <div className={`grid grid-cols-2 gap-4 transition-opacity ${formState?.ramadan.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                 <input type="time" value={formState?.ramadan.suhoor} onChange={e => setFormState({...formState!, ramadan: {...formState!.ramadan, suhoor: e.target.value}})} className="p-3 bg-gray-50 rounded-none font-mono text-center border border-gray-200" />
                 <input type="time" value={formState?.ramadan.iftar} onChange={e => setFormState({...formState!, ramadan: {...formState!.ramadan, iftar: e.target.value}})} className="p-3 bg-gray-50 rounded-none font-mono text-center border border-gray-200" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && formState && (
            <div className="space-y-6">
                <div className="bg-white rounded-none p-6 shadow-xl border border-gray-200">
                    <h3 className="text-xl font-black text-gray-900 mb-6 font-islamic">Masjid Profile</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Masjid Name</label>
                            <input 
                                type="text" 
                                value={formState.profile.name} 
                                onChange={e => setFormState({...formState, profile: {...formState.profile, name: e.target.value}})}
                                className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:border-emerald-500 outline-none font-bold text-gray-800"
                                placeholder="e.g. Masjid Al-Noor"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Area / Subtitle</label>
                            <input 
                                type="text" 
                                value={formState.profile.area} 
                                onChange={e => setFormState({...formState, profile: {...formState.profile, area: e.target.value}})}
                                className="w-full p-4 bg-gray-50 border-2 border-gray-100 focus:border-emerald-500 outline-none font-bold text-gray-800"
                                placeholder="e.g. Downtown Community"
                            />
                        </div>
                        <button onClick={() => setIsConfirmingSave(true)} className="w-full bg-emerald-800 text-white py-4 font-black uppercase tracking-widest text-xs hover:bg-emerald-900 transition-colors">
                            Update Profile
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-none p-6 shadow-xl border border-gray-200">
                    <h3 className="text-xl font-black text-gray-900 mb-6 font-islamic">Quick Links</h3>
                    
                    <div className="space-y-3 mb-6">
                        {formState.links && formState.links.length > 0 ? (
                            formState.links.map(link => (
                                <div key={link.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Icons.Globe className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        <div className="truncate">
                                            <p className="font-bold text-sm text-gray-900">{link.title}</p>
                                            <p className="text-xs text-gray-400 truncate">{link.url}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const updatedLinks = formState.links.filter(l => l.id !== link.id);
                                            setFormState({...formState, links: updatedLinks});
                                        }}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <Icons.Trash />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400 text-sm py-4 italic">No links added yet.</p>
                        )}
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                         <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Add New Link</h4>
                         <div className="space-y-3">
                             <input 
                                 placeholder="Title (e.g. Donate)" 
                                 value={newLinkTitle}
                                 onChange={e => setNewLinkTitle(e.target.value)}
                                 className="w-full p-3 bg-gray-50 border-2 border-gray-100 focus:border-emerald-500 outline-none font-bold text-sm"
                             />
                             <input 
                                 placeholder="URL (https://...)" 
                                 value={newLinkUrl}
                                 onChange={e => setNewLinkUrl(e.target.value)}
                                 className="w-full p-3 bg-gray-50 border-2 border-gray-100 focus:border-emerald-500 outline-none font-mono text-sm"
                             />
                             <button 
                                 disabled={!newLinkTitle || !newLinkUrl}
                                 onClick={() => {
                                     const newLink: ExternalLink = {
                                         id: Date.now().toString(),
                                         title: newLinkTitle,
                                         url: newLinkUrl
                                     };
                                     setFormState({
                                         ...formState,
                                         links: [...(formState.links || []), newLink]
                                     });
                                     setNewLinkTitle('');
                                     setNewLinkUrl('');
                                 }}
                                 className="w-full py-3 bg-gray-800 text-white font-black text-xs uppercase tracking-widest hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                                 Add Link
                             </button>
                         </div>
                    </div>
                     <div className="mt-6">
                        <button onClick={() => setIsConfirmingSave(true)} className="w-full bg-emerald-600 text-white py-4 font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'notices' && (
          <div className="space-y-6">
            <div className="bg-white rounded-none p-8 shadow-xl border border-gray-200">
              <h3 className="text-xl font-black text-emerald-950 mb-6">{editingNotice ? 'Edit Notice' : 'Post Community Notice'}</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!formState) return;
                const nextNotices = [...formState.notices];
                const notice: Notice = {
                  id: editingNotice?.id || Date.now().toString(),
                  title: noticeTitle,
                  message: noticeMessage,
                  date: new Date().toISOString(),
                  expiryDate: noticeExpiry || undefined, // Add Expiry
                  isImportant: isNoticeImportant
                };
                if (editingNotice) {
                  const idx = nextNotices.findIndex(n => n.id === editingNotice.id);
                  nextNotices[idx] = notice;
                } else {
                  nextNotices.unshift(notice);
                }
                const updated = { ...formState, notices: nextNotices };
                await syncToCloud(updated);
                setData(updated);
                setFormState(updated); // Sync form state
                setEditingNotice(null);
                setNoticeTitle('');
                setNoticeMessage('');
                setNoticeExpiry('');
                setIsNoticeImportant(false);
                alert('Notice published globally.');
              }} className="space-y-4">
                <input placeholder="Title" required value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} className="w-full p-4 bg-gray-50 rounded-none font-black outline-none focus:border-emerald-500 border-2 border-gray-200" />
                <textarea placeholder="Message" required value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} className="w-full p-4 bg-gray-50 rounded-none min-h-[120px] outline-none focus:border-emerald-500 border-2 border-gray-200 font-medium" />
                
                {/* Expiry Date Input */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Expiry Date (Optional)</label>
                        <input 
                            type="date" 
                            value={noticeExpiry} 
                            onChange={e => setNoticeExpiry(e.target.value)} 
                            className="w-full p-4 bg-gray-50 rounded-none font-bold outline-none focus:border-emerald-500 border-2 border-gray-200 text-gray-600" 
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-4 border border-gray-200">
                   <span className="font-bold text-gray-700">Mark as Important</span>
                   <button type="button" onClick={() => setIsNoticeImportant(!isNoticeImportant)} className={`w-14 h-8 rounded-full transition-all relative ${isNoticeImportant ? 'bg-amber-400' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-sm ${isNoticeImportant ? 'right-1' : 'left-1'}`}></div>
                   </button>
                </div>
                <button type="submit" disabled={isSyncing} className="w-full bg-emerald-800 text-white py-4 rounded-none font-black shadow-lg hover:bg-emerald-900 transition-colors">
                  {isSyncing ? <Icons.Refresh className="animate-spin" /> : 'Broadcast & Sync'}
                </button>
                {editingNotice && (
                   <button type="button" onClick={() => {
                        setEditingNotice(null); 
                        setNoticeTitle(''); 
                        setNoticeMessage(''); 
                        setNoticeExpiry('');
                        setIsNoticeImportant(false);
                   }} className="w-full py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">Cancel Edit</button>
                )}
              </form>
            </div>

            <div className="space-y-4">
               {data.notices.map(n => (
                 <div key={n.id} className={`bg-white p-6 rounded-none border border-gray-200 flex justify-between items-start shadow-sm hover:border-emerald-200 transition-colors ${n.isImportant ? 'border-l-4 border-l-amber-400' : ''}`}>
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        {n.isImportant && <Icons.Star filled />}
                        <h4 className="font-black text-gray-900">{n.title}</h4>
                      </div>
                      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-2">{n.message}</p>
                      {n.expiryDate && (
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              Expires: {new Date(n.expiryDate).toLocaleDateString()}
                          </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => { 
                          setEditingNotice(n); 
                          setNoticeTitle(n.title); 
                          setNoticeMessage(n.message); 
                          setNoticeExpiry(n.expiryDate || '');
                          setIsNoticeImportant(n.isImportant); 
                          window.scrollTo({top: 0, behavior: 'smooth'}); 
                      }} className="p-3 bg-gray-50 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"><Icons.Edit /></button>
                      
                      <button 
                        type="button"
                        onClick={(e) => handleDeleteNotice(e, n.id)} 
                        className={`p-3 rounded transition-all duration-200 flex items-center gap-2 ${
                            deletingId === n.id 
                            ? 'bg-red-600 text-white w-auto px-4 shadow-md' 
                            : 'bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <Icons.Trash />
                        {deletingId === n.id && <span className="text-xs font-bold uppercase animate-pulse">Confirm</span>}
                      </button>

                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8">
            {currentUser?.role === Role.SUPER_ADMIN && (
              <div className="bg-white rounded-none p-8 shadow-xl border border-gray-200">
                <h3 className="text-xl font-black mb-6">Create New Admin</h3>
                <form onSubmit={handleRegisterAdmin} className="space-y-4">
                  <input type="email" placeholder="Email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="w-full p-4 bg-gray-50 rounded-none font-bold border-2 border-gray-200 focus:border-emerald-500 outline-none" />
                  <input type="password" placeholder="Temporary Password" required value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="w-full p-4 bg-gray-50 rounded-none font-bold border-2 border-gray-200 focus:border-emerald-500 outline-none" />
                  <button type="submit" disabled={isSyncing} className="w-full bg-emerald-800 text-white py-4 rounded-none font-black shadow-lg flex justify-center items-center gap-2 hover:bg-emerald-900 transition-colors">
                    {isSyncing ? <Icons.Refresh className="animate-spin" /> : 'Register & Push'}
                  </button>
                </form>
              </div>
            )}

            <div className="space-y-4">
               {data.users
                  .filter(u => currentUser?.role === Role.SUPER_ADMIN || u.id === currentUser?.id)
                  .map(u => (
                 <div key={u.id} className="bg-white p-6 rounded-none border border-gray-200 shadow-sm flex flex-col gap-4">
                   <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                           <p className="font-black text-gray-900 text-lg">{u.email}</p>
                           {u.id === currentUser?.id && <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-none font-black uppercase">You</span>}
                        </div>
                        <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${u.role === Role.SUPER_ADMIN ? 'text-amber-600' : 'text-emerald-600'}`}>{u.role}</p>
                        
                        <div className="mt-3 flex items-center gap-2 bg-gray-50 p-2 border border-gray-200">
                           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Password:</span>
                           <span className="font-mono font-bold text-gray-700 select-all">{u.password}</span>
                        </div>
                      </div>
                      
                      {currentUser?.role === Role.SUPER_ADMIN && u.id !== currentUser?.id && (
                        <button onClick={async () => {
                          await auth.updateCloudUser(u.id, { enabled: !u.enabled });
                          refreshAppData();
                        }} className={`px-4 py-2 rounded-none text-[10px] font-black uppercase shadow-sm transition-all active:scale-95 ${u.enabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                          {u.enabled ? 'Disable' : 'Enable'}
                        </button>
                      )}
                   </div>

                   <div className="pt-4 border-t border-gray-100">
                      <button onClick={() => openEditModal(u)} className="w-full py-3 bg-gray-50 rounded-none text-[10px] font-black text-gray-600 uppercase hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                        <Icons.Edit /> Edit Credentials
                      </button>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {isConfirmingSave && (
        <div className="fixed inset-0 bg-emerald-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
           <div className="bg-white rounded-none p-10 w-full max-w-sm text-center shadow-2xl border-4 border-emerald-600">
              <div className="w-16 h-16 bg-emerald-100 flex items-center justify-center mx-auto mb-6 text-emerald-600 rounded-none"><Icons.Save /></div>
              <h4 className="text-2xl font-black mb-2 text-gray-900">Push to All Devices?</h4>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">This will update the prayer board for all community members instantly.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleSyncUpdates} disabled={isSyncing} className="w-full bg-emerald-600 text-white py-5 rounded-none font-black text-lg shadow-xl active:scale-95 flex items-center justify-center gap-3">
                   {isSyncing ? <Icons.Refresh className="animate-spin" /> : 'Confirm & Push'}
                </button>
                <button onClick={() => setIsConfirmingSave(false)} className="w-full py-4 text-gray-400 font-black hover:text-gray-600 transition-colors">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {isEditUserModalOpen && (
        <div className="fixed inset-0 bg-emerald-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-white rounded-none p-8 w-full max-w-sm shadow-2xl border-4 border-gray-200">
              <h3 className="text-xl font-black mb-6 text-gray-900">Edit User Credentials</h3>
              <form onSubmit={handleSaveUser} className="space-y-4">
                 <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                    <input type="email" required value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-4 bg-gray-50 rounded-none font-bold border-2 border-gray-200 focus:border-emerald-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Password</label>
                    <input type="text" required value={editPassword} onChange={e => setEditPassword(e.target.value)} className="w-full p-4 bg-gray-50 rounded-none font-bold border-2 border-gray-200 focus:border-emerald-500 outline-none" />
                 </div>
                 <div className="pt-4 flex flex-col gap-3">
                    <button type="submit" disabled={isSyncing} className="w-full bg-emerald-600 text-white py-4 rounded-none font-black shadow-lg flex justify-center hover:bg-emerald-700 transition-colors">
                       {isSyncing ? <Icons.Refresh className="animate-spin" /> : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setIsEditUserModalOpen(false)} className="w-full py-3 text-gray-400 font-bold hover:text-gray-600">Cancel</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {view === ViewState.PUBLIC && renderPublic()}
      {view === ViewState.LOGIN && renderLogin()}
      {view === ViewState.DASHBOARD && renderDashboard()}
    </>
  );
}