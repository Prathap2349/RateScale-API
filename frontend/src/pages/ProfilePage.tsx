import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { User as UserIcon, Mail, Calendar, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profile';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

const editProfileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type EditProfileInputs = z.infer<typeof editProfileSchema>;
type ChangePasswordInputs = z.infer<typeof changePasswordSchema>;

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
  } = useForm<EditProfileInputs>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      fullName: user?.fullName || 'Alex Morgan',
      email: user?.email || 'alex@company.com',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordInputs>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onUpdateProfile = async (data: EditProfileInputs) => {
    setIsUpdatingProfile(true);
    try {
      const updated = await profileApi.updateProfile(data);
      updateUser(updated);
      toast.success('Profile details updated');
    } catch (err: any) {
      toast.error('Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onChangePassword = async (data: ChangePasswordInputs) => {
    setIsChangingPassword(true);
    try {
      await profileApi.changePassword(data);
      toast.success('Password changed successfully');
      resetPasswordForm();
    } catch (err: any) {
      toast.error('Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-main)] tracking-tight">Account Profile</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Manage your account details and security preferences
        </p>
      </div>

      {/* User Info Overview Card */}
      <Card className="flex flex-col sm:flex-row items-center gap-5 p-5">
        <div className="w-16 h-16 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-[var(--text-main)] flex items-center justify-center text-2xl font-bold shrink-0">
          {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
        </div>

        <div className="space-y-1.5 text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--text-main)]">{user?.fullName || 'Master Administrator'}</h2>
            <Badge variant="blue">{user?.role || 'System Architect'}</Badge>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              <span>{user?.email || 'master@airatelimit.com'}</span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Joined:{' '}
                <strong className="text-[var(--text-main)]">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Jan 2026'}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid: Edit Profile & Change Password */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <UserIcon className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Edit Profile Details</h3>
          </div>

          <form onSubmit={handleSubmitProfile(onUpdateProfile)} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Full Name</label>
              <input
                {...registerProfile('fullName')}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none"
              />
              {profileErrors.fullName && (
                <p className="text-[11px] text-red-400 mt-1">{profileErrors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-main)] mb-1">
                Email Address
              </label>
              <input
                {...registerProfile('email')}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none"
              />
              {profileErrors.email && (
                <p className="text-[11px] text-red-400 mt-1">{profileErrors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full py-2 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 font-semibold text-xs transition-opacity hover:opacity-90 shadow-xs"
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <Key className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Change Password</h3>
          </div>

          <form onSubmit={handleSubmitPassword(onChangePassword)} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[var(--text-main)] mb-1">
                New Password
              </label>
              <input
                {...registerPassword('newPassword')}
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none"
              />
              {passwordErrors.newPassword && (
                <p className="text-[11px] text-red-400 mt-1">
                  {passwordErrors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-main)] mb-1">
                Confirm New Password
              </label>
              <input
                {...registerPassword('confirmPassword')}
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none"
              />
              {passwordErrors.confirmPassword && (
                <p className="text-[11px] text-red-400 mt-1">
                  {passwordErrors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full py-2 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 font-semibold text-xs transition-opacity hover:opacity-90 shadow-xs"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
};
