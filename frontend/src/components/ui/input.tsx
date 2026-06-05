import type { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

/**
 * React component to render the input.
 *
 * @returns The rendered React element.
 */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--foreground)]',
        'placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]',
        className,
      )}
      {...props}
    />
  )
}
