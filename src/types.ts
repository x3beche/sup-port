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

// --- Okuma / Kütüphane modülü ---
export type Shelf = 'reading' | 'to_read' | 'finished';

/** Aramadan/lookup'tan gelen aday kitap (henüz kütüphanede değil). */
export type BookCandidate = {
  key: string | null;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  cover_url: string | null;
  cover_source: string | null;
  page_count: number | null;
  published_year: number | null;
  publisher: string | null;
  subjects: string[];
  language: string | null;
  description: string | null;
  source: string;
};

/** Kullanıcının kütüphanesindeki kitap. */
export type LibraryBook = {
  book_key: string;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  cover_url: string | null;
  cover_source: string | null;
  page_count: number | null;
  published_year: number | null;
  publisher: string | null;
  subjects: string[];
  language: string | null;
  description: string | null;
  source: string | null;
  shelf: Shelf;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  added_at: string | null;
};

export type ShelfCounts = { reading: number; to_read: number; finished: number };

export type BooksResponse = { counts: ShelfCounts; books: LibraryBook[] };

export type SearchResponse = { query: string; count: number; results: BookCandidate[] };

export type ReadingSession = {
  id: string;
  book_key: string | null;
  duration_min: number | null;
  pages: number | null;
};

export type SessionsResponse = {
  date: string;
  sessions: ReadingSession[];
  total_min: number;
  total_pages: number;
};

export type ReadingGoal = {
  year: number;
  target_books: number;
  completed_books: number;
  target_pages: number | null;
  ratio: number;
  is_custom: boolean;
};

export type ReadingStats = {
  finished_count: number;
  finished_this_year: number;
  total_pages: number;
  total_minutes: number;
  top_authors: { name: string; count: number }[];
  top_subjects: { name: string; count: number }[];
  avg_rating: number | null;
  monthly: { month: string; minutes: number }[];
  streak: number;
  best_streak: number;
  next_milestone: number | null;
};

export type ReadingInsight = {
  source: string;
  headline: string;
  on_track: boolean;
  completed_books: number;
  target_books: number;
  notes: string[];
  summary?: string;
};

export type OkumaMeta = {
  shelves: { key: Shelf; label: string }[];
  default_target_books: number;
  cover_attribution: string;
  cover_attribution_url: string;
};

// --- Genel kullanıcı profili (modüller arası paylaşılan vücut bilgileri) ---
export type UserProfile = {
  age: number | null;
  sex: 'erkek' | 'kadin' | null;
  height_cm: number | null;
  activity_level: string | null;
  goal: 'ver' | 'koru' | 'al' | null;
  target_weight_kg: number | null;
  asian_thresholds: boolean;
  weight_kg: number | null;
  waist_cm: number | null;
  bmi: number | null;
  bmi_category: string | null;
  bmi_label: string | null;
  measured_at: string | null;
  has_body_info: boolean;
};

export type ProfileTimelinePoint = {
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  bmi: number | null;
  bmi_category: string | null;
};

export type ProfileTimeline = {
  count: number;
  trend_kg: number | null;
  points: ProfileTimelinePoint[];
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
  /** Mağazada "Yakında" olarak görünür; henüz kurulamaz. */
  coming_soon: boolean;
};

// --- Yemek / Beslenme modülü ---
export type MealType = 'kahvalti' | 'ogle' | 'aksam' | 'atistirma';
export type FoodSource = 'local' | 'openfoodfacts' | 'usda_fdc' | 'vision_llm' | 'manual';

export type Macros = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

/** Arama/barkod sonucu — değerler 100 g başınadır. */
export type Food = {
  key: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  per: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  default_serving_g?: number | null;
  source: FoodSource;
  source_ref?: string | null;
  attribution?: string;
};

export type MealItem = {
  id: string;
  meal_type: MealType;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  qty_g: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  source: FoodSource;
  source_ref?: string | null;
  /** Fotoğraf tahmini öğesi: arayüzde "tahmini" rozetiyle gösterilir. */
  estimated: boolean;
  confidence?: number | null;
};

export type MealGroup = {
  meal_type: MealType;
  label: string;
  items: MealItem[];
  subtotal: Macros;
};

export type MealDay = {
  date: string;
  meals: MealGroup[];
  totals: Macros;
  meal_count: number;
  meal_target: number;
};

export type NutritionTarget = {
  has_data: boolean;
  missing?: string[];
  goal?: 'ver' | 'koru' | 'al';
  bmr?: number;
  maintenance_kcal?: number;
  target_kcal?: number;
  floor_kcal?: number;
  floor_applied?: boolean;
  weekly_change_kg?: number;
  warning?: string | null;
  protein_g?: number;
  carb_g?: number;
  fat_g?: number;
  amdr?: Record<string, [number, number]>;
};

export type NutritionSummary = MealDay & {
  target: NutritionTarget;
  notes: { disclaimer: string; eating_disorder: string; photo: string };
  remaining_kcal?: number;
  kcal_ratio?: number;
};

export type NutritionProfile = {
  age: number | null;
  sex: 'erkek' | 'kadin' | null;
  height_cm: number | null;
  activity_level: string | null;
  goal: 'ver' | 'koru' | 'al' | null;
  target_weight_kg: number | null;
  weight_kg: number | null;
  has_body_metrics: boolean;
};

export type YemekMeta = {
  meal_types: { key: MealType; label: string }[];
  activity_levels: { key: string; label: string; factor: number }[];
  amdr: Record<string, [number, number]>;
  floor_kcal: { kadin: number; erkek: number };
  meal_target: number;
  disclaimer: string;
  eating_disorder_note: string;
  photo_note: string;
  sources: Record<string, string>;
  llm_available: boolean;
};

export type EstimateItem = {
  name: string;
  qty_g: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  confidence: number;
};

export type PhotoEstimate = {
  photo_hash: string;
  estimated: true;
  source: 'vision_llm';
  items: EstimateItem[];
  total_kcal: number;
  confidence: number;
  range_kcal: [number, number];
  note: string;
};
