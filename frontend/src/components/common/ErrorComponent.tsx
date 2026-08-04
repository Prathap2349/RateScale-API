import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorComponentProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorComponent: React.FC<ErrorComponentProps> = ({
  title = 'Failed to load data',
  message = 'An error occurred while fetching information from the backend server.',
  onRetry,
}) => {
  return (
    <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 flex items-start justify-between gap-4 my-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-red-300">{title}</h4>
          <p className="text-xs text-red-400/90 mt-1">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
};
