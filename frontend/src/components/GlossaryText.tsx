import { Fragment, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type GlossaryEntry = {
  title: string
  definition: string
  aliases: string[]
}

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

export default function GlossaryText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [activeEntry, setActiveEntry] = useState<GlossaryEntry | null>(null)

  const fragments = useMemo(() => splitByGlossary(text), [text])

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
              className="cursor-pointer font-bold text-inherit underline decoration-[var(--accent)] decoration-2 underline-offset-3 transition hover:text-[var(--accent-hover)]"
              onClick={() => setActiveEntry(fragment.entry)}
            >
              {fragment.alias}
            </button>
          )
        })}
      </span>
      {activeEntry ? createPortal(
        <>
          <div
            className="motion-overlay-in fixed inset-0 z-[10000]"
            style={{
              background: 'var(--modal-backdrop)',
              animation: 'modal-overlay-in 150ms ease-out',
            }}
            aria-hidden="true"
            data-state="open"
            onClick={() => setActiveEntry(null)}
          />
          <div className="pointer-events-none fixed inset-0 z-[10001] flex items-center justify-center px-4">
            <div
              className="motion-panel-in pointer-events-auto w-full max-w-md rounded-[30px] border border-[var(--modal-ring)] bg-[var(--modal-surface)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)] ring-1 ring-[var(--modal-ring)]"
              style={{
                animation: 'modal-panel-in 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Definition</p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">{activeEntry.title}</h3>
                </div>
                <button
                  type="button"
                  className="text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                  onClick={() => setActiveEntry(null)}
                >
                  Close
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">{activeEntry.definition}</p>
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </>
  )
}

function splitByGlossary(text: string): Array<string | { alias: string; entry: GlossaryEntry }> {
  const fragments: Array<string | { alias: string; entry: GlossaryEntry }> = []
  let lastIndex = 0

  text.replace(GLOSSARY_PATTERN, (match, _group, offset: number) => {
    if (offset > lastIndex) {
      fragments.push(text.slice(lastIndex, offset))
    }

    const entry = ALIAS_LOOKUP.get(match.toLowerCase())
    if (entry) {
      fragments.push({ alias: match, entry })
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
