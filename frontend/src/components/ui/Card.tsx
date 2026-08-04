import React from 'react';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverEffect = true }) => {
  return (
    <div
      className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs transition-all duration-300 ${
        hoverEffect ? 'hover:border-zinc-700/60 hover:shadow-[0_0_25px_rgba(59,130,246,0.03)] hover:bg-[var(--bg-card-hover)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
