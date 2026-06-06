import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/coffee'
import { useToast } from '../lib/toast'

const TYPE_LABELS = {
  purchase_in:    { label:'Purchase In',    color:'var(--green2)',  sign:'+' },
  roast_out:      { label:'Roast Out',      color:'var(--red2)',   sign:'-' },
  adjustment_in:  { label:'Adjustment In',  color:'var(--gold)',   sign:'+' },
  adjustment_out: { label:'Adjustment Out', color:'var(--gold)',   sign:'-' },
  waste_out:      { label:'Waste',          color:'var(--red2)',   sign:'-' },
}

export default function StockLedger() {
  const [movements, setMovements] = useState([])
  const [coffees, setCoffees]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterCoffee, setFilterCoffee] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [adjForm, setAdjForm]     = useState({ open:false, coffee_id:'', type:'adjustment_in', qty:'', note:'' })
  const toast = useToast()

  const load = async () => {
    const [{ data:m },{ data:c }] = await Promise.all([
      supabase.from('inventory_movements').select('*').order('created_at',{ascending:false}).limit(200),
      supabase.from('green_coffees').select('coffee_id,origin').order('coffee_id'),
    ])
    setMovements(m||[]); setCoffees(c||[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const handleAdjustment = async () => {
    if (!adjForm.coffee_id||!adjForm.qty) return
    const { error } = await supabase.from('inventory_movements').insert({
      coffee_id: adjForm.coffee_id,
      movement_type: adjForm.type,
      quantity_kg: parseFloat(adjForm.qty)||0,
      reference_type: 'manual',
      note: adjForm.note || 'Manual adjustment',
    })
    if (error) { toast('Error: '+error.message, true); return }
    setAdjForm({ open:false, coffee_id:'', type:'adjustment_in', qty:'', note:'' })
    load()
  }

  const filtered = movements.filter(m => {
    if (filterCoffee && m.coffee_id !== filterCoffee) return false
    if (filterType && m.movement_type !== filterType) return false
    return true
  })

  const totalIn  = filtered.filter(m=>m.movement_type.includes('_in')).reduce((s,m)=>s+Number(m.quantity_kg),0)
  const totalOut = filtered.filter(m=>m.movement_type.includes('_out')).reduce((s,m)=>s+Number(m.quantity_kg),0)

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Stock Ledger</div><div className="page-sub">Append-only inventory movements</div></div>
        <button className="btn btn-outline" onClick={()=>setAdjForm(a=>({...a,open:true}))}>+ Manual Adjustment</button>
      </div>

      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 16px',marginBottom:20,fontSize:12,color:'var(--text3)'}}>
        Every stock change is recorded here as an immutable entry. Nothing is deleted — adjustments are new rows. This is your audit trail.
      </div>

      <div className="stats-grid" style={{marginBottom:20}}>
        <div className="stat-card"><div className="stat-label">Total In</div><div className="stat-val" style={{color:'var(--green2)'}}>+{totalIn.toFixed(1)} kg</div></div>
        <div className="stat-card"><div className="stat-label">Total Out</div><div className="stat-val" style={{color:'var(--red2)'}}>-{totalOut.toFixed(1)} kg</div></div>
        <div className="stat-card"><div className="stat-label">Net</div><div className="stat-val">{(totalIn-totalOut).toFixed(1)} kg</div></div>
        <div className="stat-card"><div className="stat-label">Movements</div><div className="stat-val">{filtered.length}</div></div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <select value={filterCoffee} onChange={e=>setFilterCoffee(e.target.value)} style={{width:200}}>
          <option value="">All coffees</option>
          {coffees.map(c=><option key={c.coffee_id} value={c.coffee_id}>{c.coffee_id} · {c.origin}</option>)}
        </select>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{width:180}}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterCoffee||filterType)&&<button className="btn btn-ghost btn-sm" onClick={()=>{setFilterCoffee('');setFilterType('')}}>Clear</button>}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Coffee</th><th>Type</th><th>Quantity</th><th>Reference</th><th>Note</th></tr></thead>
          <tbody>
            {loading&&<tr><td colSpan="6"><div className="loading">Loading…</div></td></tr>}
            {!loading&&!filtered.length&&<tr><td colSpan="6"><div className="empty">No movements found</div></td></tr>}
            {filtered.map(m=>{
              const t = TYPE_LABELS[m.movement_type]||{label:m.movement_type,color:'var(--text2)',sign:''}
              return (
                <tr key={m.id}>
                  <td>{fmtDate(m.created_at)}</td>
                  <td className="td-id">{m.coffee_id||'—'}</td>
                  <td><span style={{fontSize:11,color:t.color,fontWeight:600}}>{t.label}</span></td>
                  <td style={{fontFamily:'var(--font-mono)',color:t.color,fontWeight:600}}>
                    {t.sign}{Number(m.quantity_kg).toFixed(2)} kg
                  </td>
                  <td className="td-muted">{m.reference_id ? `${m.reference_type} / ${m.reference_id.slice(0,8)}…` : m.reference_type||'—'}</td>
                  <td className="td-muted">{m.note||'—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Adjustment modal */}
      {adjForm.open && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setAdjForm(a=>({...a,open:false}))}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-hd">
              <div className="modal-title">Manual Adjustment</div>
              <button className="btn btn-ghost" onClick={()=>setAdjForm(a=>({...a,open:false}))}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:16,lineHeight:1.6}}>
                Use this for corrections, write-offs, waste, or stock takes. Creates a permanent ledger entry.
              </div>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Coffee</label>
                  <select value={adjForm.coffee_id} onChange={e=>setAdjForm(a=>({...a,coffee_id:e.target.value}))}>
                    <option value="">— Select coffee —</option>
                    {coffees.map(c=><option key={c.coffee_id} value={c.coffee_id}>{c.coffee_id} · {c.origin}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={adjForm.type} onChange={e=>setAdjForm(a=>({...a,type:e.target.value}))}>
                    <option value="adjustment_in">Adjustment In (+)</option>
                    <option value="adjustment_out">Adjustment Out (-)</option>
                    <option value="waste_out">Waste / Write-off (-)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity (kg)</label>
                  <input type="number" step="0.1" value={adjForm.qty} onChange={e=>setAdjForm(a=>({...a,qty:e.target.value}))} placeholder="e.g. 0.5"/>
                </div>
                <div className="form-group full">
                  <label>Reason / Note</label>
                  <input value={adjForm.note} onChange={e=>setAdjForm(a=>({...a,note:e.target.value}))} placeholder="e.g. Stock take correction, spill, sample"/>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={()=>setAdjForm(a=>({...a,open:false}))}>Cancel</button>
              <button className="btn btn-gold" onClick={handleAdjustment}>Record Adjustment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
