import { http, sellerHttp } from './http';
import type { Report, ReportName, ReportParams } from '@/types/report';

const query = (p: ReportParams) => ({ ...p });

export const getSellerReport = (name: ReportName, params: ReportParams) => sellerHttp.get<Report>(`/reports/${name}`, query(params));
export const getAdminReport = (name: ReportName, params: ReportParams) => http.get<Report>(`/reports/${name}`, query(params));
