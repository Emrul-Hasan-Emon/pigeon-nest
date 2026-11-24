import { http, sellerHttp, userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type { SellerPublicReview } from '@/types/storefront';
import type {
  AdminReview,
  AdminReviewDetails,
  CursorPage,
  MyReview,
  Params,
  PendingReviewItem,
  PublicReview,
  RatingSummary,
  ReviewReply,
  ReviewReport,
  ReviewReportReason,
  SellerReview,
  SellerReviewSummary,
} from '@/types/review';

const U = ENDPOINTS.user.reviews;
const UR = ENDPOINTS.user.reviewReplies;
const S = ENDPOINTS.seller.reviews;
const SR = ENDPOINTS.seller.reviewReplies;
const A = ENDPOINTS.admin.reviews;
const AR = ENDPOINTS.admin.reviewReplies;

export type ReviewFields = { rating?: number; title?: string; comment?: string };

function reviewForm(fields: ReviewFields & { orderItemId?: number; removeImageIds?: number[] }, images: File[]) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    form.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  for (const file of images) form.append('images', file);
  return form;
}

// ---- anyone ----
export const getRatingSummary = (productId: number) => userHttp.get<RatingSummary>(U.productSummary(productId));
export const listProductReviews = (productId: number, params: Params) =>
  userHttp.get<CursorPage<PublicReview>>(U.productList(productId), { ...params });
export const listPublicSellerReviews = (sellerId: number, params: Params) =>
  userHttp.get<CursorPage<SellerPublicReview>>(U.sellerList(sellerId), { ...params });
export const listThread = (reviewId: number, params: Params) => userHttp.get<CursorPage<ReviewReply>>(U.thread(reviewId), { ...params });

// ---- customer ----
export const listMyReviews = (params: Params) => userHttp.get<CursorPage<MyReview>>(U.list, { ...params });
export const listPendingReviews = (params: Params) => userHttp.get<CursorPage<PendingReviewItem>>(U.pending, { ...params });
export const getMyVotes = (productId: number) => userHttp.get<{ reviewIds: number[] }>(U.votes, { productId });
export const createReview = (fields: ReviewFields & { orderItemId: number }, images: File[]) =>
  userHttp.post<MyReview>(U.list, reviewForm(fields, images));
export const updateReview = (id: number, fields: ReviewFields & { removeImageIds?: number[] }, images: File[]) =>
  userHttp.patch<MyReview>(U.one(id), reviewForm(fields, images));
export const deleteReview = (id: number) => userHttp.delete<{ id: number; deleted: boolean }>(U.one(id));
export const voteHelpful = (id: number) => userHttp.post<{ helpfulCount: number }>(U.helpful(id));
export const unvoteHelpful = (id: number) => userHttp.delete<{ helpfulCount: number }>(U.helpful(id));
export const reportReviewAsCustomer = (id: number, reason: ReviewReportReason, note?: string) =>
  userHttp.post(U.report(id), { reason, note });
export const replyAsCustomer = (reviewId: number, body: string, parentId?: number) =>
  userHttp.post<ReviewReply>(U.reply(reviewId), { body, parentId });
export const editReplyAsCustomer = (id: number, body: string) => userHttp.patch<ReviewReply>(UR.one(id), { body });
export const deleteReplyAsCustomer = (id: number) => userHttp.delete(UR.one(id));
export const reportReplyAsCustomer = (id: number, reason: ReviewReportReason, note?: string) => userHttp.post(UR.report(id), { reason, note });

// ---- seller ----
export const listSellerReviews = (params: Params) => sellerHttp.get<CursorPage<SellerReview>>(S.list, { ...params });
export const getSellerReviewSummary = (productId?: number) => sellerHttp.get<SellerReviewSummary>(S.summary, { productId });
export const replyAsSeller = (reviewId: number, body: string, parentId?: number) =>
  sellerHttp.post<ReviewReply>(S.replies(reviewId), { body, parentId });
export const reportReviewAsSeller = (id: number, reason: ReviewReportReason, note?: string) => sellerHttp.post(S.report(id), { reason, note });
export const editReplyAsSeller = (id: number, body: string) => sellerHttp.patch<ReviewReply>(SR.one(id), { body });
export const deleteReplyAsSeller = (id: number) => sellerHttp.delete(SR.one(id));
export const reportReplyAsSeller = (id: number, reason: ReviewReportReason, note?: string) => sellerHttp.post(SR.report(id), { reason, note });

// ---- admin ----
export const listAdminReviews = (params: Params) => http.get<CursorPage<AdminReview>>(A.list, { ...params });
export const listUserReviews = (userId: number, params: Params) =>
  http.get<CursorPage<AdminReview>>(ENDPOINTS.admin.users.reviews(userId), { ...params });
export const getAdminReview = (id: number) => http.get<AdminReviewDetails>(A.detail(id));
export const hideReview = (id: number, reason: string) => http.post<AdminReviewDetails>(A.hide(id), { reason });
export const restoreReview = (id: number, reason?: string) => http.post<AdminReviewDetails>(A.restore(id), { reason });
export const listAdminThread = (reviewId: number, params: Params) => http.get<CursorPage<ReviewReply>>(A.replies(reviewId), { ...params });
export const replyAsAdmin = (reviewId: number, body: string, parentId?: number) => http.post<ReviewReply>(A.replies(reviewId), { body, parentId });
export const editReplyAsAdmin = (id: number, body: string) => http.patch<ReviewReply>(AR.one(id), { body });
export const deleteReplyAsAdmin = (id: number) => http.delete(AR.one(id));
export const hideReply = (id: number, reason: string) => http.post(AR.hide(id), { reason });
export const restoreReply = (id: number, reason?: string) => http.post(AR.restore(id), { reason });
export const listReports = (params: Params) => http.get<CursorPage<ReviewReport>>(ENDPOINTS.admin.reviewReports.list, { ...params });
export const resolveReport = (id: number, action: 'hide' | 'dismiss', note?: string) =>
  http.post(ENDPOINTS.admin.reviewReports.resolve(id), { action, note });
