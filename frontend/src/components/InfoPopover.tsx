import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface InfoPopoverProps {
  title: string
  children: ReactNode
}

export default function InfoPopover({ title, children }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      setPopoverStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: Math.max(16, rect.right - 288),
        zIndex: 9999,
      })
    }

    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    updatePosition()
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`What ${title} means`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)]"
        onClick={() => setIsOpen((current) => !current)}
      >
        i
      </button>
      {isOpen ? createPortal(
        <div
          className="w-72 rounded-[24px] border border-[var(--border)] bg-[var(--popover-surface)] p-4 text-left shadow-[0_16px_48px_rgba(0,0,0,0.08)] backdrop-blur-sm"
          style={popoverStyle}
        >
          <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
          <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{children}</div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
