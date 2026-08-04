import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, Activity, ArrowRight, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const fillMasterCredentials = () => {
    setValue('email', 'master@airatelimit.com');
    setValue('password', 'MasterAdmin@2026!');
    toast.success('Master credentials filled!');
  };

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      login(response.token, response.refreshToken, response.user, data.rememberMe);
      toast.success('Signed in successfully');
      navigate('/dashboard');
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Authentication failed. Check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg-main)] flex flex-col justify-center items-center p-4 overflow-hidden">
      {/* Decorative Radial Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      <motion.div 
        className="w-full max-w-sm space-y-6 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <motion.div 
            className="w-12 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-zinc-100 shadow-md"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Activity className="w-6 h-6 text-blue-400" />
          </motion.div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 bg-clip-text text-transparent tracking-tight">
            Sign in to RateScale
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            Adaptive Rate Limiting & Telemetry Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl shadow-purple-500/5 space-y-5">
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="master@airatelimit.com"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[var(--input-bg)] border ${
                    errors.email ? 'border-rose-500/50' : 'border-[var(--border-color)] focus:border-blue-500/50'
                  } rounded-lg text-xs text-[var(--text-main)] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-9 py-2.5 bg-[var(--input-bg)] border ${
                    errors.password ? 'border-rose-500/50' : 'border-[var(--border-color)] focus:border-blue-500/50'
                  } rounded-lg text-xs text-[var(--text-main)] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between py-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-zinc-700 bg-[var(--input-bg)] text-blue-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-[var(--text-muted)] font-medium">Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-rose-600 hover:from-blue-500 hover:via-purple-500 hover:to-rose-500 text-white font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/10 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Master Credentials Quick Fill Helper */}
          <div className="p-3 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-medium">
              <KeyRound className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Demo Master Account</span>
            </div>
            <button
              type="button"
              onClick={fillMasterCredentials}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Fill Credentials
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)] font-medium">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-blue-400 hover:text-blue-300 transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
