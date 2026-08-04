import apiClient from './axios';
import type { DashboardMetrics, AnalyticsData } from '../types';

export const analyticsApi = {
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await apiClient.get<DashboardMetrics>('/dashboard/metrics');
    return response.data;
  },

  getAnalyticsData: async (): Promise<AnalyticsData> => {
    const response = await apiClient.get<AnalyticsData>('/analytics');
    return response.data;
  },
};
