import { http, sellerHttp, userHttp } from './http';
import type { AnsweredFilter, PublicQuestion, QuestionPage, StaffQuestion } from '@/types/question';

// Buyer
export const listProductQuestions = (productId: number, page = 1, pageSize = 5) =>
  userHttp.get<QuestionPage<PublicQuestion>>(`/questions/product/${productId}`, { page, pageSize });
export const askQuestion = (productId: number, question: string) => userHttp.post<PublicQuestion>(`/questions/product/${productId}`, { question });

// Seller
export const listSellerQuestions = (params: { show?: AnsweredFilter; search?: string; page?: number; pageSize?: number }) =>
  sellerHttp.get<QuestionPage<StaffQuestion>>('/questions', { ...params });
export const getSellerQuestionSummary = () => sellerHttp.get<{ unanswered: number; answered: number }>('/questions/summary');
export const answerQuestion = (id: number, answer: string) => sellerHttp.post<StaffQuestion>(`/questions/${id}/answer`, { answer });

// Admin
export const listAdminQuestions = (params: { show?: AnsweredFilter; visibility?: 'all' | 'published' | 'hidden'; search?: string; sellerId?: number; page?: number; pageSize?: number }) =>
  http.get<QuestionPage<StaffQuestion>>('/questions', { ...params });
export const hideQuestion = (id: number, reason: string) => http.post<{ id: number; status: string }>(`/questions/${id}/hide`, { reason });
export const restoreQuestion = (id: number) => http.post<{ id: number; status: string }>(`/questions/${id}/restore`);
