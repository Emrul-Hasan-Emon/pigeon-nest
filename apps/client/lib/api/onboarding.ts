import { http, sellerHttp } from './http';
import type { Onboarding, OnboardingList } from '@/types/onboarding';

export const getMyOnboarding = () => sellerHttp.get<Onboarding>('/onboarding');

export const listSellerOnboarding = (params: { search?: string; show?: 'all' | 'incomplete' | 'complete'; page?: number; pageSize?: number }) =>
  http.get<OnboardingList>('/seller-onboarding', { ...params });
