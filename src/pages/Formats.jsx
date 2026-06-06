import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

const EMPTY = { name:'', weight_g:'', is_wholesale:false, bag_cost:'', sticker_cost:'', low_stock_threshold:'', sort_order:'0' }

function FormatForm({ open, format, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(format ? { ...EMPTY, ...format, weight_g: format.weight_g||'', bag_cost: format.bag_cost||'', sticker_cost: format.sticker_cost||'' } : EMPTY)
  }, [open, format])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Name required', true); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      weight_g: form.is_wholesale ? null : (parseFloat(form.weight_g)||null),
      is_wholesale: !!form.is_wholesale,
      bag_cost: parseFloat(form.bag_cost)||0,
      sticker_cost: parseFloat(form.sticker_cost)||0,
      sort_order: parseInt(form.sort_order)||0,
    }
    const { error } = format
      ? await supabase.from('formats').update(payload).eq('id', format.id)
      : await supabase.from('formats').insert(payload)
    if (error) { toast('Error: '+error.message, true); setSaving(false); return }
    toast(format ? 'Format updated' : 'Format added')
    onSaved(); onClose()
    setSaving(false)
  }

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-hd">
          <div className="modal-title">{format ? `Edit — ${format.name}` : 'New Format'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full"><label>Format Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. 500g Bag, Wholesale/kg" /></div>
            <div className="form-group full" style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <input type="checkbox" id="isWholesale" checked={!!form.is_wholesale} onChange={e=>set('is_wholesale',e.target.checked)} style={{width:'auto'}} />
              <label htmlFor="isWholesale" style={{fontSize:13,letterSpacing:0,textTransform:'none',color:'var(--text2)'}}>This is a wholesale / per-kg format (no bag)</label>
            </div>
            {!form.is_wholesale && (
              <div className="form-group"><label>Weight (grams)</label><input type="number" step="1" value={form.weight_g} onChange={e=>set('weight_g',e.target.value)} placeholder="e.g. 500" /></div>
            )}
            <div className="form-group"><label>Bag cost per unit (R)</label><input type="number" step="0.50" value={form.bag_cost} onChange={e=>set('bag_cost',e.target.value)} /></div>
            <div className="form-group"><label>Sticker cost per unit (R)</label><input type="number" step="0.50" value={form.sticker_cost} onChange={e=>set('sticker_cost',e.target.value)} /></div>
            <div className="form-group"><label>Sort order</label><input type="number" step="1" value={form.sort_order} onChange={e=>set('sort_order',e.target.value)} /></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Format'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Formats() {
  const [formats, setFormats] = useState([])
  const [loading, setLoading] = useState(true)
  const [formState, setFormState] = useState({ open:false, format:null })
  const toast = useToast()

  const load = async () => {
    const { data } = await supabase.from('formats').select('*').order('sort_order')
    setFormats(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (fmt) => {
    await supabase.from('formats').update({ active: !fmt.active }).eq('id', fmt.id)
    load()
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('formats').delete().eq('id', id)
    if (error) { toast('Cannot delete — format may be in use', true); return }
    toast('Format deleted'); load()
  }

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Formats</div><div className="page-sub">Selling Format Management</div></div>
        <button className="btn btn-gold" onClick={()=>setFormState({open:true,format:null})}>+ New Format</button>
      </div>

      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 16px',marginBottom:20,fontSize:12,color:'var(--text3)'}}>
        Formats define how you sell coffee — bag sizes, wholesale per kg, etc. Each format has its own bag cost and sticker cost which feed into the costing breakdown. Prices per format are set on each Product.
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Format</th><th>Type</th><th>Weight</th><th>Bag Cost</th><th>Sticker Cost</th><th>Sort</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan="8"><div className="loading">Loading…</div></td></tr>}
            {formats.map(fmt => (
              <tr key={fmt.id}>
                <td style={{fontWeight:600,color:'var(--text)'}}>{fmt.name}</td>
                <td><span className={`badge ${fmt.is_wholesale?'badge-peak':'badge-rest'}`}>{fmt.is_wholesale?'Wholesale':'Bag'}</span></td>
                <td className="td-muted">{fmt.is_wholesale ? 'per kg' : fmt.weight_g ? `${fmt.weight_g}g` : '—'}</td>
                <td>R {Number(fmt.bag_cost||0).toFixed(2)}</td>
                <td>R {Number(fmt.sticker_cost||0).toFixed(2)}</td>
                <td className="td-muted">{fmt.sort_order}</td>
                <td><span className={`badge ${fmt.active?'badge-ok':'badge-rest'}`}>{fmt.active?'Active':'Hidden'}</span></td>
                <td>
                  <div style={{display:'flex',gap:5}}>
                    <button className="btn btn-outline btn-xs" onClick={()=>setFormState({open:true,format:fmt})}>Edit</button>
                    <button className="btn btn-outline btn-xs" onClick={()=>toggleActive(fmt)}>{fmt.active?'Hide':'Show'}</button>
                    <button className="btn btn-danger btn-xs" onClick={()=>handleDelete(fmt.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormatForm open={formState.open} format={formState.format} onClose={()=>setFormState({open:false,format:null})} onSaved={load} />
    </div>
  )
}
