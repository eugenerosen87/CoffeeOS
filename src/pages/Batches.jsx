import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate, daysAgo, ROAST_NAMES } from '../lib/coffee'
import { useToast } from '../lib/toast'
import BatchForm from '../components/BatchForm'

const STATUSES = [
  { key:'planned',   label:'Planned',   cls:'badge-rest',  color:'var(--text3)' },
  { key:'scheduled', label:'Scheduled', cls:'badge-rest',  color:'var(--text3)' },
  { key:'roasting',  label:'Roasting',  cls:'badge-low',   color:'#c9a84c' },
  { key:'resting',   label:'Resting',   cls:'badge-rest',  color:'var(--text3)' },
  { key:'approved',  label:'Approved',  cls:'badge-peak',  color:'var(--green2)' },
  { key:'archived',  label:'Archived',  cls:'badge-done',  color:'var(--text3)' },
]

const REST_DAYS_MIN = 5   // batch is ready to approve after this many days
const REST_DAYS_PEAK = 14 // batch is past peak after this many days

const STATUS_FLOW = {
  planned:   ['scheduled','roasting'],
  scheduled: ['roasting'],
  roasting:  ['resting'],
  resting:   ['approved'],
  approved:  ['archived'],
  archived:  ['approved'],
}

function StatusBadge({ status }) {
  const s = STATUSES.find(x=>x.key===status) || STATUSES[3]
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function ArchiveModal({ batch, onConfirm, onClose }) {
  const [note, setNote] = useState('')
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:420}}>
        <div className="modal-hd"><div className="modal-title">Archive — {batch.id}</div><button className="btn btn-ghost" onClick={onClose}>✕</button></div>
        <div className="modal-body" style={{padding:26}}>
          <p style={{color:'var(--text2)',fontSize:13,marginBottom:16,lineHeight:1.7}}>
            Archiving hides this batch from the active list. You can restore it at any time.
          </p>
          <div className="form-group">
            <label>Reason / Note (optional)</label>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Sold out, used in blend…"/>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={()=>onConfirm(note)}>Archive Batch</button>
        </div>
      </div>
    </div>
  )
}

export default function Batches() {
  const [batches, setBatches]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [originFilter, setOriginFilter] = useState('')
  const [roastFilter,  setRoastFilter]  = useState('')
  const [roasterFilter, setRoasterFilter] = useState('')
  const [formOpen, setFormOpen]         = useState(false)
  const [editing, setEditing]           = useState(null)
  const [deleting, setDeleting]         = useState(null)
  const [archiving, setArchiving]       = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

  const load = async () => {
    const { data } = await supabase.from('roasts').select('*').order('date',{ascending:false})
    const rows = data || []
    setBatches(rows); setLoading(false)
    // Auto-advance resting batches that have completed their rest period
    autoAdvanceResting(rows)
  }
  useEffect(()=>{ load() },[])

  const autoAdvanceResting = async (rows) => {
    const now = new Date()
    const ready = rows.filter(b => {
      if (b.status !== 'resting') return false
      const days = Math.floor((now - new Date(b.date)) / 86400000)
      return days >= REST_DAYS_MIN
    })
    if (!ready.length) return
    const ids = ready.map(b => b.id)
    const { error } = await supabase.from('roasts')
      .update({ status: 'approved' })
      .in('id', ids)
    if (!error) {
      toast(`${ready.length} batch${ready.length > 1 ? 'es' : ''} auto-approved — rest period complete`)
      // Update local state immediately without a full reload
      setBatches(prev => prev.map(b => ids.includes(b.id) ? { ...b, status: 'approved' } : b))
    }
  }

  const handleStatusChange = async (batch, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'archived') {
      updates.archived = true
      updates.archived_at = new Date().toISOString()
    } else if (batch.status === 'archived') {
      updates.archived = false
      updates.archived_at = null
    }
    const { error } = await supabase.from('roasts').update(updates).eq('id', batch.id)
    if (error) { toast('Error: '+error.message, true); return }

    // Write ledger when transitioning FROM planned/scheduled INTO roasting
    // This is the moment green stock is actually consumed
    const wasInformational = ['planned','scheduled'].includes(batch.status)
    const nowActive = ['roasting','resting','approved'].includes(newStatus)
    if (wasInformational && nowActive && !batch.ledger_written && batch.coffee_id && batch.input_kg > 0) {
      const movements = [{
        coffee_id: batch.coffee_id,
        movement_type: 'roast_out',
        quantity_kg: Number(batch.input_kg),
        reference_id: batch.id,
        reference_type: 'roast',
        note: `Batch ${batch.id} — ledger written on transition to ${newStatus}`
      }]
      if (batch.waste_kg > 0) {
        movements.push({
          coffee_id: batch.coffee_id,
          movement_type: 'waste_out',
          quantity_kg: Number(batch.waste_kg),
          reference_id: batch.id,
          reference_type: 'roast',
          note: `Waste from batch ${batch.id}`
        })
      }
      await supabase.from('inventory_movements').insert(movements)
      await supabase.from('roasts').update({ ledger_written: true }).eq('id', batch.id)
      toast(`Batch moved to ${newStatus} — green stock deducted`)
    } else {
      toast(`Batch moved to ${newStatus}`)
    }

    setUpdatingStatus(null)
    load()
  }

  const handleDelete = async (id) => {
    await supabase.from('roasts').delete().eq('id', id)
    toast('Batch deleted'); setDeleting(null); load()
  }

  const handleArchive = async (batch, note) => {
    await supabase.from('roasts').update({
      status:'archived', archived:true,
      archived_at:new Date().toISOString(), archived_note:note||null
    }).eq('id', batch.id)
    toast('Batch archived'); setArchiving(null); load()
  }

  const now = new Date()
  const active   = batches.filter(b=>b.status!=='archived')
  const archived = batches.filter(b=>b.status==='archived')

  const filtered = batches.filter(b => {
    if (!showArchived && b.status === 'archived') return false
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (originFilter  && b.coffee_id !== originFilter) return false
    if (roastFilter   && b.roast_level !== roastFilter) return false
    if (roasterFilter && (b.roaster_name||'') !== roasterFilter) return false
    return true
  })

  // Unique values for filter dropdowns (from non-archived batches unless showing archived)
  const filterBase = showArchived ? batches : active
  const origins  = [...new Set(filterBase.map(b=>b.coffee_id).filter(Boolean))].sort()
  const roastLevels = [...new Set(filterBase.map(b=>b.roast_level).filter(Boolean))]
  const roasters = [...new Set(filterBase.map(b=>b.roaster_name).filter(Boolean))].sort()
  const hasFilters = originFilter || roastFilter || roasterFilter

  // Stats
  const inPeak    = active.filter(b=>{ const d=Math.floor((now-new Date(b.date))/86400000); return d>=5&&d<=14 }).length
  const thisMonth = active.filter(b=>{ const r=new Date(b.date); return r.getMonth()===now.getMonth()&&r.getFullYear()===now.getFullYear() }).length
  const totalKg   = active.reduce((s,b)=>s+(Number(b.output_kg)||0),0)
  const planned   = batches.filter(b=>['planned','scheduled'].includes(b.status)).length

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <div className="page-title">Roast Batches</div>
          <div className="page-sub">One bean · One roast</div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {archived.length>0&&(
            <button className={`btn btn-sm ${showArchived?'btn-outline':'btn-ghost'}`} onClick={()=>setShowArchived(s=>!s)}>
              {showArchived?'← Active Only':`Archived (${archived.length})`}
            </button>
          )}
          <button className="btn btn-gold" onClick={()=>{setEditing(null);setFormOpen(true)}}>+ New Batch</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          ['Active Batches', active.length, ''],
          ['In Peak Window', inPeak, ''],
          ['Planned / Scheduled', planned, 'upcoming'],
          ['This Month', thisMonth, ''],
          ['Total Output', totalKg.toFixed(1)+' kg', ''],
        ].map(([l,v,s])=>(
          <div className="stat-card" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-val">{v}</div>
            {s&&<div className="stat-sub">{s}</div>}
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        {[['all','All'],['planned','Planned'],['scheduled','Scheduled'],['roasting','Roasting'],['resting','Resting'],['approved','Approved']].map(([k,l])=>(
          <button
            key={k}
            onClick={()=>setStatusFilter(k)}
            style={{
              padding:'5px 14px',border:'none',borderRadius:4,fontSize:11,fontWeight:600,
              letterSpacing:'.5px',cursor:'pointer',fontFamily:'var(--font-body)',
              background:statusFilter===k?'var(--gold)':'var(--bg3)',
              color:statusFilter===k?'#0e0b08':'var(--text2)',
              transition:'all .15s'
            }}
          >{l}</button>
        ))}
      </div>

      {/* Additional filters */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        {origins.length > 1 && (
          <select value={originFilter} onChange={e=>setOriginFilter(e.target.value)} style={{fontSize:12,padding:'4px 8px',minWidth:140}}>
            <option value="">All origins</option>
            {origins.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {roastLevels.length > 1 && (
          <select value={roastFilter} onChange={e=>setRoastFilter(e.target.value)} style={{fontSize:12,padding:'4px 8px',minWidth:140}}>
            <option value="">All roast levels</option>
            {roastLevels.map(r=><option key={r} value={r}>{ROAST_NAMES[r]||r}</option>)}
          </select>
        )}
        {roasters.length > 1 && (
          <select value={roasterFilter} onChange={e=>setRoasterFilter(e.target.value)} style={{fontSize:12,padding:'4px 8px',minWidth:130}}>
            <option value="">All roasters</option>
            {roasters.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={()=>{setOriginFilter('');setRoastFilter('');setRoasterFilter('')}}>
            Clear filters
          </button>
        )}
        {(hasFilters || statusFilter !== 'all') && (
          <span style={{fontSize:11,color:'var(--text3)',marginLeft:4}}>{filtered.length} batch{filtered.length!==1?'es':''}</span>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Batch ID</th><th>Date</th><th>Green Coffee</th><th>Roast Level</th>
            <th>Input</th><th>Est. Output</th><th>Output</th><th>Waste</th><th>Available</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {loading&&<tr><td colSpan="9"><div className="loading">Loading…</div></td></tr>}
            {!loading&&!filtered.length&&(
              <tr><td colSpan="9">
                <div className="empty"><div className="empty-icon">◎</div>
                  {statusFilter!=='all'?`No ${statusFilter} batches`:'No batches yet'}
                </div>
              </td></tr>
            )}
            {filtered.map(b=>{
              const loss = b.input_kg&&b.output_kg ? ((1-b.output_kg/b.input_kg)*100).toFixed(1)+'%' : '—'
              const nextStatuses = STATUS_FLOW[b.status] || []

              // Estimated output — use historical avg loss for same coffee + roast level
              const historicalBatches = batches.filter(x =>
                x.coffee_id === b.coffee_id &&
                x.roast_level === b.roast_level &&
                x.input_kg > 0 && x.output_kg > 0 &&
                x.id !== b.id
              )
              const avgLossPct = historicalBatches.length > 0
                ? historicalBatches.reduce((s,x) => s + (1 - x.output_kg/x.input_kg), 0) / historicalBatches.length
                : 0.145 // fallback 14.5% default loss
              const estOutput = b.input_kg > 0
                ? Number(b.input_kg) * (1 - avgLossPct)
                : null
              const days = Math.floor((now - new Date(b.date)) / 86400000)
              const restPct = b.status === 'resting' ? Math.min(100, Math.round((days / REST_DAYS_MIN) * 100)) : null
              const pastPeak = b.status === 'approved' && days > REST_DAYS_PEAK
              return (
                <tr key={b.id} style={b.status==='archived'?{opacity:.55}:{}}>
                  <td className="td-id">{b.id}</td>
                  <td>{fmtDate(b.date)}<br/><span className="td-muted">{daysAgo(b.date)}</span></td>
                  <td>
                    <span style={{fontWeight:500}}>{b.coffee_id||'—'}</span>
                    {b.roaster_name&&<><br/><span className="td-muted">{b.roaster_name}</span></>}
                  </td>
                  <td>{ROAST_NAMES[b.roast_level]||b.roast_level||'—'}</td>
                  <td className="td-muted">{b.input_kg||'—'} kg</td>
                  <td className="td-muted" style={{color:'var(--text3)'}}>
                    {estOutput != null
                      ? <span title={`Based on ${historicalBatches.length > 0 ? `avg of ${historicalBatches.length} batch${historicalBatches.length>1?'es':''}` : 'default 14.5% loss'}`}>
                          ~{estOutput.toFixed(1)} kg
                          <br/>
                          <span style={{fontSize:10,color:'var(--text3)'}}>{(avgLossPct*100).toFixed(1)}% loss</span>
                        </span>
                      : '—'
                    }
                  </td>
                  <td>{b.output_kg ? b.output_kg+' kg' : '—'}</td>
                  <td className="td-muted" style={{color: b.waste_kg > 0 ? 'var(--red2)' : undefined}}>
                    {b.waste_kg > 0 ? b.waste_kg+' kg' : '—'}
                  </td>
                  <td style={{color:'var(--green2)',fontWeight:500}}>
                    {b.available_kg != null ? Number(b.available_kg).toFixed(1)+' kg' : b.output_kg ? Number(b.output_kg).toFixed(1)+' kg' : '—'}
                  </td>
                  <td>
                    {updatingStatus===b.id
                      ? <select
                          autoFocus
                          value={b.status}
                          onChange={e=>handleStatusChange(b,e.target.value)}
                          onBlur={()=>setUpdatingStatus(null)}
                          style={{fontSize:11,padding:'3px 6px'}}
                        >
                          {[b.status,...nextStatuses].map(s=>(
                            <option key={s} value={s}>{STATUSES.find(x=>x.key===s)?.label||s}</option>
                          ))}
                        </select>
                      : <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          <span style={{cursor:'pointer'}} onClick={()=>setUpdatingStatus(b.id)} title="Click to change status">
                            <StatusBadge status={b.status}/>
                          </span>
                          {restPct !== null && (
                            <div title={`Resting: ${days}/${REST_DAYS_MIN} days`} style={{display:'flex',flexDirection:'column',gap:2}}>
                              <div style={{height:4,borderRadius:2,background:'var(--bg3)',width:72,overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${restPct}%`,background:restPct>=100?'var(--green2)':'var(--gold)',borderRadius:2,transition:'width .3s'}}/>
                              </div>
                              <span style={{fontSize:10,color:restPct>=100?'var(--green2)':'var(--text3)'}}>
                                {restPct>=100?`Ready (${days}d)`:`${days}/${REST_DAYS_MIN}d`}
                              </span>
                            </div>
                          )}
                          {pastPeak && (
                            <span style={{fontSize:10,color:'#c9a84c',fontWeight:600}} title={`${days} days since roast — past optimal window`}>
                              ⚠ {days}d past peak
                            </span>
                          )}
                        </div>
                    }
                  </td>
                  <td>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {b.status!=='archived'&&<>
                        <button className="btn btn-gold btn-xs" onClick={()=>navigate(`/cert/${b.id}`)}>Cert</button>
                        <button className="btn btn-outline btn-xs" onClick={()=>navigate(`/costing?batch=${b.id}`)}>Cost</button>
                        <button className="btn btn-outline btn-xs" onClick={()=>{setEditing(b);setFormOpen(true)}}>Edit</button>
                        {b.status!=='archived'&&<button className="btn btn-outline btn-xs" style={{color:'var(--text3)'}} onClick={()=>setArchiving(b)}>Archive</button>}
                      </>}
                      {b.status==='archived'&&<button className="btn btn-outline btn-xs" onClick={()=>handleStatusChange(b,'approved')}>Restore</button>}
                      <button className="btn btn-danger btn-xs" onClick={()=>setDeleting(b)}>Del</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BatchForm open={formOpen} batch={editing} onClose={()=>setFormOpen(false)} onSaved={load}/>
      {archiving&&<ArchiveModal batch={archiving} onConfirm={(note)=>handleArchive(archiving,note)} onClose={()=>setArchiving(null)}/>}

      {deleting&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setDeleting(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-hd"><div className="modal-title">Confirm Delete</div></div>
            <div className="modal-body" style={{textAlign:'center',padding:28}}>
              <p style={{color:'var(--text2)',marginBottom:20,lineHeight:1.7}}>Permanently delete <strong style={{color:'var(--text)'}}>{deleting.id}</strong>?</p>
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
