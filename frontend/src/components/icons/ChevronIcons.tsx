import type { SVGProps } from 'react'

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <path
        d="M7.5 4.5L13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <path
        d="M12.5 4.5L7 10l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <path d="M3.5 8.5L10 3.5l6.5 5v7a1 1 0 0 1-1 1h-3.5v-5h-4v5H4.5a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <path d="M3 10h2.5l1.8-3.5 3.4 7 2.1-4H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <path d="M10 3.2l1.3 3.5L14.8 8l-3.5 1.3L10 12.8 8.7 9.3 5.2 8l3.5-1.3L10 3.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15.8 13.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6ZM4.5 12.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <path d="M13.8 2.9a6.8 6.8 0 1 0 3.3 12.7A7.4 7.4 0 1 1 13.8 2.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden={true} {...props}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.8 10.2 8.9 12.3 13.4 7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
