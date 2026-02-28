import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

type Variant = 'default' | 'secondary' | 'ghost' | 'outline'
type Size = 'default' | 'sm' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]',
  secondary: 'bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-strong)]',
  ghost: 'bg-transparent text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)]',
  outline: 'border border-[var(--accent-border)] bg-[var(--surface-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)]',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-11 px-6',
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold transition-colors disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
