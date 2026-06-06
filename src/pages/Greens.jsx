import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/coffee'
import { useToast } from '../lib/toast'

// ── COFFEE PROFILE FORM ──────────────────────────────────────────
const EMPTY_COFFEE = {
  coffee_id:'', supplier:'', origin:'', farm:'', process:'Washed',
  variety:'', screen_size:'', altitude:'', threshold:'5',
  default_price_per_kg:'', cupping_score:'', cupping_notes:''
}

function CoffeeForm({ open, coffee, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_COFFEE)
  const [saving, setSaving] = useState(false)
  const isEditing = !!coffee

  useEffect(() => {
    if (!open) return
    setForm(coffee ? {
      ...EMPTY_COFFEE, ...coffee,
      threshold: String(coffee.threshold||5),
      cupping_score: String(coffee.cupping_score||''),
    } : EMPTY_COFFEE)
  }, [open, coffee])

  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.coffee_id.trim()) { toast('Coffee ID is required', true); return }
    setSaving(true)
    const payload = {
      coffee_id: form.coffee_id.trim(),
      supplier: form.supplier, origin: form.origin, farm: form.farm,
      process: form.process, variety: form.variety,
      screen_size: form.screen_size, altitude: form.altitude,
      threshold: parseFloat(form.threshold)||5,
      default_price_per_kg: parseFloat(form.default_price_per_kg)||0,
      cupping_score: parseFloat(form.cupping_score)||0,
      cupping_notes: form.cupping_notes,
    }
    const { error } = isEditing
      ? await supabase.from('green_coffees').update(payload).eq('coffee_id', coffee.coffee_id)
      : await supabase.from('green_coffees').insert(payload)
    if (error) { toast('Error: ' + error.message, true); setSaving(false); return }
    setSaving(false)
    toast(isEditing ? 'Coffee updated' : 'Coffee added')
    onSaved(); onClose()
  }

  if (!open) return null
  return (
    <div className="overlay open" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <div className="modal-title">{isEditing ? `Edit — ${coffee.coffee_id}` : 'New Green Coffee'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fsec">Identity</div>
            <div className="form-group">
              <label>Coffee ID</label>
              <input value={form.coffee_id} onChange={e=>set('coffee_id',e.target.value)} placeholder="e.g. ETH-YIRG" disabled={isEditing} />
            </div>
            <div className="form-group"><label>Supplier</label><input value={form.supplier} onChange={e=>set('supplier',e.target.value)} /></div>
            <div className="fsec">Origin</div>
            <div className="form-group"><label>Country / Origin</label><input value={form.origin} onChange={e=>set('origin',e.target.value)} /></div>
            <div className="form-group"><label>Farm / Station</label><input value={form.farm} onChange={e=>set('farm',e.target.value)} /></div>
            <div className="form-group">
              <label>Process</label>
              <select value={form.process} onChange={e=>set('process',e.target.value)}>
                {['Washed','Natural','Honey','Anaerobic'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Variety</label><input value={form.variety} onChange={e=>set('variety',e.target.value)} /></div>
            <div className="form-group"><label>Screen Size</label><input value={form.screen_size} onChange={e=>set('screen_size',e.target.value)} /></div>
            <div className="form-group"><label>Altitude</label><input value={form.altitude} onChange={e=>set('altitude',e.target.value)} /></div>
            <div className="fsec">Purchase Price & Alerts</div>
            <div className="form-group"><label>Default purchase price/kg (R)</label><input type="number" step="0.01" value={form.default_price_per_kg} onChange={e=>set('default_price_per_kg',e.target.value)} placeholder="What you pay per kg" /></div>
            <div className="form-group"><label>Low stock alert (kg)</label><input type="number" step="1" value={form.threshold} onChange={e=>set('threshold',e.target.value)} /></div>
            <div className="fsec">Cupping</div>
            <div className="form-group"><label>Cupping Score (0–100)</label><input type="number" step="0.1" value={form.cupping_score} onChange={e=>set('cupping_score',e.target.value)} /></div>
            <div className="form-group full"><label>Cupping Notes</label><textarea value={form.cupping_notes} onChange={e=>set('cupping_notes',e.target.value)} /></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Coffee'}</button>
        </div>
      </div>
    </div>
  )
}

// ── PURCHASE FORM ────────────────────────────────────────────────
const EMPTY_PURCHASE = { purchase_date:'', purchased_kg:'', cost_per_kg:'', supplier:'', notes:'' }

function PurchaseForm({ open, coffee, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_PURCHASE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !coffee) return
    setForm({
      ...EMPTY_PURCHASE,
      purchase_date: new Date().toISOString().split('T')[0],
      cost_per_kg: coffee.default_price_per_kg || '',
      supplier: coffee.supplier || '',
    })
  }, [open, coffee])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.purchased_kg||!form.cost_per_kg) { toast('Quantity and price are required', true); return }
    setSaving(true)
    const purchasePayload = {
      coffee_id: coffee.coffee_id,
      purchase_date: form.purchase_date || new Date().toISOString().split('T')[0],
      purchased_kg: parseFloat(form.purchased_kg)||0,
      cost_per_kg: parseFloat(form.cost_per_kg)||0,
      supplier: form.supplier,
      notes: form.notes,
    }
    const { data: purchaseData, error } = await supabase.from('green_purchases').insert(purchasePayload).select().single()
    if (error) { toast('Error: ' + error.message, true); setSaving(false); return }

    // Log inventory movement
    await supabase.from('inventory_movements').insert({
      coffee_id: coffee.coffee_id,
      movement_type: 'purchase_in',
      quantity_kg: purchasePayload.purchased_kg,
      reference_id: purchaseData?.id,
      reference_type: 'purchase',
      note: `Purchase: ${purchasePayload.purchased_kg} kg @ R${purchasePayload.cost_per_kg}/kg`
    })

    setSaving(false)
    toast('Purchase logged — stock updated')
    onSaved(); onClose()
  }

  if (!open || !coffee) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-hd">
          <div className="modal-title">Log Purchase — {coffee.coffee_id}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',marginBottom:16,fontSize:12,color:'var(--text2)'}}>
            <strong style={{color:'var(--text)'}}>{coffee.origin}</strong>{coffee.farm?` · ${coffee.farm}`:''} · {coffee.process}
            {coffee.variety?` · ${coffee.variety}`:''}
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={e=>set('purchase_date',e.target.value)} /></div>
            <div className="form-group"><label>Quantity (kg)</label><input type="number" step="0.1" value={form.purchased_kg} onChange={e=>set('purchased_kg',e.target.value)} placeholder="e.g. 60" /></div>
            <div className="form-group">
              <label>Price per kg (R)</label>
              <input type="number" step="0.01" value={form.cost_per_kg} onChange={e=>set('cost_per_kg',e.target.value)} />
              {coffee.default_price_per_kg>0&&<div className="form-hint">Default: R{Number(coffee.default_price_per_kg).toFixed(2)}</div>}
            </div>
            <div className="form-group"><label>Supplier (optional override)</label><input value={form.supplier} onChange={e=>set('supplier',e.target.value)} /></div>
            <div className="form-group full"><label>Notes</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="e.g. New crop, slightly higher moisture" /></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Log Purchase'}</button>
        </div>
      </div>
    </div>
  )
}

// ── PURCHASE HISTORY MODAL (with edit + delete) ─────────────────
function PurchaseHistory({ open, coffee, onClose, onSaved }) {
  const toast = useToast()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)   // purchase row being edited
  const [editForm, setEditForm]   = useState({})
  const [deleting, setDeleting]   = useState(null)   // purchase row awaiting delete confirm
  const [saving, setSaving]       = useState(false)

  const load = () => {
    if (!coffee) return
    setLoading(true)
    supabase.from('green_purchases').select('*')
      .eq('coffee_id', coffee.coffee_id)
      .order('purchase_date', { ascending: false })
      .then(({ data }) => { setPurchases(data||[]); setLoading(false) })
  }

  useEffect(() => { if (open && coffee) load() }, [open, coffee])

  const startEdit = (p) => {
    setEditing(p)
    setEditForm({
      purchase_date: p.purchase_date,
      purchased_kg:  String(p.purchased_kg),
      cost_per_kg:   String(p.cost_per_kg),
      supplier:      p.supplier||'',
      notes:         p.notes||'',
    })
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    const updates = {
      purchase_date: editForm.purchase_date,
      purchased_kg:  parseFloat(editForm.purchased_kg)||0,
      cost_per_kg:   parseFloat(editForm.cost_per_kg)||0,
      supplier:      editForm.supplier,
      notes:         editForm.notes,
    }
    const { error } = await supabase.from('green_purchases').update(updates).eq('id', editing.id)
    if (error) { toast('Error: '+error.message, true); setSaving(false); return }

    // Keep the linked inventory movement in sync
    await supabase.from('inventory_movements')
      .update({
        quantity_kg: updates.purchased_kg,
        note: `Purchase: ${updates.purchased_kg} kg @ R${updates.cost_per_kg}/kg (edited)`,
      })
      .eq('reference_id', editing.id)
      .eq('movement_type', 'purchase_in')

    setSaving(false)
    toast('Purchase updated')
    setEditing(null)
    load()
    onSaved?.()
  }

  const handleDelete = async (p) => {
    const { error } = await supabase.from('green_purchases').delete().eq('id', p.id)
    if (error) { toast('Error: '+error.message, true); return }

    // Remove the linked movement so stock recalculates correctly
    await supabase.from('inventory_movements')
      .delete()
      .eq('reference_id', p.id)
      .eq('movement_type', 'purchase_in')

    toast('Purchase removed — stock corrected')
    setDeleting(null)
    load()
    onSaved?.()
  }

  if (!open || !coffee) return null

  const total    = purchases.reduce((s,p)=>s+Number(p.purchased_kg),0)
  const avgPrice = purchases.length ? purchases.reduce((s,p)=>s+Number(p.cost_per_kg),0)/purchases.length : 0

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:620}}>
        <div className="modal-hd">
          <div className="modal-title">
            {editing ? `Edit Purchase — ${coffee.coffee_id}` : `Purchase History — ${coffee.coffee_id}`}
          </div>
          <button className="btn btn-ghost" onClick={()=>{ setEditing(null); setDeleting(null); onClose() }}>✕</button>
        </div>
        <div className="modal-body" style={{padding:'16px 26px'}}>

          {/* ── EDIT FORM ── */}
          {editing && (
            <>
              <div style={{background:'var(--bg4)',border:'1px solid var(--gold-dim)',borderRadius:6,padding:'14px 16px',marginBottom:16,fontSize:11,color:'var(--text3)'}}>
                Editing this purchase will update both the purchase record and the inventory movement that drove stock.
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Purchase Date</label>
                  <input type="date" value={editForm.purchase_date} onChange={e=>setEditForm(f=>({...f,purchase_date:e.target.value}))}/>
                </div>
                <div className="form-group"><label>Quantity (kg)</label>
                  <input type="number" step="0.1" value={editForm.purchased_kg} onChange={e=>setEditForm(f=>({...f,purchased_kg:e.target.value}))}/>
                </div>
                <div className="form-group"><label>Price per kg (R)</label>
                  <input type="number" step="0.01" value={editForm.cost_per_kg} onChange={e=>setEditForm(f=>({...f,cost_per_kg:e.target.value}))}/>
                </div>
                <div className="form-group"><label>Supplier</label>
                  <input value={editForm.supplier} onChange={e=>setEditForm(f=>({...f,supplier:e.target.value}))}/>
                </div>
                <div className="form-group full"><label>Notes</label>
                  <textarea value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </div>
              <div className="form-actions" style={{padding:'12px 0 0',borderTop:'none'}}>
                <button className="btn btn-outline" onClick={()=>setEditing(null)}>Cancel</button>
                <button className="btn btn-gold" onClick={handleSaveEdit} disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
              </div>
            </>
          )}

          {/* ── LIST VIEW ── */}
          {!editing && (
            loading ? <div className="loading">Loading…</div> : (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
                  {[['Total Purchased',total.toFixed(1)+' kg'],['Purchases',purchases.length],['Avg Price','R'+avgPrice.toFixed(2)+'/kg']].map(([l,v])=>(
                    <div key={l} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
                      <div style={{fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>{l}</div>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:15,color:'var(--gold)'}}>{v}</div>
                    </div>
                  ))}
                </div>
                {!purchases.length
                  ? <div className="empty">No purchases yet</div>
                  : <div className="table-wrap">
                      <table>
                        <thead><tr><th>Date</th><th>Qty</th><th>Price/kg</th><th>Total</th><th>Supplier</th><th>Notes</th><th></th></tr></thead>
                        <tbody>
                          {purchases.map(p=>(
                            deleting?.id === p.id
                              ? (
                                <tr key={p.id} style={{background:'rgba(139,58,42,.15)'}}>
                                  <td colSpan="5" style={{color:'var(--red2)',fontSize:12}}>Remove {Number(p.purchased_kg).toFixed(1)} kg on {fmtDate(p.purchase_date)}? This reverses the stock.</td>
                                  <td colSpan="2">
                                    <div style={{display:'flex',gap:6}}>
                                      <button className="btn btn-danger btn-xs" onClick={()=>handleDelete(p)}>Confirm</button>
                                      <button className="btn btn-outline btn-xs" onClick={()=>setDeleting(null)}>Cancel</button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr key={p.id}>
                                  <td>{fmtDate(p.purchase_date)}</td>
                                  <td>{Number(p.purchased_kg).toFixed(1)} kg</td>
                                  <td>R{Number(p.cost_per_kg).toFixed(2)}</td>
                                  <td style={{fontFamily:'var(--font-mono)'}}>R{(Number(p.purchased_kg)*Number(p.cost_per_kg)).toFixed(0)}</td>
                                  <td className="td-muted">{p.supplier||'—'}</td>
                                  <td className="td-muted">{p.notes||'—'}</td>
                                  <td>
                                    <div style={{display:'flex',gap:4}}>
                                      <button className="btn btn-outline btn-xs" onClick={()=>startEdit(p)}>Edit</button>
                                      <button className="btn btn-danger btn-xs" onClick={()=>setDeleting(p)}>Del</button>
                                    </div>
                                  </td>
                                </tr>
                              )
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </>
            )
          )}
        </div>
        {!editing && (
          <div className="form-actions">
            <button className="btn btn-gold" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN GREENS PAGE ─────────────────────────────────────────────
export default function Greens() {
  const [coffees, setCoffees] = useState([])
  const [loading, setLoading] = useState(true)
  const [coffeeForm, setCoffeeForm] = useState({ open:false, coffee:null })
  const [purchaseForm, setPurchaseForm] = useState({ open:false, coffee:null })
  const [historyModal, setHistoryModal] = useState({ open:false, coffee:null })
  const [deleting, setDeleting] = useState(null)
  const toast = useToast()

  const load = async () => {
    // Use the green_stock view which computes stock from purchases - roast usage
    const { data, error } = await supabase.from('green_stock').select('*').order('created_at', { ascending: false })
    if (error) {
      // Fallback to green_coffees if view doesn't exist yet
      const { data: d2 } = await supabase.from('green_coffees').select('*').order('created_at', { ascending: false })
      setCoffees((d2||[]).map(c=>({...c, stock_kg:0, current_price_per_kg:c.default_price_per_kg||0})))
    } else {
      setCoffees(data||[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    const { error } = await supabase.from('green_coffees').delete().eq('coffee_id', id)
    if (error) { toast('Error: '+error.message, true); return }
    toast('Coffee deleted'); setDeleting(null); load()
  }

  const totalStock = coffees.reduce((s,c)=>s+Number(c.stock_kg||0),0)
  const lowStock   = coffees.filter(c=>Number(c.stock_kg||0)<Number(c.threshold||5)).length
  const totalValue = coffees.reduce((s,c)=>s+Number(c.stock_kg||0)*Number(c.current_price_per_kg||0),0)
  const avgCupping = coffees.filter(c=>c.cupping_score>0)
  const avgC = avgCupping.length ? avgCupping.reduce((s,c)=>s+Number(c.cupping_score),0)/avgCupping.length : 0

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Green Inventory</div><div className="page-sub">Coffee Profiles & Purchases</div></div>
        <button className="btn btn-gold" onClick={()=>setCoffeeForm({open:true,coffee:null})}>+ New Coffee</button>
      </div>

      <div className="stats-grid">
        {[
          ['Coffee Profiles', coffees.length, ''],
          ['Total Stock', totalStock.toFixed(1)+' kg', ''],
          ['Low Stock Alerts', lowStock, ''],
          ['Stock Value', 'R '+totalValue.toFixed(0), ''],
          ...(avgC?[['Avg Cupping', avgC.toFixed(1)+' pts', '']]:[] ),
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
            <th>Coffee ID</th><th>Origin</th><th>Supplier</th><th>Process</th>
            <th>Variety</th><th>Current Price</th><th>Stock</th><th>Cupping</th><th></th>
          </tr></thead>
          <tbody>
            {loading&&<tr><td colSpan="9"><div className="loading">Loading…</div></td></tr>}
            {!loading&&!coffees.length&&(
              <tr><td colSpan="9"><div className="empty"><div className="empty-icon">◈</div>No coffees yet — add your first green coffee profile</div></td></tr>
            )}
            {coffees.map(c=>{
              const stock = Number(c.stock_kg||0)
              const isEmpty = stock<=0
              const isLow = stock<Number(c.threshold||5)
              const badgeCls = isEmpty?'badge-empty':isLow?'badge-low':'badge-ok'
              const badgeTxt = isEmpty?'Empty':isLow?'Low':'In Stock'
              return (
                <tr key={c.coffee_id}>
                  <td className="td-id">{c.coffee_id}</td>
                  <td>{c.origin||'—'}{c.farm&&<><br/><span className="td-muted">{c.farm}</span></>}</td>
                  <td className="td-muted">{c.supplier||'—'}</td>
                  <td>{c.process||'—'}</td>
                  <td className="td-muted">{c.variety||'—'}</td>
                  <td>R {Number(c.current_price_per_kg||0).toFixed(2)}</td>
                  <td>
                    {stock.toFixed(1)} kg
                    <br/><span className={`badge ${badgeCls}`}>{badgeTxt}</span>
                    {c.purchase_count>0&&<span className="td-muted" style={{marginLeft:6}}>{c.purchase_count} purchase{c.purchase_count>1?'s':''}</span>}
                  </td>
                  <td>{c.cupping_score?c.cupping_score+' pts':'—'}</td>
                  <td>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      <button className="btn btn-gold btn-xs" onClick={()=>setPurchaseForm({open:true,coffee:c})}>+ Buy</button>
                      <button className="btn btn-outline btn-xs" onClick={()=>setHistoryModal({open:true,coffee:c})}>History</button>
                      <button className="btn btn-outline btn-xs" onClick={()=>setCoffeeForm({open:true,coffee:c})}>Edit</button>
                      <button className="btn btn-danger btn-xs" onClick={()=>setDeleting(c)}>Del</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <CoffeeForm
        open={coffeeForm.open} coffee={coffeeForm.coffee}
        onClose={()=>setCoffeeForm({open:false,coffee:null})} onSaved={load}
      />
      <PurchaseForm
        open={purchaseForm.open} coffee={purchaseForm.coffee}
        onClose={()=>setPurchaseForm({open:false,coffee:null})} onSaved={load}
      />
      <PurchaseHistory
        open={historyModal.open} coffee={historyModal.coffee}
        onClose={()=>setHistoryModal({open:false,coffee:null})}
        onSaved={load}
      />

      {deleting&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setDeleting(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-hd"><div className="modal-title">Confirm Delete</div></div>
            <div className="modal-body" style={{textAlign:'center',padding:28}}>
              <p style={{color:'var(--text2)',marginBottom:8,lineHeight:1.7}}>
                Delete <strong style={{color:'var(--text)'}}>{deleting.coffee_id}</strong>?
              </p>
              <p style={{color:'var(--text3)',fontSize:11,marginBottom:20}}>
                This will also delete all purchase history for this coffee.
              </p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button className="btn btn-outline" onClick={()=>setDeleting(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={()=>handleDelete(deleting.coffee_id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
