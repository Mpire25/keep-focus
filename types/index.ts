// Core type definitions for Keep Focus extension

export interface BlockedSite {
  url: string;
  blockChildren?: boolean;
}

export interface TimeLimit {
  url: string;
  limitMinutes: number;
}

export interface TimeTrackingData {
  date: string;
  timeSpent: number;
  lastActive: number;
}

export type UnlockedUntil = Record<string, number>;

export type TimeTracking = Record<string, TimeTrackingData>;

export interface ExtensionData {
  blockedSites: BlockedSite[];
  unlockedUntil: UnlockedUntil;
  focusStreak: number;
  timeLimits: TimeLimit[];
  timeTracking: TimeTracking;
  darkMode: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FormResult {
  success: boolean;
  blockedSites?: BlockedSite[];
  timeLimits?: TimeLimit[];
  timeTracking?: TimeTracking;
}

