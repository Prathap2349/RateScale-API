import React from 'react';
import type { ReactNode } from 'react';
import { TableSkeleton } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  keyExtractor: (item: T) => string;
}

export function Table<T>({
  columns,
  data,
  isLoading,
  isError,
  emptyTitle,
  emptyDescription,
  onRetry,
  keyExtractor,
}: TableProps<T>) {
  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (isError) {
    return (
      <EmptyState
        type="waiting_for_backend"
        title="Server Unavailable"
        description="Could not connect to http://localhost:8080/api server."
        onRetry={onRetry}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        type="no_data"
        title={emptyTitle || 'No Records Found'}
        description={emptyDescription || 'There are no active entries to display.'}
      />
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <table className="w-full text-left text-xs sm:text-sm text-[var(--text-main)] border-collapse">
        <thead className="bg-zinc-100 dark:bg-zinc-900/80 text-[11px] uppercase font-semibold text-[var(--text-muted)] border-b border-[var(--border-color)]">
          <tr>
            {columns.map((col, index) => (
              <th key={index} className={`px-5 py-3.5 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-colors"
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.render
                    ? col.render(item)
                    : col.accessor
                    ? (item[col.accessor] as ReactNode)
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
