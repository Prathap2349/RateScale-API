import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, User, Activity, Check, X, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { authApi } from '../../api/auth';

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full Name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept terms' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormInputs = z.infer<typeof signupSchema>;

export const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
    },
  });

  const passwordValue = watch('password', '');

  const passwordChecks = [
    { label: 'Min 8 characters', valid: passwordValue.length >= 8 },
    { label: 'One uppercase (A-Z)', valid: /[A-Z]/.test(passwordValue) },
    { label: 'One lowercase (a-z)', valid: /[a-z]/.test(passwordValue) },
    { label: 'One number (0-9)', valid: /[0-9]/.test(passwordValue) },
    { label: 'One special symbol (!@#$%)', valid: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  const onSubmit = async (data: SignupFormInputs) => {
    setIsLoading(true);
    try {
      await authApi.register(data);
      toast.success('Account created! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: any) {
      const data = err.response?.data;
      const message = data?.message || 'Registration failed.';
      let reason = '';
      if (data?.field) {
        reason = `Reason: the "${data.field}" field — ${message}`;
      } else if (!err.response) {
        reason = 'Reason: could not reach the server. Check your connection or that the backend is running.';
      } else if (err.response?.status >= 500) {
        reason = 'Reason: something went wrong on the server while creating your account.';
      } else {
        reason = `Reason: ${message}`;
      }
      toast.error(reason, { duration: 5000 });
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
        <div className="flex flex-col items-center text-center space-y-2">
          <motion.div 
            className="w-12 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-zinc-100 shadow-md"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Activity className="w-6 h-6 text-blue-400" />
          </motion.div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 bg-clip-text text-transparent tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-medium">Start managing rate limits with RateScale</p>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl shadow-purple-500/5 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  {...register('fullName')}
                  type="text"
                  placeholder="Alex Morgan"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[var(--input-bg)] border ${
                    errors.fullName ? 'border-rose-500/50' : 'border-[var(--border-color)] focus:border-blue-500/50'
                  } rounded-lg text-xs text-[var(--text-main)] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200`}
                />
              </div>
              {errors.fullName && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="alex@company.com"
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
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Password</label>
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
            </div>

            {passwordValue.length > 0 && (
              <div className="p-2.5 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-lg space-y-1">
                {passwordChecks.map((check, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                    {check.valid ? (
                      <Check className="w-3 h-3 text-emerald-400 animate-scale-up" />
                    ) : (
                      <X className="w-3 h-3 text-zinc-500" />
                    )}
                    <span className={check.valid ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-9 py-2.5 bg-[var(--input-bg)] border ${
                    errors.confirmPassword ? 'border-rose-500/50' : 'border-[var(--border-color)] focus:border-blue-500/50'
                  } rounded-lg text-xs text-[var(--text-main)] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200`}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  {...register('acceptTerms')}
                  type="checkbox"
                  className="w-3.5 h-3.5 mt-0.5 rounded border-zinc-700 bg-[var(--input-bg)] text-blue-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-[var(--text-muted)] leading-snug font-medium">
                  I accept the Terms of Service & Privacy Policy
                </span>
              </label>
              {errors.acceptTerms && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.acceptTerms.message}</p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-rose-600 hover:from-blue-500 hover:via-purple-500 hover:to-rose-500 text-white font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/10 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </form>
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)] font-medium">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-blue-400 hover:text-blue-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
