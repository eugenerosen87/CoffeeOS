import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

const EMPTY = {
  lot_id:'', purchase_date: new Date().toISOString().split('T')[0],
  supplier:'', origin:'', farm:'', process:'Washed', variety:'',
  screen_size:'', altitude:'',
  purchased_kg:'', cost_per_kg:'', stock_kg:'', threshold:'5',
  cupping_score:'', cupping_notes:''
}

export default function GreenForm({ open, lot, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const isEditing = !!lot

  useEffect(() => {
    if (!open) return
    if (lot) {
      setForm({
        ...EMPTY, ...lot,
        purchase_date: lot.purchase_date ? lot.purchase_date.split('T')[0] : '',
        threshold: String(lot.threshold || 5),
        cupping_score: String(lot.cupping_score || ''),
      })
    } else {
      setForm({ ...EMPTY, purchase_date: new Date().toISOString().split('T')[0] })
    }
  }, [open, lot])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.lot_id.trim()) { toast('Lot ID is required', true); return }
    setSaving(true)
    const payload = {
      lot_id: form.lot_id.trim(),
      purchase_date: form.purchase_date || null,
      supplier: form.supplier, origin: form.origin, farm: form.farm,
      process: form.process, variety: form.variety,
      screen_size: form.screen_size, altitude: form.altitude,
      purchased_kg: parseFloat(form.purchased_kg) || 0,
      cost_per_kg: parseFloat(form.cost_per_kg) || 0,
      stock_kg: parseFloat(form.stock_kg) || 0,
      threshold: parseFloat(form.threshold) || 5,
      cupping_score: parseFloat(form.cupping_score) || 0,
      cupping_notes: form.cupping_notes,
    }
    const { error } = isEditing
      ? await supabase.from('greens').update(payload).eq('lot_id', lot.lot_id)
      : await supabase.from('greens').insert(payload)
    if (error) { toast('Error: ' + error.message, true); setSaving(false); return }
    setSaving(false)
    toast(isEditing ? 'Lot updated' : 'Lot added')
    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <div className="modal-title">{isEditing ? `Edit Lot — ${lot.lot_id}` : 'New Green Lot'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fsec">Lot Identity</div>
            <div className="form-group"><label>Lot ID</label><input value={form.lot_id} onChange={e => set('lot_id', e.target.value)} placeholder="e.g. ETH-YIRG-2026-01" disabled={isEditing} /></div>
            <div className="form-group"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></div>
            <div className="form-group"><label>Supplier</label><input value={form.supplier} onChange={e => set('supplier', e.target.value)} /></div>
            <div className="fsec">Origin</div>
            <div className="form-group"><label>Country / Origin</label><input value={form.origin} onChange={e => set('origin', e.target.value)} /></div>
            <div className="form-group"><label>Farm / Station</label><input value={form.farm} onChange={e => set('farm', e.target.value)} /></div>
            <div className="form-group">
              <label>Process</label>
              <select value={form.process} onChange={e => set('process', e.target.value)}>
                {['Washed','Natural','Honey','Anaerobic'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Variety</label><input value={form.variety} onChange={e => set('variety', e.target.value)} /></div>
            <div className="form-group"><label>Screen Size</label><input value={form.screen_size} onChange={e => set('screen_size', e.target.value)} /></div>
            <div className="form-group"><label>Altitude</label><input value={form.altitude} onChange={e => set('altitude', e.target.value)} /></div>
            <div className="fsec">Stock & Pricing</div>
            <div className="form-group"><label>Purchased kg</label><input type="number" step="0.1" value={form.purchased_kg} onChange={e => set('purchased_kg', e.target.value)} /></div>
            <div className="form-group"><label>Cost per kg (R)</label><input type="number" step="0.01" value={form.cost_per_kg} onChange={e => set('cost_per_kg', e.target.value)} /></div>
            <div className="form-group"><label>Current stock kg</label><input type="number" step="0.1" value={form.stock_kg} onChange={e => set('stock_kg', e.target.value)} /></div>
            <div className="form-group"><label>Low stock alert (kg)</label><input type="number" step="1" value={form.threshold} onChange={e => set('threshold', e.target.value)} /></div>
            <div className="fsec">Cupping</div>
            <div className="form-group"><label>Cupping Score (0–100)</label><input type="number" step="0.1" value={form.cupping_score} onChange={e => set('cupping_score', e.target.value)} /></div>
            <div className="form-group full"><label>Cupping Notes</label><textarea value={form.cupping_notes} onChange={e => set('cupping_notes', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Lot'}
          </button>
        </div>
      </div>
    </div>
  )
}
