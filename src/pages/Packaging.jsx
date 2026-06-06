import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/coffee'
import { useToast } from '../lib/toast'

function BuyForm({ open, pkg, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ purchase_date:'', units_bought:'', cost_per_unit:'', notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !pkg) return
    setForm({
      purchase_date: new Date().toISOString().split('T')[0],
      units_bought: '',
      cost_per_unit: pkg.cost_per_unit || '',
      notes: ''
    })
  }, [open, pkg])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.units_bought) { toast('Units required', true); return }
    setSaving(true)
    const units = parseInt(form.units_bought)||0
    const cost  = parseFloat(form.cost_per_unit)||0

    // Log the purchase
    const { error: pe } = await supabase.from('packaging_purchases').insert({
      packaging_id: pkg.id,
      purchase_date: form.purchase_date,
      units_bought: units,
      cost_per_unit: cost,
      notes: form.notes,
    })
    if (pe) { toast('Error: '+pe.message, true); setSaving(false); return }

    // Add to stock
    const { error: se } = await supabase.from('packaging')
      .update({ stock_units: (Number(pkg.stock_units)||0) + units, cost_per_unit: cost })
      .eq('id', pkg.id)
    if (se) { toast('Error: '+se.message, true); setSaving(false); return }

    setSaving(false)
    toast(`Added ${units} units to stock`)
    onSaved(); onClose()
  }

  if (!open || !pkg) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-hd">
          <div className="modal-title">Restock — {pkg.name}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={e=>set('purchase_date',e.target.value)} /></div>
            <div className="form-group"><label>Units Bought</label><input type="number" step="1" value={form.units_bought} onChange={e=>set('units_bought',e.target.value)} placeholder="e.g. 500" /></div>
            <div className="form-group">
              <label>Cost per unit (R)</label>
              <input type="number" step="0.01" value={form.cost_per_unit} onChange={e=>set('cost_per_unit',e.target.value)} />
            </div>
            <div className="form-group"><label>Notes</label><input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="e.g. Supplier, batch number" /></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Add Stock'}</button>
        </div>
      </div>
    </div>
  )
}

function EditPkgForm({ open, pkg, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ name:'', size:'250g', cost_per_unit:'', low_stock_threshold:'', stock_units:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (pkg) setForm({ name:pkg.name||'', size:pkg.size||'250g', cost_per_unit:pkg.cost_per_unit||'', low_stock_threshold:pkg.low_stock_threshold||50, stock_units:pkg.stock_units||0 })
    else setForm({ name:'', size:'250g', cost_per_unit:'', low_stock_threshold:'50', stock_units:'0' })
  }, [open, pkg])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Name required', true); return }
    setSaving(true)
    const payload = { name:form.name.trim(), size:form.size, cost_per_unit:parseFloat(form.cost_per_unit)||0, low_stock_threshold:parseInt(form.low_stock_threshold)||50, stock_units:parseInt(form.stock_units)||0 }
    const { error } = pkg
      ? await supabase.from('packaging').update(payload).eq('id', pkg.id)
      : await supabase.from('packaging').insert(payload)
    if (error) { toast('Error: '+error.message, true); setSaving(false); return }
    setSaving(false)
    toast(pkg ? 'Updated' : 'Material added')
    onSaved(); onClose()
  }

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-hd">
          <div className="modal-title">{pkg ? 'Edit Material' : 'New Packaging Material'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full"><label>Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. 250g Valve Bag" /></div>
            <div className="form-group">
              <label>Size</label>
              <select value={form.size} onChange={e=>set('size',e.target.value)}>
                <option value="250g">250g</option>
                <option value="1kg">1kg</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group"><label>Cost per unit (R)</label><input type="number" step="0.01" value={form.cost_per_unit} onChange={e=>set('cost_per_unit',e.target.value)} /></div>
            <div className="form-group"><label>Low stock alert (units)</label><input type="number" step="1" value={form.low_stock_threshold} onChange={e=>set('low_stock_threshold',e.target.value)} /></div>
            <div className="form-group"><label>Current stock (manual override)</label><input type="number" step="1" value={form.stock_units} onChange={e=>set('stock_units',e.target.value)} /></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function PurchaseHistoryModal({ open, pkg, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !pkg) return
    setLoading(true)
    supabase.from('packaging_purchases').select('*')
      .eq('packaging_id', pkg.id)
      .order('purchase_date', { ascending: false })
      .then(({ data }) => { setHistory(data||[]); setLoading(false) })
  }, [open, pkg])

  if (!open || !pkg) return null
  const total = history.reduce((s,h)=>s+Number(h.units_bought),0)
  const spend = history.reduce((s,h)=>s+(Number(h.units_bought)*Number(h.cost_per_unit)),0)

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-hd">
          <div className="modal-title">Purchase History — {pkg.name}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{padding:'16px 26px'}}>
          {loading ? <div className="loading">Loading…</div> : <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
              {[['Orders',history.length],['Total Units',total],['Total Spend','R'+spend.toFixed(0)]].map(([l,v])=>(
                <div key={l} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>{l}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:15,color:'var(--gold)'}}>{v}</div>
                </div>
              ))}
            </div>
            {!history.length ? <div className="empty">No purchases yet</div> :
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Units</th><th>Cost/unit</th><th>Total</th><th>Notes</th></tr></thead>
                  <tbody>
                    {history.map(h=>(
                      <tr key={h.id}>
                        <td>{fmtDate(h.purchase_date)}</td>
                        <td>{h.units_bought}</td>
                        <td>R{Number(h.cost_per_unit).toFixed(2)}</td>
                        <td style={{fontFamily:'var(--font-mono)'}}>R{(Number(h.units_bought)*Number(h.cost_per_unit)).toFixed(0)}</td>
                        <td className="td-muted">{h.notes||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          </>}
        </div>
        <div className="form-actions"><button className="btn btn-gold" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

export default function Packaging() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading]     = useState(true)
  const [buyForm, setBuyForm]     = useState({ open:false, pkg:null })
  const [editForm, setEditForm]   = useState({ open:false, pkg:null })
  const [history, setHistory]     = useState({ open:false, pkg:null })
  const toast = useToast()

  const load = async () => {
    const { data } = await supabase.from('packaging').select('*').order('size')
    setMaterials(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalValue = materials.reduce((s,m)=>s+(Number(m.stock_units)||0)*(Number(m.cost_per_unit)||0),0)
  const lowCount   = materials.filter(m=>Number(m.stock_units)<Number(m.low_stock_threshold)).length

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Packaging</div><div className="page-sub">Bag Stock & Inventory</div></div>
        <button className="btn btn-gold" onClick={()=>setEditForm({open:true,pkg:null})}>+ Add Material</button>
      </div>

      <div className="stats-grid">
        {[
          ['Materials', materials.length, ''],
          ['Low Stock Alerts', lowCount, ''],
          ['Stock Value', 'R '+totalValue.toFixed(0), ''],
        ].map(([l,v])=>(
          <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-val">{v}</div></div>
        ))}
      </div>

      {/* Material cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16,marginBottom:24}}>
        {loading && <div className="loading">Loading…</div>}
        {!loading && !materials.length && (
          <div className="empty"><div className="empty-icon">◻</div>No packaging materials yet</div>
        )}
        {materials.map(m => {
          const stock = Number(m.stock_units)||0
          const threshold = Number(m.low_stock_threshold)||50
          const isEmpty = stock <= 0
          const isLow   = stock < threshold
          const pct     = Math.min(100, threshold > 0 ? (stock/threshold)*100 : 0)
          const barColor = isEmpty ? '#8b3a2a' : isLow ? '#c9a84c' : '#3d6b3a'
          const badgeCls = isEmpty ? 'badge-empty' : isLow ? 'badge-low' : 'badge-ok'
          const badgeTxt = isEmpty ? 'Empty' : isLow ? 'Low Stock' : 'In Stock'

          return (
            <div key={m.id} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
              {/* Header */}
              <div style={{background:'var(--bg3)',padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-head)',fontSize:16,color:'var(--text)'}}>{m.name}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:2,letterSpacing:'1px',textTransform:'uppercase'}}>{m.size} bag</div>
                </div>
                <span className={`badge ${badgeCls}`}>{badgeTxt}</span>
              </div>

              {/* Stock number */}
              <div style={{padding:'18px 18px 12px',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:36,color: isEmpty?'var(--red2)':isLow?'var(--gold)':'var(--green2)',lineHeight:1}}>
                  {stock.toLocaleString()}
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>units in stock</div>

                {/* Bar */}
                <div style={{height:4,background:'var(--bg4)',borderRadius:2,margin:'12px 0 6px',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:2,background:barColor,width:`${Math.min(100,pct)}%`}} />
                </div>
                <div style={{fontSize:10,color:'var(--text3)'}}>Alert at {threshold} units · R{Number(m.cost_per_unit).toFixed(2)}/unit</div>
              </div>

              {/* Actions */}
              <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',display:'flex',gap:8}}>
                <button className="btn btn-gold btn-sm" style={{flex:1}} onClick={()=>setBuyForm({open:true,pkg:m})}>+ Restock</button>
                <button className="btn btn-outline btn-sm" onClick={()=>setHistory({open:true,pkg:m})}>History</button>
                <button className="btn btn-outline btn-sm" onClick={()=>setEditForm({open:true,pkg:m})}>Edit</button>
              </div>
            </div>
          )
        })}
      </div>

      <BuyForm open={buyForm.open} pkg={buyForm.pkg} onClose={()=>setBuyForm({open:false,pkg:null})} onSaved={load} />
      <EditPkgForm open={editForm.open} pkg={editForm.pkg} onClose={()=>setEditForm({open:false,pkg:null})} onSaved={load} />
      <PurchaseHistoryModal open={history.open} pkg={history.pkg} onClose={()=>setHistory({open:false,pkg:null})} />
    </div>
  )
}
