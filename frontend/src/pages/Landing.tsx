import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import calmNight from '../assets/calm-night.png'
import doctorConvo from '../assets/doctor-convo.png'
import logo from '../assets/logo.png'
import { Button } from '../components/ui/button'
import { ChevronRightIcon } from '../components/icons/ChevronIcons'

// ── Hooks ──────────────────────────────────────────────────────────────────

function useParallaxScroll() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    function handleScroll() { setScrollY(window.scrollY) }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  return scrollY
}

function useCountUp(target: number, trigger: boolean, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let start: number | null = null
    let raf: number
    function step(timestamp: number) {
      if (start === null) start = timestamp
      const elapsed = timestamp - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [trigger, target, duration])
  return value
}

// ── Components ─────────────────────────────────────────────────────────────

function FloatingOrb({ scrollY, className, speed }: { scrollY: number; className: string; speed: number }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ transform: `translate3d(0, ${scrollY * speed}px, 0)` }}
    />
  )
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s cubic-bezier(0.2,0.8,0.2,1) ${delay}ms, transform 0.65s cubic-bezier(0.2,0.8,0.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// Inline SVG icons for trust strip
function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="4.5" y="9" width="11" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="1" fill="currentColor" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M10 2.5L3.5 5.5v4.5C3.5 14 6.5 17.2 10 18c3.5-.8 6.5-4 6.5-8V5.5L10 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7.2 10.2l1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5.5 3.5h6l3 3V16a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11.5 3.5V6.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 10.5h5M7.5 13h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// Mini dashboard mockup
function DashboardMockup() {
  // Sparkline points: AHI values over 7 nights mapped to SVG coords
  const ahiPoints = [6.2, 5.1, 7.4, 4.8, 3.6, 4.1, 2.1]
  const maxAhi = 8
  const w = 260
  const h = 60
  const pts = ahiPoints.map((v, i) => {
    const x = (i / (ahiPoints.length - 1)) * w
    const y = h - (v / maxAhi) * h
    return `${x},${y}`
  }).join(' ')

  const eventRows = [
    {
      label: 'Obstructive',
      color: '#5251A7',
      events: [
        { start: 8, width: 3 },
        { start: 22, width: 2 },
        { start: 55, width: 2 },
      ],
    },
    {
      label: 'Hypopnea',
      color: '#E9784B',
      events: [
        { start: 14, width: 2 },
        { start: 38, width: 3 },
        { start: 70, width: 2 },
        { start: 82, width: 1.5 },
      ],
    },
  ]

  return (
    <div className="overflow-hidden rounded-[24px] border border-[rgba(55,60,61,0.08)] bg-white shadow-[0_24px_60px_rgba(55,60,61,0.10)]">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-[rgba(55,60,61,0.08)] px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Last night's session</p>
          <p className="mt-0.5 text-sm font-bold text-[var(--foreground)]">Wednesday, Jul 23</p>
        </div>
        <span className="rounded-full bg-[var(--green-100)] px-3 py-1 text-xs font-bold text-[var(--green-700)]">Good night</span>
      </div>

      <div className="p-6">
        {/* Metric pills */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[16px] bg-[var(--blue-100)] px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--blue-700)]">AHI</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--blue-700)]">2.1</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[var(--blue-700)]/70">events/hr</p>
          </div>
          <div className="rounded-[16px] bg-[var(--surface-soft)] px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Pressure</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">8.4</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">cmH₂O</p>
          </div>
          <div className="rounded-[16px] bg-[var(--green-100)] px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--green-700)]">Usage</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--green-700)]">7h 22m</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[var(--green-700)]/70">of sleep</p>
          </div>
        </div>

        {/* AHI sparkline */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">AHI — last 7 nights</p>
          <div className="rounded-[14px] border border-[rgba(55,60,61,0.08)] bg-[var(--surface-soft)] px-4 py-3">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: '56px' }} aria-hidden="true">
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5251A7" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#5251A7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                points={pts}
                fill="none"
                stroke="#5251A7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Area fill */}
              <polygon
                points={`0,${h} ${pts} ${w},${h}`}
                fill="url(#sparkGrad)"
              />
              {/* Last point dot */}
              {(() => {
                const last = ahiPoints[ahiPoints.length - 1]
                const x = w
                const y = h - (last / maxAhi) * h
                return <circle cx={x} cy={y} r="3.5" fill="#5251A7" />
              })()}
            </svg>
          </div>
        </div>

        {/* Event timeline */}
        <div className="mt-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Event timeline</p>
          {eventRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <p className="w-24 shrink-0 text-[11px] font-semibold text-[var(--muted-foreground)]">{row.label}</p>
              <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-[var(--neutral-100)]">
                {row.events.map((ev) => (
                  <div
                    key={`${ev.start}-${ev.width}`}
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${ev.start}%`,
                      width: `${ev.width}%`,
                      backgroundColor: row.color,
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--muted-foreground)]">
            <span>10 PM</span>
            <span>2 AM</span>
            <span>6 AM</span>
          </div>
        </div>

        {/* AI insight strip */}
        <div className="mt-5 flex items-start gap-2.5 rounded-[14px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3">
          <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
          <p className="text-sm font-medium text-[var(--accent)]">
            <span className="font-bold">AI insight:</span> Your best night this week. AHI improved by 52% since Monday.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Which CPAP machines are supported?',
    a: 'Currently we support ResMed AirSense 10 and AirSense 11 devices. Data is read from the SD card in your machine. No app or Bluetooth pairing required.',
  },
  {
    q: 'Do I need to install any software?',
    a: "No downloads, no drivers. The import uses your browser's built-in folder picker. Just insert your SD card, select the DATALOG folder, and you're done.",
  },
  {
    q: 'Is my data stored securely?',
    a: 'Your data is encrypted in transit and at rest. We never sell, share, or use it for advertising. You can delete your account and all associated data at any time.',
  },
  {
    q: "Does this replace my doctor's software?",
    a: "No, and it's not designed to. SleepLab gives you a clear picture of your own data so you can have better conversations with your sleep specialist, not replace them.",
  },
  {
    q: 'What does AHI mean?',
    a: 'AHI stands for Apnea-Hypopnea Index: the number of breathing interruptions per hour of sleep. An AHI under 5 is generally considered normal. Your doctor will guide you on your personal target.',
  },
]

export default function LandingPage() {
  const scrollY = useParallaxScroll()
  const showStickyNav = scrollY > 580
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Count-up for hero stat cards (trigger after short delay on mount)
  const [countTrigger, setCountTrigger] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setCountTrigger(true), 600)
    return () => clearTimeout(t)
  }, [])
  const count30 = useCountUp(30, countTrigger)

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-[var(--foreground)]">

      {/* ── Sticky nav ────────────────────────────────────────────────── */}
      <div
        aria-hidden={!showStickyNav}
        className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(55,60,61,0.08)] bg-white/90 backdrop-blur-md shadow-[0_1px_12px_rgba(55,60,61,0.08)] transition-transform duration-300"
        style={{ transform: showStickyNav ? 'translateY(0)' : 'translateY(-100%)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <img src={logo} alt="SleepLab" className="h-9 w-auto object-contain" />
          <Link to="/register">
            <Button>Get started free</Button>
          </Link>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.12),_transparent_28%),radial-gradient(circle_at_78%_18%,_rgba(106,161,54,0.14),_transparent_26%),linear-gradient(180deg,#fbfaf7_0%,#f2f1ee_100%)]">
        <FloatingOrb
          scrollY={scrollY}
          speed={0.08}
          className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(82,81,167,0.14),_rgba(82,81,167,0.02)_70%,_transparent_72%)]"
        />
        <FloatingOrb
          scrollY={scrollY}
          speed={-0.04}
          className="absolute right-[-4rem] top-8 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(233,120,75,0.16),_rgba(233,120,75,0.02)_68%,_transparent_72%)]"
        />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-28">
          <header className="flex items-center justify-between">
            <img
              src={logo}
              alt="SleepLab"
              className="h-14 w-auto object-contain sm:h-16"
            />
            <div className="flex items-center gap-3">
              <Link className="text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/login">
                Sign in
              </Link>
              <Link to="/register">
                <Button>Get started free</Button>
              </Link>
            </div>
          </header>

          <div className="mt-16 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="motion-fade-up text-sm font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                Your sleep therapy, finally readable
              </p>
              <h1 className="motion-fade-up mt-5 text-5xl font-extrabold tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl lg:text-7xl">
                Stop guessing.<br />Start understanding your CPAP.
              </h1>
              <p className="motion-fade-up mt-6 max-w-xl text-lg leading-8 text-[var(--muted-foreground)] [animation-delay:120ms]">
                Pull in your ResMed data, see what's actually changing night to night, and get plain-English AI guidance you can bring straight to your doctor.
              </p>
              <div className="motion-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:220ms]">
                <Link to="/register">
                  <Button className="min-w-40">Get started free</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="min-w-40">Sign in</Button>
                </Link>
              </div>
              <div className="motion-fade-up mt-10 grid gap-4 sm:grid-cols-3 [animation-delay:320ms]">
                <div className="rounded-[20px] border border-[rgba(55,60,61,0.08)] bg-white/88 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                  <p className="text-3xl font-extrabold text-[var(--foreground)]">{count30}s</p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">to see what changed since last night</p>
                </div>
                <div className="rounded-[20px] border border-[rgba(55,60,61,0.08)] bg-white/88 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                  <p className="text-3xl font-extrabold text-[var(--foreground)]">1 place</p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">for calendar, trends, and night-by-night detail</p>
                </div>
                <div className="rounded-[20px] border border-[rgba(55,60,61,0.08)] bg-white/88 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                  <p className="text-3xl font-extrabold text-[var(--foreground)]">AI</p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">insights in plain English, no jargon required</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div
                className="motion-fade-up relative rounded-[28px] border border-[rgba(55,60,61,0.08)] bg-white/92 p-5 shadow-[0_24px_70px_rgba(55,60,61,0.10)] backdrop-blur-sm [animation-delay:180ms]"
                style={{ transform: `translate3d(0, ${scrollY * -0.06}px, 0)` }}
              >
                <div className="rounded-[24px] border border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_32%),var(--surface-strong)] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">AI Insights</p>
                    </div>
                    <div className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
                      Latest night
                    </div>
                  </div>
                  <p className="mt-3 text-lg font-extrabold leading-7 text-[var(--foreground)]">
                    Your best night this week. Pressure held steady and events stayed low.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="border-l-2 border-[var(--accent-border)] pl-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Going well</p>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">AHI dropped to 2.1, your lowest in two weeks.</p>
                    </div>
                    <div className="border-l-2 border-[rgba(233,120,75,0.35)] pl-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--orange-700)]">Watch</p>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">Late-night leak spikes still showing up after 4 am.</p>
                    </div>
                    <div className="border-l-2 border-[rgba(106,161,54,0.35)] pl-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--green-700)]">To discuss</p>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">Ask your clinician about nudging minimum pressure up.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.10),_transparent_34%),white] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.08)]">
                    <p className="text-sm font-bold text-[var(--foreground)]">Streak</p>
                    <p className="mt-3 text-4xl font-extrabold text-[var(--foreground)]">18</p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">Nights tracked in a row</p>
                  </div>
                  <div className="rounded-[24px] border border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(233,120,75,0.10),_transparent_34%),white] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.08)]">
                    <p className="text-sm font-bold text-[var(--foreground)]">Avg. AHI</p>
                    <p className="mt-3 text-4xl font-extrabold text-[var(--orange-700)]">4.2</p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">Breathing events per hour</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── "Built for people" + calm night illustration ───────────────── */}
      {/*
        IMAGE PROMPT A — "Calm night, reassured person"
        A single person in their mid-40s sitting up in a softly lit bedroom at
        night, holding a phone or laptop, looking calm and slightly relieved.
        The glow of a clean data dashboard is reflected on their face.
        Loose, editorial illustration style. Muted warm palette — cream, sage
        green, soft indigo. No medical equipment visible; the scene feels
        peaceful and domestic, not clinical. Negative space on the left third
        for text overlay. 16:9 aspect ratio. No text in the image.
      */}
      <section className="border-b border-[rgba(55,60,61,0.08)] bg-[#f7f6f3] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Built for people, not clinicians</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">
                You don't need to be an engineer to understand your own sleep.
              </h2>
              <p className="mt-4 text-lg leading-8 text-[var(--muted-foreground)]">
                CPAP machines produce rich data, but it's locked in formats built for clinicians. This dashboard translates it into something you can actually act on.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="overflow-hidden rounded-[26px] bg-[#f7f6f3] shadow-[0_18px_48px_rgba(55,60,61,0.08)]">
                <img
                  src={calmNight}
                  alt="A person calmly reviewing their sleep data at night"
                  className="w-full scale-[1.04] object-cover"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Three pillars (How it works) ────────────────────────────────── */}
      <section className="relative overflow-hidden py-24">
        <FloatingOrb
          scrollY={scrollY}
          speed={0.03}
          className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(106,161,54,0.08),_transparent_68%)]"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-14 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--accent)]">How it works</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">Three steps from raw data to real clarity</h2>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-3">
            <Reveal>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-white p-7 shadow-[0_18px_48px_rgba(55,60,61,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--green-700)]">Step 1 — Import</p>
                <h3 className="mt-4 text-2xl font-extrabold text-[var(--foreground)]">Bring in your ResMed SD card data in under a minute.</h3>
                <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
                  No cables, no software installs. Use the browser's native folder picker, select your <code className="rounded bg-[var(--surface-strong)] px-1 text-[0.85em]">DATALOG</code> folder, and sync runs automatically in the background while you explore.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-white p-7 shadow-[0_18px_48px_rgba(55,60,61,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--blue-700)]">Step 2 — Understand</p>
                <h3 className="mt-4 text-2xl font-extrabold text-[var(--foreground)]">See the patterns you actually care about, not just raw numbers.</h3>
                <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
                  Calendar heatmaps, nightly AHI trends, pressure and leak graphs, all surfaced together. Drill into any session to find out exactly what happened and when.
                </p>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-white p-7 shadow-[0_18px_48px_rgba(55,60,61,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--orange-700)]">Step 3 — Act</p>
                <h3 className="mt-4 text-2xl font-extrabold text-[var(--foreground)]">Go into your next appointment knowing what to ask.</h3>
                <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
                  AI summaries translate your machine data into plain language: what's improving, what's still off, and the specific questions worth raising with your sleep specialist.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Dashboard Mockup ────────────────────────────────────────────── */}
      <section className="border-y border-[rgba(55,60,61,0.08)] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--accent)]">See it in action</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">What a good night looks like</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[var(--muted-foreground)]">
              Every metric surfaced clearly. Every trend in context. Built around what actually matters to you and your doctor.
            </p>
          </Reveal>
          <Reveal delay={120} className="mx-auto max-w-2xl">
            <DashboardMockup />
          </Reveal>
        </div>
      </section>


      {/* ── Built for clarity (feature grid) ──────────────────────────── */}
      <section className="border-y border-[rgba(55,60,61,0.08)] bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Every view, intentional</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">
              No noise. Just the answers that matter.
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-8 text-[var(--muted-foreground)]">
              Each screen is built around a single question: what does this person actually need to know right now? No unnecessary fields. No walls of data to decode.
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal delay={80}>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_36%),#fbfbfd] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold text-[var(--foreground)]">Dashboard overview</p>
                <p className="mt-3 text-base leading-7 text-[var(--muted-foreground)]">Your most recent night, key metrics at a glance, and anything that changed. No digging required.</p>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.10),_transparent_36%),#fbfdf9] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold text-[var(--foreground)]">Calendar history</p>
                <p className="mt-3 text-base leading-7 text-[var(--muted-foreground)]">Color-coded nights make missed sessions, strong streaks, and sudden dips impossible to miss.</p>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(233,120,75,0.10),_transparent_36%),#fffaf8] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold text-[var(--foreground)]">Session detail</p>
                <p className="mt-3 text-base leading-7 text-[var(--muted-foreground)]">Zoom into any night to see a full event timeline, pressure curves, and what drove an outlier reading.</p>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="rounded-[26px] border border-[rgba(55,60,61,0.08)] bg-[radial-gradient(circle_at_top_left,_rgba(201,183,21,0.10),_transparent_36%),#fffdf5] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(55,60,61,0.10)]">
                <p className="text-sm font-bold text-[var(--foreground)]">Trend tracking</p>
                <p className="mt-3 text-base leading-7 text-[var(--muted-foreground)]">See whether AHI, pressure, and leak are moving in the right direction. Week over week, not just night by night.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Doctor conversation illustration ───────────────────────────── */}
      {/*
        IMAGE PROMPT C — "Confident doctor conversation"
        Two people sitting across from each other at a desk in a warm, natural-
        light clinic room. One is a patient (any age, relaxed posture, looking
        engaged), the other is a clinician in a white coat. The patient is
        showing the clinician something on a phone screen — a clean graph or
        chart (not detailed). The mood is collaborative and calm — not
        anxious or sterile. Loose editorial illustration style. Palette: cream,
        warm gray, a touch of sage green. 4:3 or 3:2 aspect ratio.
        No text in the image.
      */}
      <section className="border-t border-[rgba(55,60,61,0.08)] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <div className="overflow-hidden rounded-[26px] bg-[#f7f6f3] shadow-[0_18px_48px_rgba(55,60,61,0.08)]">
                <img
                  src={doctorConvo}
                  alt="A patient showing their sleep data to a clinician during an appointment"
                  className="w-full scale-[1.04] object-cover"
                />
              </div>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--orange-700)]">Come prepared</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">
                Better data makes for better conversations with your doctor.
              </h2>
              <p className="mt-4 text-lg leading-8 text-[var(--muted-foreground)]">
                Walk into your next appointment with a clear picture of what's been happening, not just a vague sense that something feels off. AI summaries surface the right questions so you can use the time you have with your specialist well.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-[rgba(55,60,61,0.08)] bg-[#f7f6f3] py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--accent)]">FAQ</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">Common questions</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <div className="overflow-hidden rounded-[20px] border border-[rgba(55,60,61,0.08)] bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span className="pr-4 text-base font-bold text-[var(--foreground)]">{faq.q}</span>
                    <ChevronRightIcon
                      className={`h-5 w-5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 ${openFaq === i ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-[rgba(55,60,61,0.08)] px-6 pb-5 pt-4">
                      <p className="text-base leading-7 text-[var(--muted-foreground)]">{faq.a}</p>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / privacy strip ───────────────────────────────────────── */}
      <section className="border-t border-[rgba(55,60,61,0.08)] bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--accent-soft)]">
                  <LockIcon className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <p className="mt-4 text-sm font-bold text-[var(--foreground)]">Your data, your control</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Data is encrypted in transit and at rest. Delete your account and everything goes with it.</p>
              </div>
              <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--green-100)]">
                  <ShieldIcon className="h-5 w-5 text-[var(--green-700)]" />
                </div>
                <p className="mt-4 text-sm font-bold text-[var(--foreground)]">Never sold or shared</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Your health data is yours. We don't sell it, share it, or use it for advertising. Ever.</p>
              </div>
              <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--orange-100)]">
                  <FileIcon className="h-5 w-5 text-[var(--orange-700)]" />
                </div>
                <p className="mt-4 text-sm font-bold text-[var(--foreground)]">Works with your SD card</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">No app installs or cloud sync required. Your CPAP SD card is the source of truth.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24">
        <FloatingOrb
          scrollY={scrollY}
          speed={-0.05}
          className="absolute right-[-8rem] top-10 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(82,81,167,0.10),_transparent_70%)]"
        />
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-[32px] border border-[rgba(55,60,61,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,247,244,0.96))] px-8 py-12 shadow-[0_24px_60px_rgba(55,60,61,0.08)]">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Ready when you are</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-[var(--foreground)]">
                Your SD card has months of data.<br />Let's actually look at it.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
                Create a free account, insert your CPAP SD card, and import your <code className="rounded bg-[var(--surface-strong)] px-1 text-[0.85em]">DATALOG</code> folder. You'll have your first insights in minutes.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/register">
                  <Button className="min-w-40">Create free account</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="min-w-40">Sign in</Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(55,60,61,0.08)] bg-[#f7f6f3] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
            <img src={logo} alt="SleepLab" className="h-10 w-auto object-contain" />
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--muted-foreground)]">
              <Link to="/privacy" className="transition hover:text-[var(--foreground)]">Privacy Policy</Link>
              <Link to="/terms" className="transition hover:text-[var(--foreground)]">Terms of Service</Link>
              <span>© {new Date().getFullYear()} SleepLab. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
