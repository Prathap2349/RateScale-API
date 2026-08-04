import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-2',
    lg: 'w-10 h-10 border-3',
    xl: 'w-14 h-14 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} rounded-full border-blue-500/20 border-t-blue-500 border-r-cyan-400 animate-spin`}
        />
        <div
          className={`absolute inset-0 ${sizeClasses[size]} rounded-full blur-sm border-blue-500/40 border-t-blue-400 animate-spin opacity-50`}
        />
      </div>
      {label && <span className="text-sm font-medium text-slate-400 animate-pulse">{label}</span>}
    </div>
  );
};
