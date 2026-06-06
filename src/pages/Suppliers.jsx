import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

const EMPTY = {
  name:'', contact_name:'', email:'', phone:'',
  country:'', lead_time_days:'14', notes:''
}

function SupplierForm({ open, supplier, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const isEditing = !!supplier

  useEffect(() => {
    if (!open) return
    setForm(supplier ? {...EMPTY,...supplier,lead_time_days:String(supplier.lead_time_days||14)} : EMPTY)
  }, [open, supplier])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Supplier name required', true); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone,
      country: form.country,
      lead_time_days: parseInt(form.lead_time_days)||14,
      notes: form.notes,
    }
    const { error } = isEditing
      ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      : await supabase.from('suppliers').insert(payload)
    if (error) { toast('Error: '+error.message, true); setSaving(false); return }
    toast(isEditing ? 'Supplier updated' : 'Supplier added')
    setSaving(false); onSaved(); onClose()
  }

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-hd">
          <div className="modal-title">{isEditing?`Edit — ${supplier.name}`:'New Supplier'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fsec">Supplier Details</div>
            <div className="form-group full"><label>Company Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Falcon Coffees"/></div>
            <div className="form-group"><label>Contact Name</label><input value={form.contact_name} onChange={e=>set('contact_name',e.target.value)}/></div>
            <div className="form-group"><label>Country</label><input value={form.country} onChange={e=>set('country',e.target.value)} placeholder="e.g. Ethiopia"/></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)}/></div>
            <div className="form-group"><label>Lead Time (days)</label><input type="number" step="1" value={form.lead_time_days} onChange={e=>set('lead_time_days',e.target.value)}/></div>
            <div className="form-group full"><label>Notes</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Payment terms, shipping details, etc."/></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Supplier'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [greens, setGreens]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [formState, setFormState] = useState({open:false,supplier:null})
  const [deleting, setDeleting]   = useState(null)
  const toast = useToast()

  const load = async () => {
    const [{ data:s },{ data:g }] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('green_coffees').select('coffee_id,supplier,origin'),
    ])
    setSuppliers(s||[]); setGreens(g||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  const handleDelete = async (id) => {
    await supabase.from('suppliers').delete().eq('id', id)
    toast('Supplier deleted'); setDeleting(null); load()
  }

  const toggleActive = async (s) => {
    await supabase.from('suppliers').update({active:!s.active}).eq('id',s.id)
    load()
  }

  // Link coffees to suppliers by name match
  const getCoffees = (supplierName) =>
    greens.filter(g => g.supplier && g.supplier.toLowerCase() === supplierName.toLowerCase())

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Suppliers</div><div className="page-sub">Green Coffee Suppliers</div></div>
        <button className="btn btn-gold" onClick={()=>setFormState({open:true,supplier:null})}>+ Add Supplier</button>
      </div>

      <div className="stats-grid">
        {[
          ['Total Suppliers', suppliers.length, ''],
          ['Active', suppliers.filter(s=>s.active).length, ''],
          ['Avg Lead Time', suppliers.length ? Math.round(suppliers.reduce((s,x)=>s+(x.lead_time_days||14),0)/suppliers.length)+'d' : '—', ''],
        ].map(([l,v])=>(
          <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-val">{v}</div></div>
        ))}
      </div>

      {loading && <div className="loading">Loading…</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
        {suppliers.map(s => {
          const coffees = getCoffees(s.name)
          return (
            <div key={s.id} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',opacity:s.active?1:.6}}>
              {/* Header */}
              <div style={{background:'var(--bg3)',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-head)',fontSize:16,color:'var(--text)'}}>{s.name}</div>
                    {s.country&&<div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{s.country}</div>}
                  </div>
                  <span className={`badge ${s.active?'badge-ok':'badge-rest'}`}>{s.active?'Active':'Inactive'}</span>
                </div>
              </div>

              {/* Details */}
              <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
                {s.contact_name&&(
                  <div style={{display:'flex',gap:8,marginBottom:6,fontSize:12}}>
                    <span style={{color:'var(--text3)',minWidth:70,fontSize:11}}>Contact</span>
                    <span style={{color:'var(--text)'}}>{s.contact_name}</span>
                  </div>
                )}
                {s.email&&(
                  <div style={{display:'flex',gap:8,marginBottom:6,fontSize:12}}>
                    <span style={{color:'var(--text3)',minWidth:70,fontSize:11}}>Email</span>
                    <a href={`mailto:${s.email}`} style={{color:'var(--gold)',textDecoration:'none'}}>{s.email}</a>
                  </div>
                )}
                {s.phone&&(
                  <div style={{display:'flex',gap:8,marginBottom:6,fontSize:12}}>
                    <span style={{color:'var(--text3)',minWidth:70,fontSize:11}}>Phone</span>
                    <span style={{color:'var(--text)'}}>{s.phone}</span>
                  </div>
                )}
                <div style={{display:'flex',gap:8,fontSize:12}}>
                  <span style={{color:'var(--text3)',minWidth:70,fontSize:11}}>Lead time</span>
                  <span style={{color:'var(--text)'}}>{s.lead_time_days||14} days</span>
                </div>
              </div>

              {/* Linked coffees */}
              <div style={{padding:'10px 18px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>Coffees Supplied</div>
                {coffees.length > 0
                  ? <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {coffees.map(c=>(
                        <span key={c.coffee_id} style={{background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:4,padding:'2px 8px',fontSize:10,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>
                          {c.coffee_id}
                        </span>
                      ))}
                    </div>
                  : <div style={{fontSize:11,color:'var(--text3)'}}>No coffees linked — set supplier name in Green Inventory to match</div>
                }
              </div>

              {s.notes&&(
                <div style={{padding:'10px 18px',borderBottom:'1px solid var(--border)',fontSize:11,color:'var(--text3)',fontStyle:'italic'}}>
                  {s.notes}
                </div>
              )}

              {/* Actions */}
              <div style={{padding:'12px 18px',display:'flex',gap:8}}>
                <button className="btn btn-gold btn-sm" style={{flex:1}} onClick={()=>setFormState({open:true,supplier:s})}>Edit</button>
                <button className="btn btn-outline btn-sm" onClick={()=>toggleActive(s)}>{s.active?'Deactivate':'Activate'}</button>
                <button className="btn btn-danger btn-sm" onClick={()=>setDeleting(s)}>Del</button>
              </div>
            </div>
          )
        })}
        {!loading&&!suppliers.length&&(
          <div style={{gridColumn:'1/-1'}}><div className="empty"><div className="empty-icon">◈</div>No suppliers yet — add your first</div></div>
        )}
      </div>

      <SupplierForm open={formState.open} supplier={formState.supplier} onClose={()=>setFormState({open:false,supplier:null})} onSaved={load}/>

      {deleting&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setDeleting(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-hd"><div className="modal-title">Delete Supplier</div></div>
            <div className="modal-body" style={{textAlign:'center',padding:28}}>
              <p style={{color:'var(--text2)',marginBottom:20,lineHeight:1.7}}>Delete <strong style={{color:'var(--text)'}}>{deleting.name}</strong>?</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button className="btn btn-outline" onClick={()=>setDeleting(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={()=>handleDelete(deleting.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
