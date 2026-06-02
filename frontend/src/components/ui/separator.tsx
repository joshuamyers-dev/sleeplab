import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

/**
 * React component to render the separator.
 *
 * @returns The rendered React element.
 */
export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('h-px w-full bg-white/10', className)} {...props} />
}
