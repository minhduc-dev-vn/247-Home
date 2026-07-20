import type { HTMLAttributes, TableHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function TableContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border bg-[var(--surface)]',
        className,
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        'w-full min-w-[640px] border-collapse text-left text-sm [&_tbody_tr]:transition-[background-color,box-shadow] [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-[var(--surface-subtle)] [&_tbody_tr:hover]:shadow-[inset_3px_0_0_var(--primary)] [&_td]:border-t [&_td]:px-4 [&_td]:py-3 [&_th]:bg-[var(--surface-subtle)] [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-[var(--muted-foreground)]',
        className,
      )}
      {...props}
    />
  );
}
