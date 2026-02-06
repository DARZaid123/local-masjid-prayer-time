import { User, AppData, Role } from '../types.ts';
import { getCloudData, syncToCloud } from './storage.ts';

const SESSION_TOKEN = 'masjid_session_active_v2';
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

interface SessionData {
  user: User;
  expiry: number;
}

/**
 * Validates credentials against the current cloud-synced user list.
 * This is the ONLY source of truth for logins.
 */
export const authenticate = async (email: string, password: string): Promise<User | null> => {
  const data = await getCloudData();
  const user = data.users.find(
    u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
  );

  if (user && user.enabled) {
    // Return a sanitized user object (no password)
    const sessionUser = { ...user };
    delete sessionUser.password;
    
    // Create session with expiry
    const session: SessionData = {
        user: sessionUser,
        expiry: Date.now() + SESSION_TIMEOUT_MS
    };

    localStorage.setItem(SESSION_TOKEN, JSON.stringify(session));
    return sessionUser;
  }

  return null;
};

/**
 * Returns the currently logged-in user from the session if valid.
 * Also extends the session expiry since the user is active (loading the app).
 */
export const getActiveSession = (): User | null => {
  try {
    const stored = localStorage.getItem(SESSION_TOKEN);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    
    // Normalize data (handle migration from old format where parsed was just User)
    let session: SessionData;
    if (parsed.user && typeof parsed.expiry === 'number') {
        session = parsed;
    } else {
        // Legacy format fallback: Treat as a fresh session
        session = {
            user: parsed,
            expiry: Date.now() + SESSION_TIMEOUT_MS
        };
    }

    // Check Expiry
    if (Date.now() > session.expiry) {
        clearSession();
        return null;
    }

    // Extend Session
    extendSession();
    return session.user;
  } catch (e) {
    clearSession();
    return null;
  }
};

/**
 * Checks if the current session is valid without extending it.
 * Used for background polling.
 */
export const isSessionValid = (): boolean => {
    try {
        const stored = localStorage.getItem(SESSION_TOKEN);
        if (!stored) return false;
        
        const parsed = JSON.parse(stored);
        
        // Legacy handling
        if (!parsed.expiry && parsed.email) return true;

        return Date.now() < parsed.expiry;
    } catch {
        return false;
    }
};

/**
 * Resets the 20-minute timer.
 * Should be called on user activity.
 */
export const extendSession = () => {
    try {
        const stored = localStorage.getItem(SESSION_TOKEN);
        if (!stored) return;

        const parsed = JSON.parse(stored);
        
        // Extract user object regardless of format
        const user = parsed.user || parsed;
        
        const newSession: SessionData = {
            user,
            expiry: Date.now() + SESSION_TIMEOUT_MS
        };
        
        localStorage.setItem(SESSION_TOKEN, JSON.stringify(newSession));
    } catch {
        // Ignore errors during extension
    }
};

/**
 * Clears the session on the local device.
 */
export const clearSession = () => {
  localStorage.removeItem(SESSION_TOKEN);
};

/**
 * Updates a user's credentials in the master cloud data.
 */
export const updateCloudUser = async (userId: string, updates: Partial<User>): Promise<void> => {
  const data = await getCloudData();
  const userIndex = data.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    throw new Error('User not found.');
  }

  // Validate Email Uniqueness if changing email
  if (updates.email) {
    const newEmail = updates.email.trim();
    const existing = data.users.find(u => 
      u.email.toLowerCase() === newEmail.toLowerCase() && 
      u.id !== userId
    );
    if (existing) {
      throw new Error('Email already taken by another admin.');
    }
    updates.email = newEmail;
  }

  data.users[userIndex] = { ...data.users[userIndex], ...updates };
  await syncToCloud(data);
  
  // If the logged-in user updated their own profile, update local session
  const activeUser = getActiveSession();
  if (activeUser && activeUser.id === userId) {
    const updatedUser = { ...activeUser, ...updates };
    delete updatedUser.password;
    
    const session: SessionData = {
        user: updatedUser,
        expiry: Date.now() + SESSION_TIMEOUT_MS
    };
    localStorage.setItem(SESSION_TOKEN, JSON.stringify(session));
  }
};

/**
 * Adds a new admin to the master cloud list.
 * This ensures the new user is a real authenticated user with role=ADMIN.
 */
export const registerCloudAdmin = async (email: string, password: string): Promise<void> => {
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const data = await getCloudData();
  
  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
    throw new Error('An admin with this email already exists.');
  }

  const newUser: User = {
    id: `admin-${Date.now()}`,
    email: email.trim(),
    password: password, // Save exact password entered
    role: Role.ADMIN,   // Assign role = admin
    enabled: true
  };

  data.users.push(newUser);
  await syncToCloud(data);
};