export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

export type ModuleProgress = {
  key: string;
  title: string;
  icon: string;
  color: string;
  unit: string;
  target: number;
  default_target: number;
  is_custom_target: boolean;
  step: number;
  steps: number[];
  /** En çok dokunulan kademe; arayüzde en büyük alanı o alır. */
  favorite_step: number;
  description: string;
  value: number;
  ratio: number;
  completed: boolean;
};

export type ModuleTarget = {
  key: string;
  title: string;
  unit: string;
  target: number;
  default_target: number;
  is_custom: boolean;
};

export type DailySummary = {
  date: string;
  score: number;
  completed_count: number;
  module_count: number;
  modules: ModuleProgress[];
};

export type HistoryPoint = {
  date: string;
  value: number;
  target: number;
};

export type WeekDay = {
  date: string;
  score: number;
  completed_count: number;
  module_count: number;
  is_today: boolean;
};

export type BrushSlot = 'morning' | 'evening';

export type BrushStatus = {
  date: string;
  morning: boolean;
  evening: boolean;
  target: number;
  value: number;
  complete: boolean;
  streak: number;
  best_streak: number;
  next_milestone: number | null;
  /** Yalnızca günü tamamlayan yazımda ve kilometre taşına denk gelince dolu. */
  milestone: number | null;
  just_completed: boolean;
};

// --- Spor / Egzersiz modülü ---
export type Exercise = {
  key: string;
  name_tr: string;
  name_en: string;
  category: string;
  category_label: string;
  muscle_groups: string[];
  equipment: string;
  equipment_label: string;
  difficulty: string;
  difficulty_label: string;
  low_impact: boolean;
  met: number;
  default: { sets?: number; reps?: number; duration_sec?: number };
  steps: string[];
  cautions: string[];
  red_flags?: string[];
};

export type ExerciseList = {
  categories: { key: string; label: string }[];
  count: number;
  exercises: Exercise[];
};

export type SporProfile = {
  height_cm: number | null;
  sex: 'erkek' | 'kadin' | null;
  activity_level: string | null;
  goal: 'ver' | 'koru' | 'al' | null;
  target_weight_kg: number | null;
  asian_thresholds: boolean;
  parq_completed: boolean;
  parq_flagged: boolean;
};

export type BodyMetric = {
  date: string;
  weight_kg: number;
  waist_cm: number | null;
  bmi: number | null;
  bmi_category: string | null;
  bmi_label?: string;
  waist_risk?: string;
};

export type MetricsSummary = {
  has_data: boolean;
  profile: SporProfile;
  current?: BodyMetric;
  trend_kg?: number;
  safe_weekly_loss_kg?: [number, number];
  target_weight_kg?: number;
  to_lose_kg?: number;
  safe_min_weeks?: number;
  safe_max_weeks?: number;
};

export type WeeklyGoal = {
  week_start: string;
  week_end: string;
  active_minutes: number;
  moderate_target: number;
  moderate_upper: number;
  minutes_ratio: number;
  strength_days: number;
  strength_target: number;
  met_goal: boolean;
};

export type WorkoutItem = {
  key: string;
  name_tr: string;
  category: string;
  sets: number | null;
  reps: number | null;
  duration_sec: number | null;
  seconds: number;
  calories: number;
};

export type WorkoutResult = {
  id: string;
  date: string;
  items: WorkoutItem[];
  duration_min: number;
  calories: number;
  has_strength: boolean;
  day_total_min: number;
};

export type SporRecommendation = {
  source: string;
  bmi: number | null;
  bmi_category: string | null;
  bmi_label: string | null;
  focus: string[];
  recommended_exercise_keys: string[];
  avoid_high_impact: boolean;
  weekly_minutes_target: number;
  weekly_strength_days: number;
  notes: string[];
  disclaimer: string;
  summary?: string;
};

export type SporMeta = {
  categories: { key: string; label: string }[];
  equipment: { key: string; label: string }[];
  difficulty: { key: string; label: string }[];
  red_flags: string[];
  parq_questions: string[];
  disclaimer: string;
  who: { weekly_moderate_min: number; weekly_moderate_target: number; weekly_strength_days: number };
  safe_weekly_loss_kg: [number, number];
};

export type StoreApp = {
  key: string;
  title: string;
  icon: string;
  color: string;
  category: string;
  description: string;
  about: string;
  unit: string;
  target: number;
  installed: boolean;
};
