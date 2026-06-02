import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Equipment, EquipmentCreate, EquipmentType } from '../api/client'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'

const TYPE_LABELS: Record<EquipmentType, string> = {
  cushion: 'Cushion / Pillow',
  headgear: 'Headgear',
  tubing: 'Tubing',
  humidifier_chamber: 'Humidifier Chamber',
  filter: 'Filter',
  machine: 'CPAP Machine',
}

const MASK_CATEGORIES = ['Nasal', 'Nasal Pillows', 'Full Face', 'Hybrid']

// US insurance replacement intervals by type.
// Cushion default is 15d (nasal); updates to 30d when Full Face / Hybrid is selected.
const DEFAULT_REPLACEMENT_DAYS: Partial<Record<EquipmentType, number>> = {
  cushion: 15,
  headgear: 180,
  tubing: 90,
  humidifier_chamber: 180,
  filter: 30,
}

const CONSUMABLE_TYPES: EquipmentType[] = ['cushion', 'headgear', 'tubing', 'humidifier_chamber', 'filter']

function cushionDaysForCategory(category: string | null): number {
  if (category === 'Full Face' || category === 'Hybrid') return 30
  return 15
}

function replacementStatus(item: Equipment): { label: string; className: string } | null {
  if (!item.replacement_days || item.days_in_use == null) return null
  const remaining = item.replacement_days - item.days_in_use
  if (remaining <= 0) return { label: 'Due for replacement', className: 'text-[var(--danger-text)]' }
  if (remaining <= 7) return { label: `Replace in ${remaining}d`, className: 'text-[var(--danger-text)]' }
  if (remaining <= 14) return { label: `Replace in ${remaining}d`, className: 'text-yellow-500' }
  return { label: `${remaining}d until replacement`, className: 'text-[var(--muted-foreground)]' }
}

const EMPTY_FORM: EquipmentCreate = {
  equipment_type: 'cushion',
  start_date: new Date().toISOString().slice(0, 10),
  replacement_days: DEFAULT_REPLACEMENT_DAYS['cushion'] ?? null,
  mask_category: null,
  brand: null,
  model: null,
  notes: null,
}

export default function EquipmentCatalog() {
  const [items, setItems] = useState<Equipment[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EquipmentCreate>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.listEquipment().then(setItems).catch(() => {})
  }, [])

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(item: Equipment) {
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
      setForm(f => ({
        ...f,
        equipment_type: t,
        replacement_days: DEFAULT_REPLACEMENT_DAYS[t] ?? null,
        mask_category: t !== 'cushion' ? null : f.mask_category,
      }))
    } else if (key === 'mask_category') {
      const cat = value as string | null
      setForm(f => ({
        ...f,
        mask_category: cat,
        replacement_days: f.equipment_type === 'cushion' ? cushionDaysForCategory(cat) : f.replacement_days,
      }))
    } else {
      setForm(f => ({ ...f, [key]: value }))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const updated = await api.updateEquipment(editingId, {
          start_date: form.start_date ?? undefined,
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
    (['cushion', 'headgear', 'tubing', 'humidifier_chamber', 'filter', 'machine'] as EquipmentType[]).map(t => [
      t,
      items.filter(i => i.equipment_type === t),
    ])
  ) as Record<EquipmentType, Equipment[]>

  return (
    <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
      <CardHeader>
        <CardTitle className="text-2xl">Equipment</CardTitle>
        <CardDescription>
          Track your CPAP consumables. Add a start date when you begin using new equipment — SleepLab will show age and replacement reminders on each session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Machine records (auto-populated by importer, read-only) */}
        {grouped['machine'].length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-2">
              CPAP Machine
            </p>
            <div className="space-y-2">
              {grouped['machine'].map(item => {
                const label = [item.brand, item.model].filter(Boolean).join(' ') || 'Unknown device'
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--surface-soft)] px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{label}</p>
                      {item.device_serial && (
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">{item.device_serial}</p>
                      )}
                      {item.parser_validated != null && (
                        <p className={`text-xs font-medium ${item.parser_validated ? 'text-[var(--olive-deep)]' : 'text-yellow-600'}`}>
                          {item.parser_validated ? '✓ Validated' : '⚠ Parser unvalidated'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Consumable items grouped by type */}
        {CONSUMABLE_TYPES.map(type => (
          grouped[type].length > 0 && (
            <div key={type}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-2">
                {TYPE_LABELS[type]}
              </p>
              <div className="space-y-2">
                {grouped[type].map(item => {
                  const status = replacementStatus(item)
                  const label = [item.brand, item.model].filter(Boolean).join(' ') || TYPE_LABELS[type]
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
                          {status && <span className={` · ${status.className}`}>{status.label}</span>}
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
                  {CONSUMABLE_TYPES.map(t => (
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
                <Input id="eq-start" type="date" value={form.start_date ?? ''}
                  onChange={e => setField('start_date', e.target.value || null)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-replace">Replace every (days)</Label>
                <Input id="eq-replace" inputMode="numeric" value={form.replacement_days ?? ''}
                  placeholder="Optional"
                  onChange={e => setField('replacement_days', e.target.value ? Number(e.target.value) : null)} />
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
