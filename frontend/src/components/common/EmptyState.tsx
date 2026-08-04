import React from 'react';
import { ServerOff, Database, SearchX, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  type?: 'no_data' | 'waiting_for_backend' | 'search_empty';
  onRetry?: () => void;
  actionButton?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  type = 'no_data',
  onRetry,
  actionButton,
}) => {
  const configs = {
    no_data: {
      icon: Database,
      defaultTitle: 'No Records Found',
      defaultDescription: 'No data has been created or recorded yet.',
    },
    waiting_for_backend: {
      icon: ServerOff,
      defaultTitle: 'Server Unreachable',
      defaultDescription: 'Cannot connect to backend server at http://localhost:8080/api.',
    },
    search_empty: {
      icon: SearchX,
      defaultTitle: 'No Matching Results',
      defaultDescription: 'No records matched your search parameters.',
    },
  };

  const current = configs[type];
  const IconComponent = current.icon;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] my-4">
      <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 mb-3">
        <IconComponent className="w-6 h-6" />
      </div>

      <h3 className="text-sm font-semibold text-[var(--text-main)] mb-1">
        {title || current.defaultTitle}
      </h3>

      <p className="text-xs text-[var(--text-muted)] max-w-sm mb-5 leading-relaxed">
        {description || current.defaultDescription}
      </p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        )}
        {actionButton}
      </div>
    </div>
  );
};
