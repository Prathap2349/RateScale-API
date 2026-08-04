import apiClient from './axios';
import type { TrafficConfiguration, CreateTrafficConfigRequest } from '../types';

export const trafficApi = {
  getTrafficConfigs: async (): Promise<TrafficConfiguration[]> => {
    const response = await apiClient.get<TrafficConfiguration[]>('/traffic-configurations');
    return response.data;
  },

  createTrafficConfig: async (data: CreateTrafficConfigRequest): Promise<TrafficConfiguration> => {
    const response = await apiClient.post<TrafficConfiguration>('/traffic-configurations', data);
    return response.data;
  },

  deleteTrafficConfig: async (id: string): Promise<void> => {
    await apiClient.delete(`/traffic-configurations/${id}`);
  },
};
