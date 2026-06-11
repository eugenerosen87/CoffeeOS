import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { fmtDate } from '../lib/coffee'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CHANNELS = ['direct','wholesale','market','online','cafe','gift','other']

function SaleForm({ open, sale, products, formats, onClose, onSaved }) {
  const toast   = useToast()
  const isEditing = !!sale
  const EMPTY_LINE = () => ({ _k: Math.random(), run_id:'', product_id:'', format_id:'', units_sold:'', price_per_unit:'' })

  const [header, setHeader] = useState({ sale_date: new Date().toISOString().split('T')[0], channel:'direct', customer_id:'', customer:'', note:'' })
  const [lines,  setLines]  = useState([EMPTY_LINE()])
  const [allRuns, setAllRuns] = useState([])
  const [customers, setCustomers] = useState([])
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { if (!open) return; loadAll(isEditing ? sale : null) }, [open, sale])

  const loadAll = async (existingSale) => {
    const [{ data: rawRuns }, { data: runSales }, { data: custs }] = await Promise.all([
      supabase.from('product_runs').select('id, product_id, run_date, units_packed, products(name)').order('run_date',{ascending:false}),
      supabase.from('sales').select('product_run_id, format_id, units_sold').not('product_run_id','is',null),
      supabase.from('customers').select('id, name, type').order('name'),
    ])
    setCustomers(custs||[])
    const soldMap = {}
    runSales?.forEach(s => {
      if (!soldMap[s.product_run_id]) soldMap[s.product_run_id] = {}
      soldMap[s.product_run_id][s.format_id] = (soldMap[s.product_run_id][s.format_id]||0) + (s.units_sold||0)
    })
    // When editing: remove this order's own contribution so remaining is correct
    if (existingSale?.order_id) {
      const { data: orderLines } = await supabase.from('sales').select('product_run_id, format_id, units_sold').eq('order_id', existingSale.order_id)
      orderLines?.forEach(l => { if (soldMap[l.product_run_id]?.[l.format_id]) soldMap[l.product_run_id][l.format_id] -= (l.units_sold||0) })
    } else if (existingSale?.product_run_id && existingSale?.format_id) {
      if (soldMap[existingSale.product_run_id]?.[existingSale.format_id]) soldMap[existingSale.product_run_id][existingSale.format_id] -= (existingSale.units_sold||0)
    }
    const enriched = (rawRuns||[]).map(r => {
      const packed = r.units_packed||{}; const sold = soldMap[r.id]||{}; const remaining = {}
      Object.entries(packed).forEach(([fid,qty]) => { remaining[fid] = Math.max(0,(parseInt(qty)||0)-(sold[fid]||0)) })
      return { ...r, remaining, totalRemaining: Object.values(remaining).reduce((s,v)=>s+v,0) }
    })
    setAllRuns(enriched)

    if (existingSale) {
      setHeader({ sale_date: existingSale.sale_date, channel: existingSale.channel, customer_id: existingSale.customer_id||'', customer: existingSale.customer||'', note: existingSale.note||'' })
      if (existingSale.order_id) {
        const { data: ol } = await supabase.from('sales').select('*').eq('order_id', existingSale.order_id)
        setLines((ol||[]).map(l => ({ _k: l.id, _id: l.id, run_id: l.product_run_id||'', product_id: l.product_id, format_id: l.format_id, units_sold: String(l.units_sold), price_per_unit: String(l.price_per_unit) })))
      } else {
        setLines([{ _k: existingSale.id, _id: existingSale.id, run_id: existingSale.product_run_id||'', product_id: existingSale.product_id, format_id: existingSale.format_id, units_sold: String(existingSale.units_sold), price_per_unit: String(existingSale.price_per_unit) }])
      }
    } else {
      setHeader({ sale_date: new Date().toISOString().split('T')[0], channel:'direct', customer_id:'', customer:'', note:'' })
      setLines([EMPTY_LINE()])
    }
  }

  const setLine = (idx, upd) => setLines(ls => ls.map((l,i) => i===idx ? {...l,...upd} : l))

  const handleRunSelect = async (idx, runId) => {
    const r = allRuns.find(x => x.id === runId)
    const fmtIds = r ? Object.keys(r.units_packed||{}) : []
    const autoFmt = fmtIds.length === 1 ? fmtIds[0] : ''
    let price = ''
    if (r?.product_id && autoFmt) {
      if (header.channel === 'gift') { price = '0' } else {
        const { data } = await supabase.from('product_prices').select('price').eq('product_id',r.product_id).eq('format_id',autoFmt).single()
        if (data?.price) price = String(data.price)
      }
    }
    setLine(idx, { run_id: runId, product_id:'', format_id: autoFmt, price_per_unit: price })
  }

  const handleFormatSelect = async (idx, fmtId) => {
    const line = lines[idx]
    const run  = allRuns.find(r => r.id === line.run_id)
    const prodId = run ? run.product_id : line.product_id
    let price = ''
    if (prodId && fmtId) {
      if (header.channel === 'gift') { price = '0' } else {
        const { data } = await supabase.from('product_prices').select('price').eq('product_id',prodId).eq('format_id',fmtId).single()
        if (data?.price) price = String(data.price)
      }
    }
    setLine(idx, { format_id: fmtId, price_per_unit: price })
  }

  const handleSave = async () => {
    for (let i=0; i<lines.length; i++) {
      const l = lines[i]; const run = allRuns.find(r=>r.id===l.run_id)
      const prodId = run ? run.product_id : l.product_id
      if (!prodId)          { toast(`Item ${i+1}: select a product run or product`, true); return }
      if (!l.format_id)     { toast(`Item ${i+1}: select a format`, true); return }
      if (!l.units_sold)    { toast(`Item ${i+1}: enter units sold`, true); return }
      if (!l.price_per_unit && header.channel !== 'gift') { toast(`Item ${i+1}: enter price`, true); return }
    }
    setSaving(true)
    const orderId = lines.length > 1 ? (sale?.order_id || crypto.randomUUID()) : (sale?.order_id || null)

    if (isEditing) {
      // Delete all old lines (single or whole order), then re-insert
      if (sale.order_id) await supabase.from('sales').delete().eq('order_id', sale.order_id)
      else               await supabase.from('sales').delete().eq('id', sale.id)
    }

    const rows = lines.map(l => {
      const run = allRuns.find(r => r.id === l.run_id)
      return {
        product_id:     run ? run.product_id : l.product_id,
        format_id:      l.format_id,
        sale_date:      header.sale_date,
        units_sold:     parseInt(l.units_sold)||0,
        price_per_unit: parseFloat(l.price_per_unit)||0,
        channel:        header.channel,
        customer:       header.customer,
        customer_id:    header.customer_id || null,
        note:           header.note,
        product_run_id: l.run_id || null,
        order_id:       orderId,
      }
    })
    const { error } = await supabase.from('sales').insert(rows)
    if (error) { toast('Error: '+error.message, true); setSaving(false); return }
    setSaving(false)
    toast(isEditing ? 'Sale updated' : `${lines.length} item${lines.length>1?'s':''} recorded`)
    onSaved(); onClose()
  }

  const totalRevenue = lines.reduce((s,l)=>s+(parseInt(l.units_sold)||0)*(parseFloat(l.price_per_unit)||0),0)

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:600}}>
        <div className="modal-hd">
          <div className="modal-title">{isEditing?'Edit Sale':'Record Sale'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* ── Order header ── */}
          <div className="form-grid" style={{marginBottom:16}}>
            <div className="fsec">Order details</div>
            <div className="form-group"><label>Date</label><input type="date" value={header.sale_date} onChange={e=>setHeader(h=>({...h,sale_date:e.target.value}))}/></div>
            <div className="form-group">
              <label>Channel</label>
              <select value={header.channel} onChange={e=>{
                const ch = e.target.value
                setHeader(h=>({...h,channel:ch}))
                if (ch==='gift') setLines(ls=>ls.map(l=>({...l,price_per_unit:'0'})))
              }}>
                {CHANNELS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
              {header.channel==='gift'&&<div className="form-hint" style={{color:'var(--text3)'}}>Price set to R0 — stock deducted, no revenue recorded</div>}
            </div>
            <div className="form-group"><label>Customer (optional)</label>
              <select value={header.customer_id} onChange={e => {
                const cid = e.target.value
                const cust = customers.find(c => c.id === cid)
                setHeader(h => ({ ...h, customer_id: cid, customer: cust ? cust.name : '' }))
              }}>
                <option value="">— One-off / no account —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.type ? ` · ${c.type}` : ''}</option>
                ))}
              </select>
            </div>
            {!header.customer_id && (
              <div className="form-group"><label>Name (optional)</label>
                <input value={header.customer} onChange={e=>setHeader(h=>({...h,customer:e.target.value}))} placeholder="e.g. walk-in, market stall"/>
              </div>
            )}
            <div className="form-group"><label>Note (optional)</label><input value={header.note} onChange={e=>setHeader(h=>({...h,note:e.target.value}))}/></div>
          </div>

          {/* ── Line items ── */}
          <div className="fsec">Items</div>
          {lines.map((line, idx) => {
            const run          = allRuns.find(r=>r.id===line.run_id)
            const effectiveProd = run ? run.product_id : line.product_id
            const runFormats   = run ? formats.filter(f=>run.units_packed?.[f.id]!==undefined) : formats.filter(f=>f.active)
            const runRemaining = run ? (run.remaining[line.format_id]??null) : null
            const overselling  = runRemaining!==null && (parseInt(line.units_sold)||0) > runRemaining
            return (
              <div key={line._k} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'12px 14px',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <span style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'1px',fontWeight:600}}>Item {idx+1}</span>
                  {lines.length>1&&<button className="btn btn-ghost btn-xs" style={{color:'var(--red2)'}} onClick={()=>setLines(ls=>ls.filter((_,i)=>i!==idx))}>✕ Remove</button>}
                </div>
                <div className="form-grid" style={{gap:10}}>
                  <div className="form-group full">
                    <label>Product Run</label>
                    <select value={line.run_id} onChange={e=>handleRunSelect(idx,e.target.value)}>
                      <option value="">— No run / manual —</option>
                      {allRuns.filter(r=>r.totalRemaining>0||r.id===line.run_id).map(r=>(
                        <option key={r.id} value={r.id}>{r.products?.name||r.product_id} · {fmtDate(r.run_date)} · {r.totalRemaining} left</option>
                      ))}
                    </select>
                  </div>
                  {run ? (
                    <div className="form-group full">
                      <label>Product</label>
                      <div style={{padding:'7px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:4,fontSize:13}}>
                        {products.find(p=>p.id===run.product_id)?.name||run.products?.name||'—'}
                        <span style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>from run</span>
                      </div>
                    </div>
                  ) : (
                    <div className="form-group full">
                      <label>Product <span style={{color:'var(--text3)',fontWeight:400}}>(manual)</span></label>
                      <select value={line.product_id} onChange={e=>setLine(idx,{product_id:e.target.value,format_id:'',price_per_unit:''})}>
                        <option value="">— Select product —</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Format</label>
                    <select value={line.format_id} onChange={e=>handleFormatSelect(idx,e.target.value)}>
                      <option value="">— Select —</option>
                      {runFormats.map(f=>{
                        const rem = run?.remaining[f.id]
                        return <option key={f.id} value={f.id}>{f.name}{rem!==undefined?` (${rem} left)`:''}</option>
                      })}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Units</label>
                    <input type="number" step="1" value={line.units_sold} onChange={e=>setLine(idx,{units_sold:e.target.value})} style={overselling?{borderColor:'var(--gold)'}:{}}/>
                    {runRemaining!==null&&<div className="form-hint" style={{color:overselling?'var(--gold)':undefined}}>{runRemaining} left{overselling?' — ⚠ exceeds stock':''}</div>}
                  </div>
                  <div className="form-group">
                    <label>Price/unit (R)</label>
                    <input type="number" step="0.01" value={line.price_per_unit} onChange={e=>setLine(idx,{price_per_unit:e.target.value})}/>
                    {effectiveProd&&line.format_id&&<div className="form-hint">Auto-filled</div>}
                  </div>
                  {(parseInt(line.units_sold)||0)>0&&(parseFloat(line.price_per_unit)||0)>0&&(
                    <div style={{gridColumn:'1/-1',fontSize:12,color:'var(--text3)',textAlign:'right'}}>
                      Subtotal: <span style={{fontFamily:'var(--font-mono)',color:'var(--gold)'}}>R{((parseInt(line.units_sold)||0)*(parseFloat(line.price_per_unit)||0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <button className="btn btn-outline btn-sm" style={{marginBottom:16}} onClick={()=>setLines(ls=>[...ls,EMPTY_LINE()])}>+ Add item</button>

          {totalRevenue>0&&(
            <div style={{background:'var(--bg4)',borderRadius:6,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid var(--border2)'}}>
              <span style={{fontSize:12,color:'var(--text3)'}}>{lines.length} item{lines.length>1?'s':''} · {lines.reduce((s,l)=>s+(parseInt(l.units_sold)||0),0)} units total</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:18,color:'var(--gold)'}}>R{totalRevenue.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':isEditing?'Save Changes':'Record Sale'}</button>
        </div>
      </div>
    </div>
  )
}


export default function Sales() {
  const [sales, setSales]       = useState([])
  const [products, setProducts] = useState([])
  const [formats, setFormats]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expandedOrders, setExpandedOrders] = useState(new Set())
  const [filterProduct, setFilterProduct] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const toast = useToast()

  const load = async () => {
    const [{ data:s },{ data:p },{ data:f }] = await Promise.all([
      supabase.from('sales').select('*, products(name), formats(name)').order('sale_date',{ascending:false}),
      supabase.from('products').select('*').eq('archived',false).order('name'),
      supabase.from('formats').select('*').eq('active',true).order('sort_order'),
    ])
    setSales(s||[]); setProducts(p||[]); setFormats(f||[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const handleDelete = async (item) => {
    if (item.order_id) {
      await supabase.from('sales').delete().eq('order_id', item.order_id)
      toast('Order deleted')
    } else {
      await supabase.from('sales').delete().eq('id', item.id)
      toast('Sale deleted')
    }
    setDeleting(null); load()
  }

  const filtered = sales.filter(s => {
    if (filterProduct && s.product_id !== filterProduct) return false
    if (filterChannel && s.channel !== filterChannel) return false
    return true
  })

  // Group filtered sales by order_id for display
  const groupedDisplay = (() => {
    const groups = []; const seenOrders = new Set()
    filtered.forEach(s => {
      if (s.order_id) {
        if (!seenOrders.has(s.order_id)) {
          seenOrders.add(s.order_id)
          const orderLines = filtered.filter(x => x.order_id === s.order_id)
          groups.push({ type:'order', id:s.order_id, lines:orderLines, rep:s })
        }
      } else {
        groups.push({ type:'single', id:s.id, sale:s })
      }
    })
    return groups
  })()

  // Stats
  const totalRevenue = filtered.reduce((sum,s)=>sum+(s.units_sold*s.price_per_unit),0)
  const totalUnits   = filtered.reduce((sum,s)=>sum+s.units_sold,0)
  const thisMonth    = filtered.filter(s=>{ const d=new Date(s.sale_date); const n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear() })
  const monthRevenue = thisMonth.reduce((sum,s)=>sum+(s.units_sold*s.price_per_unit),0)

  // Best seller
  const byProduct = {}
  filtered.forEach(s => {
    const name = s.products?.name || s.product_id
    byProduct[name] = (byProduct[name]||0) + s.units_sold
  })
  const bestSeller = Object.entries(byProduct).sort((a,b)=>b[1]-a[1])[0]

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Sales</div><div className="page-sub">Revenue & demand tracking</div></div>
        <button className="btn btn-gold" onClick={()=>setEditing('new')}>+ Record Sale</button>
      </div>

      <div className="stats-grid">
        {[
          ['Total Revenue', 'R '+totalRevenue.toFixed(0), `${totalUnits} units`],
          ['This Month', 'R '+monthRevenue.toFixed(0), `${thisMonth.length} sales`],
          ['Sales Recorded', filtered.length, ''],
          ['Best Seller', bestSeller?bestSeller[0]:'—', bestSeller?bestSeller[1]+' units':''],
        ].map(([l,v,s])=>(
          <div className="stat-card" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-val" style={{fontSize:v.length>10?18:26}}>{v}</div>
            {s&&<div className="stat-sub">{s}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} style={{width:200}}>
          <option value="">All products</option>
          {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterChannel} onChange={e=>setFilterChannel(e.target.value)} style={{width:160}}>
          <option value="">All channels</option>
          {CHANNELS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
        </select>
        {(filterProduct||filterChannel)&&<button className="btn btn-ghost btn-sm" onClick={()=>{setFilterProduct('');setFilterChannel('')}}>Clear filters</button>}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Product(s)</th><th>Format</th><th>Channel</th>
            <th>Customer</th><th>Units</th><th>Revenue</th><th></th>
          </tr></thead>
          <tbody>
            {loading&&<tr><td colSpan="8"><div className="loading">Loading…</div></td></tr>}
            {!loading&&!groupedDisplay.length&&(
              <tr><td colSpan="8">
                <div className="empty"><div className="empty-icon">◇</div>
                  {sales.length?'No sales match your filters':'No sales recorded yet — click Record Sale to start'}
                </div>
              </td></tr>
            )}
            {groupedDisplay.map(g => {
              if (g.type === 'single') {
                const s = g.sale
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.sale_date)}</td>
                    <td style={{fontWeight:500}}>{s.products?.name||'—'}</td>
                    <td className="td-muted">{s.formats?.name||'—'}</td>
                    <td><span className="badge badge-rest" style={{textTransform:'capitalize'}}>{s.channel}</span></td>
                    <td className="td-muted">{s.customer||'—'}</td>
                    <td style={{fontFamily:'var(--font-mono)'}}>{s.units_sold}</td>
                    <td style={{fontFamily:'var(--font-mono)',color:'var(--gold)',fontWeight:600}}>R{(s.units_sold*s.price_per_unit).toFixed(2)}</td>
                    <td><div style={{display:'flex',gap:4}}>
                      <button className="btn btn-outline btn-xs" onClick={()=>setEditing(s)}>Edit</button>
                      <button className="btn btn-danger btn-xs" onClick={()=>setDeleting(s)}>Del</button>
                    </div></td>
                  </tr>
                )
              }
              // Multi-item order
              const {id:orderId, lines, rep} = g
              const isExpanded = expandedOrders.has(orderId)
              const orderTotal = lines.reduce((s,l)=>s+(l.units_sold*l.price_per_unit),0)
              const orderUnits = lines.reduce((s,l)=>s+l.units_sold,0)
              const productNames = [...new Set(lines.map(l=>l.products?.name||l.product_id))]
              const nameDisplay = productNames.length<=2 ? productNames.join(', ') : `${productNames[0]} +${productNames.length-1} more`
              return [
                <tr key={orderId} style={{cursor:'pointer'}} onClick={()=>setExpandedOrders(prev=>{ const n=new Set(prev); isExpanded?n.delete(orderId):n.add(orderId); return n })}>
                  <td>{fmtDate(rep.sale_date)}</td>
                  <td style={{fontWeight:500}}>{nameDisplay}<br/><span className="td-muted" style={{fontSize:10}}>{lines.length} items</span></td>
                  <td className="td-muted">—</td>
                  <td><span className="badge badge-rest" style={{textTransform:'capitalize'}}>{rep.channel}</span></td>
                  <td className="td-muted">{rep.customer||'—'}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{orderUnits}</td>
                  <td style={{fontFamily:'var(--font-mono)',color:'var(--gold)',fontWeight:600}}>R{orderTotal.toFixed(2)}</td>
                  <td onClick={e=>e.stopPropagation()}><div style={{display:'flex',gap:4}}>
                    <button className="btn btn-outline btn-xs" onClick={()=>setEditing(rep)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={()=>setDeleting(rep)}>Del</button>
                    <span style={{fontSize:11,color:'var(--text3)',alignSelf:'center',userSelect:'none'}}>{isExpanded?'▲':'▼'}</span>
                  </div></td>
                </tr>,
                isExpanded && (
                  <tr key={orderId+'-exp'}>
                    <td colSpan="8" style={{background:'var(--bg3)',padding:'10px 20px',borderTop:'none'}}>
                      {lines.map(l=>(
                        <div key={l.id} style={{display:'flex',gap:14,fontSize:12,marginBottom:5,alignItems:'center'}}>
                          <span style={{color:'var(--text2)',minWidth:160,fontWeight:500}}>{l.products?.name||'—'}</span>
                          <span style={{color:'var(--text3)',minWidth:100}}>{l.formats?.name||'—'}</span>
                          <span style={{fontFamily:'var(--font-mono)',minWidth:50}}>{l.units_sold}×</span>
                          <span style={{fontFamily:'var(--font-mono)',color:'var(--text2)'}}>R{Number(l.price_per_unit).toFixed(2)}</span>
                          <span style={{fontFamily:'var(--font-mono)',color:'var(--gold)',marginLeft:'auto'}}>R{(l.units_sold*l.price_per_unit).toFixed(2)}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                )
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Revenue charts */}
      {filtered.length > 0 && (() => {
        const CHANNEL_COLORS = {
          direct:'#c9a84c', wholesale:'#5a9e56', market:'#4a8fbf',
          online:'#9b6bbf', cafe:'#c4543c', other:'#6b5840'
        }
        const channelData = Object.entries(
          filtered.reduce((acc,s)=>{ acc[s.channel]=(acc[s.channel]||0)+(s.units_sold*s.price_per_unit); return acc },{})
        ).sort((a,b)=>b[1]-a[1]).map(([channel,revenue])=>({channel,revenue}))

        const productData = Object.entries(
          filtered.reduce((acc,s)=>{ const nm=s.products?.name||s.product_id; acc[nm]=(acc[nm]||0)+(s.units_sold*s.price_per_unit); return acc },{})
        ).sort((a,b)=>b[1]-a[1])

        return (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
            {/* Channel bar chart */}
            <div className="cost-card">
              <div className="cost-card-title">Revenue by Channel</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={channelData} margin={{top:4,right:4,left:-10,bottom:4}}>
                  <XAxis dataKey="channel" tick={{fill:'#6b5840',fontSize:10,textTransform:'capitalize'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'#6b5840',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R${v}`}/>
                  <Tooltip
                    contentStyle={{background:'#1e1914',border:'1px solid #3d3128',color:'#f0e6d3',fontSize:12}}
                    formatter={v=>[`R${Number(v).toFixed(0)}`,'Revenue']}
                    labelFormatter={l=>l.charAt(0).toUpperCase()+l.slice(1)}
                  />
                  <Bar dataKey="revenue" radius={[3,3,0,0]}>
                    {channelData.map((entry,i)=>(
                      <Cell key={i} fill={CHANNEL_COLORS[entry.channel]||'#6b5840'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Product text breakdown */}
            <div className="cost-card">
              <div className="cost-card-title">Revenue by Product</div>
              {productData.map(([name,rev])=>(
                <div key={name} className="cost-row">
                  <span className="cost-row-label">{name}</span>
                  <span className="cost-row-val">R{rev.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <SaleForm
        open={editing !== null}
        sale={editing === 'new' ? null : editing}
        products={products} formats={formats}
        onClose={()=>setEditing(null)} onSaved={load}
      />

      {deleting&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setDeleting(null)}>
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-hd"><div className="modal-title">Delete {deleting.order_id?'Order':'Sale'}</div></div>
            <div className="modal-body" style={{textAlign:'center',padding:24}}>
              <p style={{color:'var(--text2)',marginBottom:20}}>
                {deleting.order_id
                  ? 'Delete this entire order and all its items? Cannot be undone.'
                  : 'Delete this sale record? Cannot be undone.'}
              </p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button className="btn btn-outline" onClick={()=>setDeleting(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={()=>handleDelete(deleting)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
