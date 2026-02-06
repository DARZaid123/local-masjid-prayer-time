export interface PrayerTime {
  azan: string;
  iqamah: string;
}

export interface DailyPrayers {
  fajr: PrayerTime;
  zuhr: PrayerTime;
  asr: PrayerTime;
  maghrib: PrayerTime;
  isha: PrayerTime;
}

export interface JummaTime {
  khutbah: string;
  jamaat: string;
}

export interface RamadanTime {
  enabled: boolean;
  suhoor: string;
  iftar: string;
}

export interface MasjidProfile {
  name: string;
  area: string;
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  date: string;
  expiryDate?: string;
  isImportant: boolean;
}

export interface ExternalLink {
  id: string;
  title: string;
  url: string;
}

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: Role;
  enabled: boolean;
}

export interface AppData {
  profile: MasjidProfile;
  prayers: DailyPrayers;
  jumma: JummaTime;
  ramadan: RamadanTime;
  notices: Notice[];
  users: User[];
  links: ExternalLink[]; // New feature: Quick links
  lastUpdated: string;
}

export enum ViewState {
  PUBLIC = 'PUBLIC',
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD'
}