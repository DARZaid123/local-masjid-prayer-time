import { AppData, Role } from '../types.ts';

// Using a stable bucket ID for the shared database
const DB_VERSION = 'v5_features';
// Updated to a potentially active public bucket or placeholder
const BUCKET_ID = 'masjid_app_demo_v1'; 
const CLOUD_URL = `https://kvdb.io/${BUCKET_ID}/masjid_master_data_${DB_VERSION}`;
const OFFLINE_KEY = 'masjid_offline_sync_cache';

const INITIAL_DATA: AppData = {
  profile: {
    name: 'Masjid Al-Noor',
    area: 'Downtown Community',
  },
  prayers: {
    fajr: { azan: '05:30', iqamah: '06:00' },
    zuhr: { azan: '13:00', iqamah: '13:30' },
    asr: { azan: '16:30', iqamah: '17:00' },
    maghrib: { azan: '19:45', iqamah: '19:55' },
    isha: { azan: '21:00', iqamah: '21:30' },
  },
  jumma: {
    khutbah: '13:15',
    jamaat: '13:45',
  },
  ramadan: {
    enabled: false,
    suhoor: '04:45',
    iftar: '19:55'
  },
  notices: [
    {
      id: 'welcome-msg',
      title: 'System Connected',
      message: 'The prayer display system is online and synced.',
      date: new Date().toISOString(),
      isImportant: false
    }
  ],
  links: [],
  users: [
    {
      id: 'root-super-admin',
      email: 'darzaid700@gmail.com',
      password: 'darzaid123',
      role: Role.SUPER_ADMIN,
      enabled: true
    }
  ],
  lastUpdated: new Date().toISOString(),
};

/**
 * Fetches the most recent state from the cloud database.
 * Falls back to local cache only if the network is unavailable or cloud is empty.
 */
export const getCloudData = async (): Promise<AppData> => {
  let cloudData: AppData | null = null;

  try {
    const response = await fetch(CLOUD_URL, {
      cache: 'no-store', // Prevent browser caching of the API response
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Basic validation to ensure data structure is correct
      if (data && data.prayers && data.users) {
        // Migration: Ensure links array exists if loading old data
        if (!data.links) data.links = [];
        cloudData = data;
      }
    }
  } catch (err) {
    console.warn('Cloud fetch failed, checking offline cache:', err);
  }

  // If cloud provided data, update cache and return it
  if (cloudData) {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(cloudData));
    return cloudData;
  }

  // Fallback to local cache
  const cached = localStorage.getItem(OFFLINE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (!parsed.links) parsed.links = []; // Migration for local data
      return parsed;
    } catch (e) {
      console.warn('Corrupt local cache, resetting.');
    }
  }

  // If both cloud and local fail/empty, return initial
  return INITIAL_DATA;
};

/**
 * Saves the entire application state.
 * Uses optimistic UI updates (saves locally first) then attempts cloud sync.
 */
export const syncToCloud = async (data: AppData): Promise<void> => {
  const updatedData = {
    ...data,
    lastUpdated: new Date().toISOString()
  };

  // 1. Optimistic Save: Update local cache immediately
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(updatedData));

  try {
    const response = await fetch(CLOUD_URL, {
      method: 'POST', 
      body: JSON.stringify(updatedData),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Cloud sync skipped (Bucket 404). Data saved locally.');
        return;
      }
      throw new Error(`Sync failed with status: ${response.status}`);
    }
  } catch (err) {
    console.error('Non-critical Sync Error:', err);
  }
};