export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
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
