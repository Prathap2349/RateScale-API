import apiClient from './axios';
import type { User, ResetPasswordRequest } from '../types';

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
}

export const profileApi = {
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.put<User>('/profile', data);
    return response.data;
  },

  changePassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/profile/change-password', data);
    return response.data;
  },
};
