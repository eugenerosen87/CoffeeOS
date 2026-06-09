import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { fmtDate, ROAST_NAMES } from '../lib/coffee'

// Map format weight_g → packaging size string
const WEIGHT_TO_SIZE = { 125:'125g', 250:'250g', 500:'500g', 1000:'1kg', 2000:'2kg' }

// ── PRODUCT RUN FORM ─────────────────────────────────────────────
function ProductRunForm({ open, onClose, onSaved }) {
  const toast = useToast()
  const [products, setProducts]           = useState([])
  const [formats, setFormats]             = useState([])
  const [packaging, setPackaging]         = useState([])
  const [selectedProductId, setSelected]  = useState('')
  const [recipe, setRecipe]               = useState([])
  const [availableBatches, setBatches]    = useState([])
  const [batchSel, setBatchSel]           = useState({}) // { coffee_id: { batch_id, kg_to_use } }
  const [unitsPacked, setUnitsPacked]     = useState({}) // { format_id: units }
  const [runDate, setRunDate]             = useState('')
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(''); setRecipe([]); setBatchSel({}); setUnitsPacked({}); setNotes('')
    setRunDate(new Date().toISOString().split('T')[0])
    Promise.all([
      supabase.from('products').select('*').eq('archived', false).order('name'),
      supabase.from('formats').select('*').eq('active', true).order('sort_order'),
      supabase.from('packaging').select('*').order('size'),
    ]).then(([{data:p},{data:f},{data:pk}]) => {
      setProducts(p||[]); setFormats(f||[]); setPackaging(pk||[])
    })
  }, [open])

  const handleProductSelect = async (productId) => {
    setSelected(productId); setRecipe([]); setBatchSel({})
    if (!productId) return

    const { data: rec } = await supabase
      .from('product_recipe').select('*').eq('product_id', productId)
    if (!rec?.length) { toast('This product has no recipe — add one in Products first', true); return }

    const coffeeIds = rec.map(r => r.coffee_id)
    const { data: batches } = await supabase
      .from('roasts')
      .select('id, coffee_id, date, roast_level, available_kg')
      .in('coffee_id', coffeeIds)
      .eq('status', 'approved')
      .eq('archived', false)
      .gt('available_kg', 0)
      .order('date', { ascending: false })

    setRecipe(rec)
    setBatches(batches||[])
    const init = {}
    rec.forEach(r => { init[r.coffee_id] = { batch_id:'', kg_to_use:'' } })
    setBatchSel(init)
  }

  const setSel = (coffeeId, key, val) =>
    setBatchSel(prev => ({ ...prev, [coffeeId]: { ...prev[coffeeId], [key]: val } }))

  // Live totals
  const totalKgAllocated = Object.values(batchSel)
    .reduce((s,v) => s + (parseFloat(v.kg_to_use)||0), 0)

  const totalKgInFormats = formats.reduce((s,f) => {
    const u = parseInt(unitsPacked[f.id])||0
    if (!u) return s
    return s + (f.is_wholesale ? u : u * (f.weight_g/1000))
  }, 0)

  const diff = totalKgAllocated - totalKgInFormats

  const handleSave = async () => {
    if (!selectedProductId) { toast('Select a product', true); return }

    // Validate each recipe line has a batch + kg
    for (const r of recipe) {
      const s = batchSel[r.coffee_id]
      if (!s?.batch_id)          { toast(`Select a batch for ${r.coffee_id}`, true); return }
      if (!(parseFloat(s.kg_to_use) > 0)) { toast(`Enter kg to use for ${r.coffee_id}`, true); return }
      const batch = availableBatches.find(b => b.id === s.batch_id)
      if (batch && parseFloat(s.kg_to_use) > Number(batch.available_kg)) {
        toast(`${r.coffee_id}: ${s.kg_to_use} kg exceeds ${Number(batch.available_kg).toFixed(2)} kg available in ${s.batch_id}`, true)
        return
      }
    }
    if (!Object.values(unitsPacked).some(v => parseInt(v) > 0)) {
      toast('Enter at least one format quantity', true); return
    }

    setSaving(true)

    // Build clean units_packed (strip zeros)
    const packed = {}
    Object.entries(unitsPacked).forEach(([fid,v]) => { if (parseInt(v) > 0) packed[fid] = parseInt(v) })

    // 1. Insert product_run
    const { data: run, error: runErr } = await supabase.from('product_runs').insert({
      product_id: selectedProductId,
      run_date: runDate,
      notes,
      units_packed: packed,
      status: 'completed',
      total_kg: totalKgAllocated,
    }).select().single()
    if (runErr) { toast('Error: '+runErr.message, true); setSaving(false); return }

    // 2. Insert batch_allocations
    const allocations = recipe.map(r => ({
      product_run_id: run.id,
      batch_id:       batchSel[r.coffee_id].batch_id,
      coffee_id:      r.coffee_id,
      allocated_kg:   parseFloat(batchSel[r.coffee_id].kg_to_use),
      percentage:     r.percentage,
    }))
    const { error: allocErr } = await supabase.from('batch_allocations').insert(allocations)
    if (allocErr) { toast('Error saving allocations: '+allocErr.message, true); setSaving(false); return }

    // 3. Deduct available_kg from each roast batch
    for (const r of recipe) {
      const s = batchSel[r.coffee_id]
      const batch = availableBatches.find(b => b.id === s.batch_id)
      if (!batch) continue
      const newAvail = Math.max(0, Number(batch.available_kg) - parseFloat(s.kg_to_use))
      await supabase.from('roasts').update({ available_kg: newAvail }).eq('id', s.batch_id)
    }

    // 4. Deduct matching packaging units
    for (const [fid, units] of Object.entries(packed)) {
      const fmt = formats.find(f => f.id === fid)
      if (!fmt || fmt.is_wholesale) continue
      const sizeKey = WEIGHT_TO_SIZE[fmt.weight_g]
      if (!sizeKey) continue
      const pkg = packaging.find(p => p.size === sizeKey && (Number(p.stock_units)||0) > 0)
      if (!pkg) continue
      const newStock = Math.max(0, (Number(pkg.stock_units)||0) - units)
      await supabase.from('packaging').update({ stock_units: newStock }).eq('id', pkg.id)
    }

    setSaving(false)
    toast('Product run saved — batch stock and packaging updated')
    onSaved(); onClose()
  }

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:700}}>
        <div className="modal-hd">
          <div className="modal-title">New Product Run</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Run header */}
          <div className="form-grid">
            <div className="fsec">Run Details</div>
            <div className="form-group full">
              <label>Product</label>
              <select value={selectedProductId} onChange={e=>handleProductSelect(e.target.value)}>
                <option value="">— Select product —</option>
                {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Run Date</label>
              <input type="date" value={runDate} onChange={e=>setRunDate(e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Batch 3 pack run"/>
            </div>
          </div>

          {/* Batch allocations — one per recipe coffee */}
          {recipe.length > 0 && (
            <>
              <div className="fsec" style={{marginTop:16,marginBottom:10}}>Batch Allocations</div>
              {recipe.map(r => {
                const batches = availableBatches.filter(b => b.coffee_id === r.coffee_id)
                const sel     = batchSel[r.coffee_id] || {}
                const picked  = batches.find(b => b.id === sel.batch_id)
                return (
                  <div key={r.coffee_id} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'12px 14px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <div>
                        <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--gold)'}}>{r.coffee_id}</span>
                        <span style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>{r.percentage}% of blend</span>
                      </div>
                      {batches.length === 0 && (
                        <span style={{fontSize:11,color:'var(--red2)'}}>⚠ No approved batches available</span>
                      )}
                    </div>
                    <div className="form-grid" style={{gap:10}}>
                      <div className="form-group">
                        <label>Batch (approved, stock available)</label>
                        <select value={sel.batch_id||''} onChange={e=>setSel(r.coffee_id,'batch_id',e.target.value)}>
                          <option value="">— Select batch —</option>
                          {batches.map(b=>(
                            <option key={b.id} value={b.id}>
                              {b.id} · {ROAST_NAMES[b.roast_level]||b.roast_level} · {Number(b.available_kg||0).toFixed(2)} kg avail
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Kg to draw</label>
                        <input type="number" step="0.01" min="0"
                          value={sel.kg_to_use||''}
                          onChange={e=>setSel(r.coffee_id,'kg_to_use',e.target.value)}
                          placeholder="e.g. 5.0"
                          style={picked && parseFloat(sel.kg_to_use) > Number(picked.available_kg) ? {borderColor:'var(--red)'} : {}}
                        />
                        {picked && (
                          <div className="form-hint">{Number(picked.available_kg||0).toFixed(2)} kg available · roasted {fmtDate(picked.date)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Units packed per format */}
          {recipe.length > 0 && (
            <>
              <div className="fsec" style={{marginTop:16,marginBottom:10}}>Units Packed per Format</div>
              <div className="form-grid">
                {formats.filter(f=>f.active).map(fmt => (
                  <div className="form-group" key={fmt.id}>
                    <label>{fmt.name} {fmt.is_wholesale ? '(kg)' : '(units)'}</label>
                    <input
                      type="number" step={fmt.is_wholesale ? '0.1' : '1'} min="0"
                      value={unitsPacked[fmt.id]||''}
                      onChange={e=>setUnitsPacked(p=>({...p,[fmt.id]:e.target.value}))}
                      placeholder="0"
                    />
                    {!fmt.is_wholesale && (parseInt(unitsPacked[fmt.id])||0) > 0 && (
                      <div className="form-hint">
                        = {((parseInt(unitsPacked[fmt.id])||0) * fmt.weight_g / 1000).toFixed(3)} kg
                        {packaging.find(p=>p.size===WEIGHT_TO_SIZE[fmt.weight_g])
                          ? ` · ${packaging.find(p=>p.size===WEIGHT_TO_SIZE[fmt.weight_g]).stock_units} bags in stock`
                          : ' · no matching packaging found'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Totals summary */}
          {(totalKgAllocated > 0 || totalKgInFormats > 0) && (
            <div style={{background:'var(--bg4)',border:'1px solid '+(Math.abs(diff)>0.5?'var(--gold-dim)':'var(--border2)'),borderRadius:6,padding:'14px 18px',marginTop:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,textAlign:'center'}}>
                {[
                  ['Drawn from batches', totalKgAllocated.toFixed(3)+' kg', 'var(--text)'],
                  ['Packed into formats', totalKgInFormats.toFixed(3)+' kg', 'var(--text)'],
                  ['Difference', (diff >= 0 ? '+' : '')+diff.toFixed(3)+' kg', Math.abs(diff) > 0.5 ? 'var(--gold)' : 'var(--green2)'],
                ].map(([l,v,c])=>(
                  <div key={l}>
                    <div style={{fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>{l}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:15,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
              {Math.abs(diff) > 0.2 && (
                <div style={{fontSize:10,color:'var(--text3)',marginTop:8,textAlign:'center'}}>
                  A small difference is normal — accounts for tare weight, packing waste or wholesale kg.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving||!recipe.length}>
            {saving ? 'Saving…' : 'Record Run'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────
export default function ProductRuns() {
  const [runs, setRuns]         = useState([])
  const [formats, setFormats]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [expanding, setExpanding] = useState(null)
  const [runDetails, setRunDetails] = useState({}) // { run_id: allocation[] }
  const toast = useToast()

  const load = async () => {
    const [{ data:r },{ data:f }] = await Promise.all([
      supabase.from('product_runs').select('*, products(name)').order('run_date',{ascending:false}),
      supabase.from('formats').select('*').eq('active',true).order('sort_order'),
    ])
    setRuns(r||[]); setFormats(f||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleExpand = async (runId) => {
    if (expanding === runId) { setExpanding(null); return }
    if (!runDetails[runId]) {
      const { data } = await supabase.from('batch_allocations').select('*').eq('product_run_id', runId)
      setRunDetails(d => ({ ...d, [runId]: data||[] }))
    }
    setExpanding(runId)
  }

  const totalRuns   = runs.length
  const totalKg     = runs.reduce((s,r)=>s+Number(r.total_kg||0),0)
  const totalUnits  = runs.reduce((s,r)=>{
    if (!r.units_packed) return s
    return s + Object.values(r.units_packed).reduce((a,v)=>a+(parseInt(v)||0),0)
  }, 0)

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <div className="page-title">Product Runs</div>
          <div className="page-sub">Pack roasted batches into sellable formats</div>
        </div>
        <button className="btn btn-gold" onClick={()=>setFormOpen(true)}>+ New Run</button>
      </div>

      <div className="stats-grid">
        {[
          ['Runs Recorded',  totalRuns,              ''],
          ['Total Kg Packed', totalKg.toFixed(1)+' kg',''],
          ['Total Units',    totalUnits,              ''],
        ].map(([l,v,s])=>(
          <div className="stat-card" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-val">{v}</div>
            {s&&<div className="stat-sub">{s}</div>}
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Product</th><th>Total Kg</th><th>Units Packed</th><th>Notes</th><th></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6"><div className="loading">Loading…</div></td></tr>}
            {!loading && !runs.length && (
              <tr><td colSpan="6">
                <div className="empty">
                  <div className="empty-icon">◉</div>
                  No product runs yet — click New Run to pack your first batch
                </div>
              </td></tr>
            )}
            {runs.map(r => {
              const unitsTotal = r.units_packed
                ? Object.values(r.units_packed).reduce((s,v)=>s+(parseInt(v)||0),0)
                : 0
              const isOpen = expanding === r.id
              return [
                <tr key={r.id} style={{cursor:'pointer'}} onClick={()=>handleExpand(r.id)}>
                  <td>{fmtDate(r.run_date)}</td>
                  <td style={{fontWeight:500}}>{r.products?.name||'—'}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{Number(r.total_kg||0).toFixed(2)} kg</td>
                  <td>
                    {r.units_packed && Object.keys(r.units_packed).length > 0
                      ? Object.entries(r.units_packed).map(([fid,u])=>{
                          const fmt = formats.find(f=>f.id===fid)
                          return (
                            <span key={fid} style={{display:'inline-block',marginRight:8,fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text2)'}}>
                              {u}× {fmt?.name||fid.slice(0,8)}
                            </span>
                          )
                        })
                      : <span className="td-muted">—</span>
                    }
                  </td>
                  <td className="td-muted">{r.notes||'—'}</td>
                  <td style={{color:'var(--text3)',fontSize:11,userSelect:'none'}}>{isOpen?'▲':'▼'}</td>
                </tr>,
                isOpen && (
                  <tr key={r.id+'-detail'}>
                    <td colSpan="6" style={{background:'var(--bg3)',padding:'14px 20px',borderTop:'none'}}>
                      <div style={{fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:10}}>
                        Batch Allocations
                      </div>
                      {(runDetails[r.id]||[]).map(a=>(
                        <div key={a.id} style={{display:'flex',gap:16,fontSize:12,marginBottom:6,alignItems:'center'}}>
                          <span style={{fontFamily:'var(--font-mono)',color:'var(--gold)',minWidth:130}}>{a.batch_id}</span>
                          <span style={{color:'var(--text2)',minWidth:90}}>{a.coffee_id}</span>
                          <span style={{color:'var(--text3)',minWidth:50}}>{a.percentage}%</span>
                          <span style={{fontFamily:'var(--font-mono)',color:'var(--green2)',fontWeight:600}}>
                            {Number(a.allocated_kg).toFixed(3)} kg
                          </span>
                        </div>
                      ))}
                      {(runDetails[r.id]||[]).length === 0 && (
                        <div style={{color:'var(--text3)',fontSize:12}}>No allocation detail recorded.</div>
                      )}
                    </td>
                  </tr>
                )
              ]
            })}
          </tbody>
        </table>
      </div>

      <ProductRunForm open={formOpen} onClose={()=>setFormOpen(false)} onSaved={load}/>
    </div>
  )
}
