import type {
  EnduranceDashboardData,
  EnduranceDisciplineKpiData,
  EnduranceGoal,
  EnduranceGoalRequest,
  EnduranceInsightsData,
  EnduranceSupportLink,
  EnduranceSupportResourceType,
  EnduranceTimelineData,
  EnduranceTrainingPlanData,
  EnduranceWeeklyVolumeTrendData
} from "@atlas/shared";

import type { ApiDataSource } from "@/lib/api";
import { fetchJson, requestJson } from "@/lib/api";

const stubDashboard: EnduranceDashboardData = {
  generatedAt: "2026-07-08T09:00:00Z",
  activeFeature: "endurance",
  cards: [
    { label: "Capability score", value: "72", trend: "+4 vs last week" },
    { label: "7-day load", value: "6h 40m", trend: "Within target band" },
    { label: "Recovery status", value: "Moderate", trend: "Hydration improving" }
  ],
  latestWorkout: {
    title: "Trail endurance session",
    duration: "1h 48m",
    distance: "14.2 km",
    recoveryNote: "Keep today easy and prioritize sleep plus hydration."
  },
  coachSummary:
    "Your recent load is progressing cleanly. The next useful step is a lower-stress day so the long effort converts into adaptation instead of fatigue.",
  supportLinks: [
    {
      title: "Set up Strava (authentication)",
      url: "https://developers.strava.com/docs/authentication/",
      topic: "Strava connector",
      whyRecommended:
        "Strava is not connected yet. Connecting it adds richer training and recovery signals to your endurance view.",
      resourceType: "connector-setup",
      freshnessAt: "2026-07-08T09:00:00Z"
    },
    {
      title: "Set up Health Connect",
      url: "https://developer.android.com/health-and-fitness/guides/health-connect",
      topic: "Health Connect connector",
      whyRecommended:
        "Health Connect is not connected yet. Connecting it adds richer training and recovery signals to your endurance view.",
      resourceType: "connector-setup",
      freshnessAt: "2026-07-08T09:00:00Z"
    },
    {
      title: "Set up Samsung Health",
      url: "https://developer.samsung.com/health/android",
      topic: "Samsung Health connector",
      whyRecommended:
        "Samsung Health is not connected yet. Connecting it adds richer training and recovery signals to your endurance view.",
      resourceType: "connector-setup",
      freshnessAt: "2026-07-08T09:00:00Z"
    },
    {
      title: "Runner recovery and mobility routine",
      url: "https://www.youtube.com/results?search_query=runner+recovery+mobility+routine",
      topic: "Recovery and mobility",
      whyRecommended:
        "Guided recovery and mobility work helps convert training load into adaptation and keeps stride quality consistent between sessions.",
      resourceType: "recovery",
      freshnessAt: "2026-07-08T09:00:00Z"
    },
    {
      title: "Strength training for runners",
      url: "https://www.youtube.com/results?search_query=strength+training+for+runners",
      topic: "Strength for endurance",
      whyRecommended:
        "Short strength sessions support durability and injury resilience without inflating overall endurance load.",
      resourceType: "strength",
      freshnessAt: "2026-07-08T09:00:00Z"
    },
    {
      title: "Endurance base training for beginners",
      url: "https://www.youtube.com/results?search_query=endurance+base+training+for+beginners",
      topic: "Base training",
      whyRecommended:
        "Building an aerobic base is the highest-return way to raise sustainable capacity before adding faster, higher-stress work.",
      resourceType: "base-training",
      freshnessAt: "2026-07-08T09:00:00Z"
    }
  ]
};

const stubTimeline: EnduranceTimelineData = {
  generatedAt: "2026-07-08T09:00:00Z",
  activeFeature: "endurance",
  entries: [
    { dayLabel: "Mon", sessionLabel: "Easy run", duration: "42m", load: "Low aerobic", source: "strava-stub" },
    { dayLabel: "Tue", sessionLabel: "Mobility and strength", duration: "35m", load: "Support work", source: "manual-stub" },
    { dayLabel: "Wed", sessionLabel: "Tempo intervals", duration: "1h 06m", load: "High quality", source: "google-fit-stub" },
    { dayLabel: "Thu", sessionLabel: "Recovery walk", duration: "28m", load: "Reset", source: "samsung-health-stub" }
  ]
};

const stubInsights: EnduranceInsightsData = {
  generatedAt: "2026-07-08T09:00:00Z",
  activeFeature: "endurance",
  capability: {
    headline: "Aerobic durability is trending up, while recovery rhythm still needs consistency.",
    areas: [
      { label: "Aerobic base", score: 78, direction: "+5 this week" },
      { label: "Recovery readiness", score: 64, direction: "Flat" },
      { label: "Heat and hydration resilience", score: 71, direction: "+2 this week" }
    ],
    confidence: "low",
    confidenceNote: "No connector data synced yet."
  },
  insights: [
    {
      title: "Protect the next low day",
      detail: "Your quality work is landing well, but adaptation depends on keeping the next day genuinely easy.",
      priority: "high"
    },
    {
      title: "Hydration routine is improving",
      detail: "Recent training days show fewer recovery dips when hydration is front-loaded before midday sessions.",
      priority: "medium"
    },
    {
      title: "Strength support is paying off",
      detail: "Short support sessions are helping maintain consistency without inflating overall load.",
      priority: "low"
    }
  ],
  supportLinks: stubDashboard.supportLinks,
  medicalFlags: []
};

type EnduranceSupportLinkApiResponse = {
  title: string;
  url: string;
  topic: string;
  why_recommended: string;
  resource_type: EnduranceSupportResourceType;
  freshness_at?: string | null;
};

type EnduranceDashboardApiResponse = {
  generated_at: string;
  active_feature: "endurance";
  cards: Array<{
    label: string;
    value: string;
    trend?: string | null;
  }>;
  latest_workout: {
    title: string;
    duration: string;
    distance: string;
    recovery_note: string;
  };
  coach_summary: string;
  support_links: EnduranceSupportLinkApiResponse[];
};

type EnduranceTimelineApiResponse = {
  generated_at: string;
  active_feature: "endurance";
  entries: Array<{
    day_label: string;
    session_label: string;
    duration: string;
    load: string;
    source: string;
  }>;
};

type EnduranceInsightsApiResponse = {
  generated_at: string;
  active_feature: "endurance";
  capability: {
    headline: string;
    areas: Array<{
      label: string;
      score: number;
      direction: string;
    }>;
    confidence: "high" | "medium" | "low";
    confidence_note: string;
  };
  insights: Array<{
    title: string;
    detail: string;
    priority: "high" | "medium" | "low";
  }>;
  support_links: EnduranceSupportLinkApiResponse[];
  medical_flags: Array<{
    flag_type: string;
    severity: "high" | "medium";
    message: string;
    detail: string;
  }>;
};

function mapSupportLinks(links: EnduranceSupportLinkApiResponse[]): EnduranceSupportLink[] {
  return links.map((link) => ({
    title: link.title,
    url: link.url,
    topic: link.topic,
    whyRecommended: link.why_recommended,
    resourceType: link.resource_type,
    freshnessAt: link.freshness_at ?? undefined
  }));
}

function mapDashboardResponse(response: EnduranceDashboardApiResponse): EnduranceDashboardData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    cards: response.cards.map((card) => ({
      label: card.label,
      value: card.value,
      trend: card.trend ?? undefined
    })),
    latestWorkout: {
      title: response.latest_workout.title,
      duration: response.latest_workout.duration,
      distance: response.latest_workout.distance,
      recoveryNote: response.latest_workout.recovery_note
    },
    coachSummary: response.coach_summary,
    supportLinks: mapSupportLinks(response.support_links)
  };
}

function mapTimelineResponse(response: EnduranceTimelineApiResponse): EnduranceTimelineData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    entries: response.entries.map((entry) => ({
      dayLabel: entry.day_label,
      sessionLabel: entry.session_label,
      duration: entry.duration,
      load: entry.load,
      source: entry.source
    }))
  };
}

function mapInsightsResponse(response: EnduranceInsightsApiResponse): EnduranceInsightsData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    capability: {
      headline: response.capability.headline,
      areas: response.capability.areas.map((area) => ({
        label: area.label,
        score: area.score,
        direction: area.direction
      })),
      confidence: response.capability.confidence,
      confidenceNote: response.capability.confidence_note
    },
    insights: response.insights.map((insight) => ({
      title: insight.title,
      detail: insight.detail,
      priority: insight.priority
    })),
    supportLinks: mapSupportLinks(response.support_links),
    medicalFlags: response.medical_flags.map((flag) => ({
      flagType: flag.flag_type,
      severity: flag.severity,
      message: flag.message,
      detail: flag.detail
    }))
  };
}

const DASHBOARD_FALLBACK: EnduranceDashboardApiResponse = {
  generated_at: stubDashboard.generatedAt,
  active_feature: stubDashboard.activeFeature,
  cards: stubDashboard.cards,
  latest_workout: {
    title: stubDashboard.latestWorkout.title,
    duration: stubDashboard.latestWorkout.duration,
    distance: stubDashboard.latestWorkout.distance,
    recovery_note: stubDashboard.latestWorkout.recoveryNote
  },
  coach_summary: stubDashboard.coachSummary,
  support_links: stubDashboard.supportLinks.map((link) => ({
    title: link.title,
    url: link.url,
    topic: link.topic,
    why_recommended: link.whyRecommended,
    resource_type: link.resourceType,
    freshness_at: link.freshnessAt ?? null
  }))
};

export async function getEnduranceDashboardData(): Promise<EnduranceDashboardData> {
  const response = await fetchJson<EnduranceDashboardApiResponse>("/api/v1/endurance/dashboard", {
    fallback: DASHBOARD_FALLBACK
  });

  return mapDashboardResponse(response);
}

/** Same as getEnduranceDashboardData, but also reports whether the data is live or fell back to
 * local stub data (backend unreachable) - lets the dashboard page show a visible "using local
 * example data" banner instead of silently pretending stub data is live. See lib/api.ts's
 * requestJson/ApiDataSource. Only the dashboard uses this variant so far; the same pattern is
 * worth extending to other pages' primary data fetch, tracked in production-todo.md. */
export async function getEnduranceDashboardDataWithSource(): Promise<{
  data: EnduranceDashboardData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<EnduranceDashboardApiResponse>(
    "/api/v1/endurance/dashboard",
    { fallback: DASHBOARD_FALLBACK }
  );

  return { data: mapDashboardResponse(response), source };
}

const TIMELINE_FALLBACK: EnduranceTimelineApiResponse = {
  generated_at: stubTimeline.generatedAt,
  active_feature: stubTimeline.activeFeature,
  entries: stubTimeline.entries.map((entry) => ({
    day_label: entry.dayLabel,
    session_label: entry.sessionLabel,
    duration: entry.duration,
    load: entry.load,
    source: entry.source
  }))
};

export async function getEnduranceTimelineData(): Promise<EnduranceTimelineData> {
  const response = await fetchJson<EnduranceTimelineApiResponse>("/api/v1/endurance/timeline", {
    fallback: TIMELINE_FALLBACK
  });

  return mapTimelineResponse(response);
}

/** See getEnduranceDashboardDataWithSource's doc comment - same pattern. */
export async function getEnduranceTimelineDataWithSource(): Promise<{
  data: EnduranceTimelineData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<EnduranceTimelineApiResponse>(
    "/api/v1/endurance/timeline",
    { fallback: TIMELINE_FALLBACK }
  );

  return { data: mapTimelineResponse(response), source };
}

const INSIGHTS_FALLBACK: EnduranceInsightsApiResponse = {
  generated_at: stubInsights.generatedAt,
  active_feature: stubInsights.activeFeature,
  capability: {
    headline: stubInsights.capability.headline,
    areas: stubInsights.capability.areas,
    confidence: stubInsights.capability.confidence,
    confidence_note: stubInsights.capability.confidenceNote
  },
  insights: stubInsights.insights,
  support_links: stubInsights.supportLinks.map((link) => ({
    title: link.title,
    url: link.url,
    topic: link.topic,
    why_recommended: link.whyRecommended,
    resource_type: link.resourceType,
    freshness_at: link.freshnessAt ?? null
  })),
  medical_flags: stubInsights.medicalFlags.map((flag) => ({
    flag_type: flag.flagType,
    severity: flag.severity,
    message: flag.message,
    detail: flag.detail
  }))
};

export async function getEnduranceInsightsData(): Promise<EnduranceInsightsData> {
  const response = await fetchJson<EnduranceInsightsApiResponse>("/api/v1/endurance/insights", {
    fallback: INSIGHTS_FALLBACK
  });

  return mapInsightsResponse(response);
}

/** See getEnduranceDashboardDataWithSource's doc comment - same pattern. */
export async function getEnduranceInsightsDataWithSource(): Promise<{
  data: EnduranceInsightsData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<EnduranceInsightsApiResponse>(
    "/api/v1/endurance/insights",
    { fallback: INSIGHTS_FALLBACK }
  );

  return { data: mapInsightsResponse(response), source };
}

// ---------------------------------------------------------------------------
// Goal selection, discipline-split KPIs, weekly-volume trend, training plan. All backed by real
// endpoints under /api/v1/endurance (see apps/api/app/features/endurance/router.py) - no stub
// data fallback beyond the standard "backend unreachable" empty-state fallbacks below.
// ---------------------------------------------------------------------------

type EnduranceGoalApiResponse = {
  goal_type: string;
  target_distance_km: number;
  target_time_minutes?: number | null;
  target_date?: string | null;
  note: string;
  updated_at?: string | null;
  is_set: boolean;
};

function mapGoalResponse(response: EnduranceGoalApiResponse): EnduranceGoal {
  return {
    goalType: response.goal_type as EnduranceGoal["goalType"],
    targetDistanceKm: response.target_distance_km,
    targetTimeMinutes: response.target_time_minutes ?? undefined,
    targetDate: response.target_date ?? undefined,
    note: response.note,
    updatedAt: response.updated_at ?? undefined,
    isSet: response.is_set
  };
}

const GOAL_FALLBACK: EnduranceGoalApiResponse = {
  goal_type: "",
  target_distance_km: 0,
  note: "",
  is_set: false
};

export async function getEnduranceGoalData(): Promise<{ data: EnduranceGoal; source: ApiDataSource }> {
  const { data, source } = await requestJson<EnduranceGoalApiResponse>("/api/v1/endurance/goal", {
    fallback: GOAL_FALLBACK
  });
  return { data: mapGoalResponse(data), source };
}

export async function saveEnduranceGoal(
  payload: EnduranceGoalRequest
): Promise<{ data: EnduranceGoal; source: ApiDataSource }> {
  const { data, source } = await requestJson<EnduranceGoalApiResponse>("/api/v1/endurance/goal", {
    method: "POST",
    body: {
      goal_type: payload.goalType,
      target_distance_km: payload.targetDistanceKm,
      target_time_minutes: payload.targetTimeMinutes ?? null,
      target_date: payload.targetDate ?? null,
      note: payload.note ?? ""
    },
    fallback: GOAL_FALLBACK
  });
  return { data: mapGoalResponse(data), source };
}

type EnduranceDisciplineKpiApiResponse = {
  generated_at: string;
  window_label: string;
  week: Array<{ discipline: string; session_count: number; total_distance_km: number; total_duration_minutes: number }>;
  month: Array<{ discipline: string; session_count: number; total_distance_km: number; total_duration_minutes: number }>;
  has_real_sessions: boolean;
};

const DISCIPLINE_KPI_FALLBACK: EnduranceDisciplineKpiApiResponse = {
  generated_at: "2026-07-08T09:00:00Z",
  window_label: "Last 7 days vs last 30 days",
  week: [],
  month: [],
  has_real_sessions: false
};

export async function getEnduranceDisciplineKpiData(): Promise<{
  data: EnduranceDisciplineKpiData;
  source: ApiDataSource;
}> {
  const { data, source } = await requestJson<EnduranceDisciplineKpiApiResponse>(
    "/api/v1/endurance/kpis/discipline-split",
    { fallback: DISCIPLINE_KPI_FALLBACK }
  );
  return {
    data: {
      generatedAt: data.generated_at,
      windowLabel: data.window_label,
      week: data.week.map((row) => ({
        discipline: row.discipline,
        sessionCount: row.session_count,
        totalDistanceKm: row.total_distance_km,
        totalDurationMinutes: row.total_duration_minutes
      })),
      month: data.month.map((row) => ({
        discipline: row.discipline,
        sessionCount: row.session_count,
        totalDistanceKm: row.total_distance_km,
        totalDurationMinutes: row.total_duration_minutes
      })),
      hasRealSessions: data.has_real_sessions
    },
    source
  };
}

type EnduranceWeeklyVolumeTrendApiResponse = {
  generated_at: string;
  weeks: Array<{
    week_label: string;
    week_start_date: string;
    total_distance_km: number;
    total_duration_minutes: number;
    session_count: number;
  }>;
  has_real_sessions: boolean;
};

const WEEKLY_VOLUME_TREND_FALLBACK: EnduranceWeeklyVolumeTrendApiResponse = {
  generated_at: "2026-07-08T09:00:00Z",
  weeks: [],
  has_real_sessions: false
};

export async function getEnduranceWeeklyVolumeTrendData(): Promise<{
  data: EnduranceWeeklyVolumeTrendData;
  source: ApiDataSource;
}> {
  const { data, source } = await requestJson<EnduranceWeeklyVolumeTrendApiResponse>(
    "/api/v1/endurance/kpis/weekly-volume",
    { fallback: WEEKLY_VOLUME_TREND_FALLBACK }
  );
  return {
    data: {
      generatedAt: data.generated_at,
      weeks: data.weeks.map((week) => ({
        weekLabel: week.week_label,
        weekStartDate: week.week_start_date,
        totalDistanceKm: week.total_distance_km,
        totalDurationMinutes: week.total_duration_minutes,
        sessionCount: week.session_count
      })),
      hasRealSessions: data.has_real_sessions
    },
    source
  };
}

type EnduranceTrainingPlanApiResponse = {
  generated_at: string;
  has_goal: boolean;
  goal: EnduranceGoalApiResponse | null;
  methodology_note: string;
  baseline_weekly_distance_km: number;
  sessions_by_discipline: Array<{
    discipline: string;
    sessions_per_week: number;
    focus: string;
    target_distance_km?: number | null;
  }>;
  weeks: Array<{
    week_number: number;
    label: string;
    long_session_distance_km: number;
    total_distance_km: number;
    note: string;
  }>;
};

const TRAINING_PLAN_FALLBACK: EnduranceTrainingPlanApiResponse = {
  generated_at: "2026-07-08T09:00:00Z",
  has_goal: false,
  goal: null,
  methodology_note: "",
  baseline_weekly_distance_km: 0,
  sessions_by_discipline: [],
  weeks: []
};

export async function getEnduranceTrainingPlanData(): Promise<{
  data: EnduranceTrainingPlanData;
  source: ApiDataSource;
}> {
  const { data, source } = await requestJson<EnduranceTrainingPlanApiResponse>(
    "/api/v1/endurance/training-plan",
    { fallback: TRAINING_PLAN_FALLBACK }
  );
  return {
    data: {
      generatedAt: data.generated_at,
      hasGoal: data.has_goal,
      goal: data.goal ? mapGoalResponse(data.goal) : null,
      methodologyNote: data.methodology_note,
      baselineWeeklyDistanceKm: data.baseline_weekly_distance_km,
      sessionsByDiscipline: data.sessions_by_discipline.map((row) => ({
        discipline: row.discipline,
        sessionsPerWeek: row.sessions_per_week,
        focus: row.focus,
        targetDistanceKm: row.target_distance_km ?? undefined
      })),
      weeks: data.weeks.map((week) => ({
        weekNumber: week.week_number,
        label: week.label,
        longSessionDistanceKm: week.long_session_distance_km,
        totalDistanceKm: week.total_distance_km,
        note: week.note
      }))
    },
    source
  };
}
