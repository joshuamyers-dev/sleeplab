import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Equipment, EquipmentCreate, EquipmentType } from '../api/client'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'

/**
 * React component or element to render the t y p e_ l a b e l s.
 *
 * @returns The rendered React element.
 */
const TYPE_LABELS: Record<EquipmentType, string> = {
  cushion: 'Cushion / Pillow',
  headgear: 'Headgear',
  tubing: 'Tubing',
  humidifier_chamber: 'Humidifier Chamber',
  filter: 'Filter',
}

const MASK_CATEGORIES = ['Nasal', 'Nasal Pillows', 'Full Face', 'Hybrid']

/**
 * Type definition for the replacement unit.
 */
type ReplacementUnit = 'days' | 'weeks' | 'months' | 'years'

/**
 * React component or element to render the r e p l a c e m e n t_ u n i t_ d a y s.
 *
 * @returns The rendered React element.
 */
const REPLACEMENT_UNIT_DAYS: Record<ReplacementUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
}

// US insurance replacement intervals by type.
// Cushion default is 15d (nasal); updates to 30d when Full Face / Hybrid is selected.
const DEFAULT_REPLACEMENT_DAYS: Record<EquipmentType, number> = {
  cushion: 15,
  headgear: 180,
  tubing: 90,
  humidifier_chamber: 180,
  filter: 30,
}

/**
 * Helper function for cushion days for category.
 */
function cushionDaysForCategory(category: string | null): number {
  if (category === 'Full Face' || category === 'Hybrid') return 30
  return 15
}

/**
 * Helper function for replacement status.
 */
function replacementStatus(item: Equipment): { label: string; className: string } | null {
  if (!item.replacement_days || item.days_in_use == null) return null
  const remaining = item.replacement_days - item.days_in_use
  if (remaining <= 0) return { label: 'Due for replacement', className: 'text-[var(--danger-text)]' }
  if (remaining <= 7) return { label: `Replace in ${remaining}d`, className: 'text-[var(--danger-text)]' }
  if (remaining <= 14) return { label: `Replace in ${remaining}d`, className: 'text-yellow-500' }
  return { label: `${remaining}d until replacement`, className: 'text-[var(--muted-foreground)]' }
}

/**
 * Helper function for remaining replacement days.
 */
function remainingReplacementDays(item: Equipment): number | null {
  if (!item.replacement_days || item.days_in_use == null) return null
  return item.replacement_days - item.days_in_use
}

/**
 * Helper function for equipment label.
 */
function equipmentLabel(item: Equipment): string {
  return [item.brand, item.model].filter(Boolean).join(' ') || TYPE_LABELS[item.equipment_type]
}

/**
 * Helper function for reminder message.
 */
function reminderMessage(remaining: number): string {
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`
  if (remaining === 0) return 'Due today'
  if (remaining === 1) return 'Due tomorrow'
  return `Due in ${remaining}d`
}

/**
 * Helper function for infer replacement unit.
 */
function inferReplacementUnit(days: number | null | undefined): ReplacementUnit {
  if (!days) return 'days'
  if (days % REPLACEMENT_UNIT_DAYS.years === 0) return 'years'
  if (days % REPLACEMENT_UNIT_DAYS.months === 0) return 'months'
  if (days % REPLACEMENT_UNIT_DAYS.weeks === 0) return 'weeks'
  return 'days'
}

/**
 * Helper function for replacement interval value.
 */
function replacementIntervalValue(days: number | null | undefined, unit: ReplacementUnit): string {
  if (!days) return ''
  const value = days / REPLACEMENT_UNIT_DAYS[unit]
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

/**
 * React component or element to render the e m p t y_ f o r m.
 *
 * @returns The rendered React element.
 */
const EMPTY_FORM: EquipmentCreate = {
  equipment_type: 'cushion',
  start_date: new Date().toISOString().slice(0, 10),
  replacement_days: DEFAULT_REPLACEMENT_DAYS['cushion'],
  mask_category: null,
  brand: null,
  model: null,
  notes: null,
}

/**
 * React component or element to render the equipment catalog.
 *
 * @returns The rendered React element.
 */
export default function EquipmentCatalog() {
  const [items, setItems] = useState<Equipment[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EquipmentCreate>({ ...EMPTY_FORM })
  const [replacementIntervalUnit, setReplacementIntervalUnit] = useState<ReplacementUnit>(
    inferReplacementUnit(EMPTY_FORM.replacement_days),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.listEquipment().then(setItems).catch(() => {})
  }, [])

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setReplacementIntervalUnit(inferReplacementUnit(EMPTY_FORM.replacement_days))
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openReplacement(item: Equipment) {
    setReplacementIntervalUnit(inferReplacementUnit(item.replacement_days))
    setForm({
      equipment_type: item.equipment_type,
      start_date: new Date().toISOString().slice(0, 10),
      replacement_days: item.replacement_days,
      mask_category: item.mask_category,
      brand: item.brand,
      model: item.model,
      notes: item.notes,
    })
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(item: Equipment) {
    setReplacementIntervalUnit(inferReplacementUnit(item.replacement_days))
    setForm({
      equipment_type: item.equipment_type,
      start_date: item.start_date,
      replacement_days: item.replacement_days,
      mask_category: item.mask_category,
      brand: item.brand,
      model: item.model,
      notes: item.notes,
    })
    setEditingId(item.id)
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  function setField<K extends keyof EquipmentCreate>(key: K, value: EquipmentCreate[K]) {
    if (key === 'equipment_type') {
      const t = value as EquipmentType
      const replacementDays = DEFAULT_REPLACEMENT_DAYS[t]
      setReplacementIntervalUnit(inferReplacementUnit(replacementDays))
      setForm(f => ({
        ...f,
        equipment_type: t,
        replacement_days: replacementDays,
        mask_category: t !== 'cushion' ? null : f.mask_category,
      }))
    } else if (key === 'mask_category') {
      const cat = value as string | null
      const replacementDays = cushionDaysForCategory(cat)
      setReplacementIntervalUnit(inferReplacementUnit(replacementDays))
      setForm(f => ({
        ...f,
        mask_category: cat,
        replacement_days: f.equipment_type === 'cushion' ? replacementDays : f.replacement_days,
      }))
    } else {
      setForm(f => ({ ...f, [key]: value }))
    }
  }

  function setReplacementInterval(value: string) {
    const numericValue = Number(value)
    setForm(f => ({
      ...f,
      replacement_days: value && Number.isFinite(numericValue) && numericValue > 0
        ? Math.round(numericValue * REPLACEMENT_UNIT_DAYS[replacementIntervalUnit])
        : null,
    }))
  }

  function setReplacementUnit(unit: ReplacementUnit) {
    const currentValue = replacementIntervalValue(form.replacement_days, replacementIntervalUnit)
    setReplacementIntervalUnit(unit)
    if (currentValue) {
      const numericValue = Number(currentValue)
      setForm(f => ({
        ...f,
        replacement_days: Number.isFinite(numericValue) && numericValue > 0
          ? Math.round(numericValue * REPLACEMENT_UNIT_DAYS[unit])
          : null,
      }))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const updated = await api.updateEquipment(editingId, {
          start_date: form.start_date,
          replacement_days: form.replacement_days,
          mask_category: form.mask_category,
          brand: form.brand,
          model: form.model,
          notes: form.notes,
        })
        setItems(prev => prev.map(i => i.id === editingId ? updated : i))
      } else {
        const created = await api.createEquipment(form)
        setItems(prev => [created, ...prev])
      }
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save equipment')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingId !== id) { setDeletingId(id); return }
    try {
      await api.deleteEquipment(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      // silently ignore — item still visible
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = Object.fromEntries(
    (['cushion', 'headgear', 'tubing', 'humidifier_chamber', 'filter'] as EquipmentType[]).map(t => [
      t,
      items.filter(i => i.equipment_type === t),
    ])
  ) as Record<EquipmentType, Equipment[]>

  const reminderItems = items
    .map(item => ({ item, remaining: remainingReplacementDays(item) }))
    .filter((entry): entry is { item: Equipment; remaining: number } => entry.remaining != null && entry.remaining <= 14)
    .sort((a, b) => a.remaining - b.remaining)

  return (
    <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
      <CardHeader>
        <CardTitle className="text-2xl">Equipment</CardTitle>
        <CardDescription>
          Track your CPAP consumables. Add a start date when you begin using new equipment — SleepLab will show age and replacement reminders on each session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {reminderItems.length > 0 && (
          <div className="space-y-3 rounded-[18px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
            <div>
              <p className="text-sm font-bold text-[var(--accent)]">Replacement reminders</p>
              <p className="text-sm text-[var(--accent)]/80">
                These tracked items are due within the next two weeks.
              </p>
            </div>
            <div className="space-y-2">
              {reminderItems.map(({ item, remaining }) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-[14px] bg-[var(--surface-strong)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {equipmentLabel(item)}
                      {item.mask_category ? <span className="font-medium text-[var(--muted-foreground)]"> · {item.mask_category}</span> : null}
                    </p>
                    <p className={`text-xs font-bold ${remaining <= 7 ? 'text-[var(--danger-text)]' : 'text-yellow-500'}`}>
                      {reminderMessage(remaining)}
                      {item.days_in_use != null ? ` · ${item.days_in_use}d in use` : ''}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openReplacement(item)}>
                    Log replacement
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Item list grouped by type */}
        {(['cushion', 'headgear', 'tubing', 'humidifier_chamber', 'filter'] as EquipmentType[]).map(type => (
          grouped[type].length > 0 && (
            <div key={type}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-2">
                {TYPE_LABELS[type]}
              </p>
              <div className="space-y-2">
                {grouped[type].map(item => {
                  const status = replacementStatus(item)
                  const label = equipmentLabel(item)
                  const categoryTag = item.mask_category ? ` · ${item.mask_category}` : ''
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--surface-soft)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {label}{categoryTag}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Started {item.start_date}
                          {item.days_in_use != null && ` · ${item.days_in_use}d in use`}
                          {status && <span className={status.className}> · {status.label}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={deletingId === item.id ? 'border-[var(--danger-text)] text-[var(--danger-text)]' : ''}
                          onClick={() => handleDelete(item.id)}
                        >
                          {deletingId === item.id ? 'Confirm' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        ))}

        {items.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-foreground)]">No equipment tracked yet.</p>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 space-y-4">
            <p className="text-sm font-semibold">{editingId ? 'Edit equipment' : 'Add equipment'}</p>

            {!editingId && (
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex flex-wrap gap-2">
                  {(['cushion', 'headgear', 'tubing', 'humidifier_chamber', 'filter'] as EquipmentType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField('equipment_type', t)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                        form.equipment_type === t
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.equipment_type === 'cushion' && (
              <>
                <div className="space-y-2">
                  <Label>Mask type</Label>
                  <div className="flex flex-wrap gap-2">
                    {MASK_CATEGORIES.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setField('mask_category', form.mask_category === c ? null : c)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                          form.mask_category === c
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="eq-brand">Brand</Label>
                    <Input id="eq-brand" value={form.brand ?? ''} placeholder="e.g. ResMed"
                      onChange={e => setField('brand', e.target.value || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eq-model">Model</Label>
                    <Input id="eq-model" value={form.model ?? ''} placeholder="e.g. AirFit P10"
                      onChange={e => setField('model', e.target.value || null)} />
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eq-start">Start date</Label>
                <Input id="eq-start" type="date" value={form.start_date}
                  onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-replace">Replace every</Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Input
                    id="eq-replace"
                    inputMode="decimal"
                    value={replacementIntervalValue(form.replacement_days, replacementIntervalUnit)}
                    placeholder="Optional"
                    onChange={e => setReplacementInterval(e.target.value)}
                  />
                  <select
                    value={replacementIntervalUnit}
                    onChange={e => setReplacementUnit(e.target.value as ReplacementUnit)}
                    className="flex h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
                  >
                    <option value="days" className="bg-[var(--surface-strong)] text-[var(--foreground)]">Days</option>
                    <option value="weeks" className="bg-[var(--surface-strong)] text-[var(--foreground)]">Weeks</option>
                    <option value="months" className="bg-[var(--surface-strong)] text-[var(--foreground)]">Months</option>
                    <option value="years" className="bg-[var(--surface-strong)] text-[var(--foreground)]">Years</option>
                  </select>
                </div>
                {form.replacement_days ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Saved as {form.replacement_days} days for reminders.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eq-notes">Notes</Label>
              <Input id="eq-notes" value={form.notes ?? ''} placeholder="Optional"
                onChange={e => setField('notes', e.target.value || null)} />
            </div>

            {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
              </Button>
              <Button variant="outline" onClick={cancelForm}>Cancel</Button>
            </div>
          </div>
        )}

        {!showForm && (
          <Button variant="outline" onClick={openAdd}>Add equipment</Button>
        )}
      </CardContent>
    </Card>
  )
}
