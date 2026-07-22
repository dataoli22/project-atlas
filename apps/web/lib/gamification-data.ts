import type { ApiDataSource } from "@/lib/api";
import { requestJson } from "@/lib/api";

type DataEnvelope<T> = {
  data: T;
  source: ApiDataSource;
};

type StreakSummaryApiResponse = {
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string | null;
  active_today: boolean;
};

type AchievementProgressApiResponse = {
  id: string;
  title: string;
  description: string;
  category: string;
  unlocked: boolean;
  unlocked_at: string | null;
  progress_current: number;
  progress_target: number;
};

type GamificationSummaryApiResponse = {
  streak: StreakSummaryApiResponse;
  achievements: AchievementProgressApiResponse[];
  unlocked_count: number;
  total_count: number;
};

export type StreakSummaryData = {
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveDate: string | null;
  activeToday: boolean;
};

export type AchievementProgressData = {
  id: string;
  title: string;
  description: string;
  category: "endurance" | "nutrition" | "connections";
  unlocked: boolean;
  unlockedAt: string | null;
  progressCurrent: number;
  progressTarget: number;
};

export type GamificationSummaryData = {
  streak: StreakSummaryData;
  achievements: AchievementProgressData[];
  unlockedCount: number;
  totalCount: number;
};

const streakFallback: StreakSummaryApiResponse = {
  current_streak_days: 0,
  longest_streak_days: 0,
  last_active_date: null,
  active_today: false
};

// Same category/id set as apps/api/app/features/gamification/service.py's _ACHIEVEMENT_DEFS -
// only used when the backend is unreachable, so the page still renders a sensible locked state
// instead of an empty list.
const achievementsFallback: AchievementProgressApiResponse[] = [
  { id: "first_session", title: "First Activity Synced", description: "Synced your first activity from a connected health app.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 1 },
  { id: "ten_sessions", title: "Building Momentum", description: "Synced 10 activities.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 10 },
  { id: "century_sessions", title: "Century Club", description: "Synced 100 activities.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 100 },
  { id: "distance_50", title: "50K Club", description: "Logged 50 cumulative kilometers across synced activities.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 50 },
  { id: "distance_250", title: "250K Club", description: "Logged 250 cumulative kilometers across synced activities.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 250 },
  { id: "week_streak", title: "One Week Strong", description: "Reached a 7-day activity streak.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 7 },
  { id: "month_streak", title: "Consistency Champion", description: "Reached a 30-day activity streak.", category: "endurance", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 30 },
  { id: "first_swap", title: "Recipe Explorer", description: "Swapped your first planned meal.", category: "nutrition", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 1 },
  { id: "ten_swaps", title: "Menu Curator", description: "Swapped 10 planned meals.", category: "nutrition", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 10 },
  { id: "plan_refresh", title: "Fresh Start", description: "Refreshed your nutrition plan.", category: "nutrition", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 1 },
  { id: "connected_app", title: "Linked Up", description: "Connected and synced a health app for the first time.", category: "connections", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 1 },
  { id: "multi_source", title: "Multi-Source Athlete", description: "Synced activity data from 2 or more connected apps.", category: "connections", unlocked: false, unlocked_at: null, progress_current: 0, progress_target: 2 }
];

function mapSummary(response: GamificationSummaryApiResponse): GamificationSummaryData {
  return {
    streak: {
      currentStreakDays: response.streak.current_streak_days,
      longestStreakDays: response.streak.longest_streak_days,
      lastActiveDate: response.streak.last_active_date,
      activeToday: response.streak.active_today
    },
    achievements: response.achievements.map((achievement) => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      category: achievement.category as AchievementProgressData["category"],
      unlocked: achievement.unlocked,
      unlockedAt: achievement.unlocked_at,
      progressCurrent: achievement.progress_current,
      progressTarget: achievement.progress_target
    })),
    unlockedCount: response.unlocked_count,
    totalCount: response.total_count
  };
}

export async function getGamificationSummaryData(): Promise<DataEnvelope<GamificationSummaryData>> {
  const result = await requestJson<GamificationSummaryApiResponse>("/api/v1/gamification/summary", {
    fallback: {
      streak: streakFallback,
      achievements: achievementsFallback,
      unlocked_count: 0,
      total_count: achievementsFallback.length
    }
  });

  return { data: mapSummary(result.data), source: result.source };
}
