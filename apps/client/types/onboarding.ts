export interface OnboardingStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** How far a seller has got with setting up their shop. */
export interface Onboarding {
  steps: OnboardingStep[];
  done: number;
  total: number;
  percent: number;
}

export interface OnboardingRow {
  id: number;
  name: string;
  phone: string | null;
  joinedAt: string;
  done: number;
  total: number;
  percent: number;
  missing: string[];
}

export interface OnboardingList {
  results: OnboardingRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: { sellers: number; complete: number; averagePercent: number };
}
