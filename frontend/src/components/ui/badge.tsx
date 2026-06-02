import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

/**
 * React component to render the badge.
 *
 * @returns The rendered React element.
 */
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]',
        className,
      )}
      {...props}
    />
  )
}
