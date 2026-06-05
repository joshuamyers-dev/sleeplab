import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Type definition for the glossary entry.
 */
type GlossaryEntry = {
  title: string
  definition: string
  aliases: string[]
}

/**
 * Type definition for the active glossary.
 */
type ActiveGlossary = {
  entry: GlossaryEntry
  x: number
  y: number
  placement: 'top' | 'bottom'
}

/**
 * React component or element to render the g l o s s a r y.
 *
 * @returns The rendered React element.
 */
const GLOSSARY: GlossaryEntry[] = [
  {
    title: 'APAP',
    definition: 'APAP stands for auto-adjusting positive airway pressure. It is a machine mode that automatically raises or lowers air pressure during the night based on your breathing.',
    aliases: ['APAP'],
  },
  {
    title: 'CPAP',
    definition: 'CPAP stands for continuous positive airway pressure. It uses pressurized air to help keep your airway open while you sleep.',
    aliases: ['CPAP'],
  },
  {
    title: 'AHI',
    definition: 'AHI stands for apnea-hypopnea index. It is the average number of breathing interruptions per hour of sleep.',
    aliases: ['AHI'],
  },
  {
    title: 'EPR',
    definition: 'EPR stands for expiratory pressure relief. It lowers pressure slightly when you breathe out to make treatment feel more comfortable.',
    aliases: ['EPR'],
  },
  {
    title: 'Central Apnea',
    definition: 'A central apnea is a pause in breathing where your brain briefly stops telling your body to take a breath.',
    aliases: ['central apnea', 'central apneas', 'central event', 'central events'],
  },
  {
    title: 'Obstructive Apnea',
    definition: 'An obstructive apnea is a pause in breathing caused by the airway narrowing or closing during sleep.',
    aliases: ['obstructive apnea', 'obstructive apneas', 'obstructive event', 'obstructive events'],
  },
  {
    title: 'Hypopnea',
    definition: 'A hypopnea is a partial blockage of breathing. Airflow drops, but it does not stop completely.',
    aliases: ['hypopnea', 'hypopneas'],
  },
  {
    title: 'Apnea',
    definition: 'An apnea is a pause in breathing during sleep.',
    aliases: ['apnea', 'apneas'],
  },
  {
    title: 'Pressure',
    definition: 'Pressure is the air pressure your machine delivers to help keep your airway open.',
    aliases: ['pressure', 'pressures'],
  },
  {
    title: 'Leak Rate',
    definition: 'Leak rate is how much air escapes from your mask or tubing. Higher leaks can reduce how well treatment works.',
    aliases: ['leak rate', 'leak', 'leaks'],
  },
  {
    title: 'Ramp',
    definition: 'Ramp is a comfort setting that starts treatment at a lower pressure and slowly increases it as you fall asleep.',
    aliases: ['ramp'],
  },
  {
    title: 'Humidity',
    definition: 'Humidity is the moisture setting on the machine. It can help with dryness or irritation in the nose and throat.',
    aliases: ['humidity'],
  },
  {
    title: 'Mask Fit',
    definition: 'Mask fit describes how well the mask seals and sits on your face. A poor fit can cause leaks and discomfort.',
    aliases: ['mask fit', 'mask'],
  },
  {
    title: 'Compliance',
    definition: 'Compliance means how regularly you use the machine as recommended.',
    aliases: ['compliance'],
  },
]

const ALIAS_LOOKUP = new Map(
  GLOSSARY.flatMap((entry) =>
    entry.aliases.map((alias) => [alias.toLowerCase(), entry] as const),
  ),
)

const GLOSSARY_PATTERN = new RegExp(
  `\\b(${[...ALIAS_LOOKUP.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})\\b`,
  'gi',
)

/**
 * React component or element to render the glossary text.
 *
 * @returns The rendered React element.
 */
export default function GlossaryText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [activeGlossary, setActiveGlossary] = useState<ActiveGlossary | null>(null)

  const fragments = useMemo(() => splitByGlossary(text), [text])

  useEffect(() => {
    if (!activeGlossary) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveGlossary(null)
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-glossary-popover], [data-glossary-trigger]')) {
        return
      }
      setActiveGlossary(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [activeGlossary])

  function openGlossary(entry: GlossaryEntry, element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    const hasRoomAbove = rect.top > 150
    setActiveGlossary({
      entry,
      x: rect.left + rect.width / 2,
      y: hasRoomAbove ? rect.top - 10 : rect.bottom + 10,
      placement: hasRoomAbove ? 'top' : 'bottom',
    })
  }

  return (
    <>
      <span className={className}>
        {fragments.map((fragment, index) => {
          if (typeof fragment === 'string') {
            return <Fragment key={`${fragment}-${index}`}>{fragment}</Fragment>
          }

          return (
            <button
              key={`${fragment.alias}-${index}`}
              type="button"
              data-glossary-trigger
              className="cursor-help text-inherit underline decoration-[var(--accent)]/50 decoration-dotted decoration-1 underline-offset-4 transition hover:text-[var(--accent-hover)] hover:decoration-[var(--accent-hover)]"
              aria-label={`Show definition for ${fragment.entry.title}`}
              aria-expanded={activeGlossary?.entry.title === fragment.entry.title}
              onClick={(event) => {
                if (activeGlossary?.entry.title === fragment.entry.title) {
                  setActiveGlossary(null)
                } else {
                  openGlossary(fragment.entry, event.currentTarget)
                }
              }}
            >
              {fragment.alias}
            </button>
          )
        })}
      </span>
      {activeGlossary ? createPortal(
        <div
          data-glossary-popover
          role="tooltip"
          className="fixed z-[10001] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[14px] border border-[var(--modal-ring)] bg-[var(--modal-surface)] px-4 py-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.20)] ring-1 ring-[var(--modal-ring)]"
          style={{
            left: `${Math.min(Math.max(activeGlossary.x, 176), window.innerWidth - 176)}px`,
            top: `${activeGlossary.y}px`,
            transform: activeGlossary.placement === 'top'
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
          }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            {activeGlossary.entry.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {activeGlossary.entry.definition}
          </p>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

/**
 * Helper function for split by glossary.
 */
function splitByGlossary(text: string): Array<string | { alias: string; entry: GlossaryEntry }> {
  const fragments: Array<string | { alias: string; entry: GlossaryEntry }> = []
  const seenEntries = new Set<string>()
  let lastIndex = 0

  text.replace(GLOSSARY_PATTERN, (match, _group, offset: number) => {
    if (offset > lastIndex) {
      fragments.push(text.slice(lastIndex, offset))
    }

    const entry = ALIAS_LOOKUP.get(match.toLowerCase())
    if (entry) {
      if (seenEntries.has(entry.title)) {
        fragments.push(match)
      } else {
        seenEntries.add(entry.title)
        fragments.push({ alias: match, entry })
      }
    } else {
      fragments.push(match)
    }

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < text.length) {
    fragments.push(text.slice(lastIndex))
  }

  return fragments.length > 0 ? fragments : [text]
}

/**
 * Helper function for escape reg exp.
 */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
