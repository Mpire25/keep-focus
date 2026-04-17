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

export interface ElementBlockingRule {
  domain: string;
  selectors: string[];
  enabled: boolean;
  option?: string; // Stable identifier for the blocking option (e.g. 'shorts', 'suggestedVideos')
}

// { 'youtube.com': 3600000, 'reddit.com': 900000 }
export type ScreenTimeDayEntry = Record<string, number>;

// { '2026-04-17': { 'youtube.com': 3600000 }, ... }
export type ScreenTimeHistory = Record<string, ScreenTimeDayEntry>;

export interface ExtensionData {
  blockedSites: BlockedSite[];
  unlockedUntil: UnlockedUntil;
  focusStreak: number;
  timeLimits: TimeLimit[];
  timeTracking: TimeTracking;
  darkMode: boolean;
  elementBlockingRules: ElementBlockingRule[];
  screenTimeEnabled: boolean;
  screenTimeHistory: ScreenTimeHistory;
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

