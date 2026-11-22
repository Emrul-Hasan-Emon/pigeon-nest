import { http, sellerHttp, userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  CounterProposalInput,
  CreateProposalInput,
  ProposalDetail,
  ProposalListParams,
  ProposalNoteInput,
  ProposalPage,
  SellerProposalSummary,
} from '@/types/proposal';

// ---- customer ----
const U = ENDPOINTS.user.proposals;

export function listMyProposals(params: ProposalListParams) {
  return userHttp.get<ProposalPage>(U.list, { ...params });
}
export function getMyProposal(id: number) {
  return userHttp.get<ProposalDetail>(U.detail(id));
}
/** The buyer's current proposal for a SKU (an open one first), or null. */
export function getMyProposalForSku(skuId: number) {
  return userHttp.get<{ proposal: ProposalDetail | null }>(U.forSku(skuId));
}
export function createProposal(input: CreateProposalInput) {
  return userHttp.post<ProposalDetail>(U.create, input);
}
export function buyerAcceptProposal(id: number, input: ProposalNoteInput = {}) {
  return userHttp.post<ProposalDetail>(U.accept(id), input);
}
export function buyerCounterProposal(id: number, input: CounterProposalInput) {
  return userHttp.post<ProposalDetail>(U.counter(id), input);
}
export function buyerRejectProposal(id: number, input: ProposalNoteInput = {}) {
  return userHttp.post<ProposalDetail>(U.reject(id), input);
}
export function buyerCancelProposal(id: number, input: ProposalNoteInput = {}) {
  return userHttp.post<ProposalDetail>(U.cancel(id), input);
}

// ---- seller ----
const S = ENDPOINTS.seller.proposals;

export function listSellerProposals(params: ProposalListParams) {
  return sellerHttp.get<ProposalPage>(S.list, { ...params });
}
export function getSellerProposalSummary() {
  return sellerHttp.get<SellerProposalSummary>(S.summary);
}
export function getSellerProposal(id: number) {
  return sellerHttp.get<ProposalDetail>(S.detail(id));
}
export function sellerAcceptProposal(id: number, input: ProposalNoteInput = {}) {
  return sellerHttp.post<ProposalDetail>(S.accept(id), input);
}
export function sellerCounterProposal(id: number, input: CounterProposalInput) {
  return sellerHttp.post<ProposalDetail>(S.counter(id), input);
}
export function sellerRejectProposal(id: number, input: ProposalNoteInput = {}) {
  return sellerHttp.post<ProposalDetail>(S.reject(id), input);
}

// ---- admin ----
const A = ENDPOINTS.admin.proposals;

export function listAdminProposals(params: ProposalListParams) {
  return http.get<ProposalPage>(A.list, { ...params });
}
export function getAdminProposal(id: number) {
  return http.get<ProposalDetail>(A.detail(id));
}
export function adminRejectProposal(id: number, input: ProposalNoteInput = {}) {
  return http.post<ProposalDetail>(A.reject(id), input);
}
export function adminCancelProposal(id: number, input: ProposalNoteInput = {}) {
  return http.post<ProposalDetail>(A.cancel(id), input);
}
