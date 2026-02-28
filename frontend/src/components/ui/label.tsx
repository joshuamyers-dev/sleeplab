import type { LabelHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-2 block text-sm font-medium text-[var(--foreground)]', className)} {...props} />
}
