import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { fmtDate } from '../lib/coffee'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CHANNELS = ['direct','wholesale','market','online','cafe','other']

function SaleForm({ open, sale, products, formats, onClose, onSaved }) {
  const toast = useToast()
  const isEditing = !!sale
  const [form, setForm] = useState({
    product_id:'', format_id:'', sale_date: new Date().toISOString().split('T')[0],
    units_sold:'', price_per_unit:'', channel:'direct', customer:'', note:''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEditing) {
      setForm({
        product_id:    sale.product_id,
        format_id:     sale.format_id,
        sale_date:     sale.sale_date,
        units_sold:    String(sale.units_sold),
        price_per_unit:String(sale.price_per_unit),
        channel:       sale.channel,
        customer:      sale.customer||'',
        note:          sale.note||'',
      })
    } else {
      setForm({
        product_id:'', format_id:'', sale_date: new Date().toISOString().split('T')[0],
        units_sold:'', price_per_unit:'', channel:'direct', customer:'', note:''
      })
    }
  }, [open, sale])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Auto-fill price from product_prices when product + format selected
  const handleFormatSelect = async (formatId) => {
    set('format_id', formatId)
    if (form.product_id && formatId) {
      const { data } = await supabase.from('product_prices')
        .select('price').eq('product_id', form.product_id).eq('format_id', formatId).single()
      if (data?.price) set('price_per_unit', data.price)
    }
  }

  const handleSave = async () => {
    if (!form.product_id) { toast('Select a product', true); return }
    if (!form.format_id)  { toast('Select a format', true); return }
    if (!form.units_sold) { toast('Enter units sold', true); return }
    if (!form.price_per_unit) { toast('Enter price per unit', true); return }
    setSaving(true)

    const payload = {
      product_id:     form.product_id,
      format_id:      form.format_id,
      sale_date:      form.sale_date,
      units_sold:     parseInt(form.units_sold)||0,
      price_per_unit: parseFloat(form.price_per_unit)||0,
      channel:        form.channel,
      customer:       form.customer,
      note:           form.note,
    }

    const { error } = isEditing
      ? await supabase.from('sales').update(payload).eq('id', sale.id)
      : await supabase.from('sales').insert(payload)

    if (error) { toast('Error: '+error.message, true); setSaving(false); return }
    setSaving(false)
    toast(isEditing ? 'Sale updated' : 'Sale recorded')
    onSaved(); onClose()
  }

  const revenue = (parseInt(form.units_sold)||0) * (parseFloat(form.price_per_unit)||0)
  const selectedProduct = products.find(p=>p.id===form.product_id)

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-hd">
          <div className="modal-title">{isEditing ? 'Edit Sale' : 'Record Sale'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fsec">What sold</div>
            <div className="form-group full">
              <label>Product</label>
              <select value={form.product_id} onChange={e=>set('product_id',e.target.value)}>
                <option value="">— Select product —</option>
                {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Format</label>
              <select value={form.format_id} onChange={e=>handleFormatSelect(e.target.value)}>
                <option value="">— Select format —</option>
                {formats.filter(f=>f.active).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Channel</label>
              <select value={form.channel} onChange={e=>set('channel',e.target.value)}>
                {CHANNELS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>

            <div className="fsec">Sale details</div>
            <div className="form-group"><label>Sale Date</label><input type="date" value={form.sale_date} onChange={e=>set('sale_date',e.target.value)}/></div>
            <div className="form-group"><label>Customer (optional)</label><input value={form.customer} onChange={e=>set('customer',e.target.value)} placeholder="e.g. Café name"/></div>
            <div className="form-group">
              <label>Units sold</label>
              <input type="number" step="1" value={form.units_sold} onChange={e=>set('units_sold',e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Price per unit (R excl. VAT)</label>
              <input type="number" step="0.01" value={form.price_per_unit} onChange={e=>set('price_per_unit',e.target.value)}/>
              {selectedProduct&&form.format_id&&<div className="form-hint">Auto-filled from product price list</div>}
            </div>
            <div className="form-group full"><label>Note (optional)</label><input value={form.note} onChange={e=>set('note',e.target.value)}/></div>

            {/* Live revenue preview */}
            {revenue > 0 && (
              <div style={{gridColumn:'1/-1',background:'var(--bg4)',borderRadius:6,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid var(--border2)'}}>
                <span style={{fontSize:12,color:'var(--text3)'}}>{form.units_sold} unit{form.units_sold>1?'s':''} × R{Number(form.price_per_unit).toFixed(2)}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:18,color:'var(--gold)'}}>R{revenue.toFixed(2)}</span>
              </div>
            )}
          </div>
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
  const [editing, setEditing]   = useState(null)   // null=closed, 'new'=create, sale obj=edit
  const [deleting, setDeleting] = useState(null)
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

  const handleDelete = async (id) => {
    await supabase.from('sales').delete().eq('id',id)
    toast('Sale deleted'); setDeleting(null); load()
  }

  const filtered = sales.filter(s => {
    if (filterProduct && s.product_id !== filterProduct) return false
    if (filterChannel && s.channel !== filterChannel) return false
    return true
  })

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
            <th>Date</th><th>Product</th><th>Format</th><th>Channel</th>
            <th>Customer</th><th>Units</th><th>Price/unit</th><th>Revenue</th><th></th>
          </tr></thead>
          <tbody>
            {loading&&<tr><td colSpan="9"><div className="loading">Loading…</div></td></tr>}
            {!loading&&!filtered.length&&(
              <tr><td colSpan="9">
                <div className="empty">
                  <div className="empty-icon">◇</div>
                  {sales.length?'No sales match your filters':'No sales recorded yet — click Record Sale to start'}
                </div>
              </td></tr>
            )}
            {filtered.map(s=>(
              <tr key={s.id}>
                <td>{fmtDate(s.sale_date)}</td>
                <td style={{fontWeight:500}}>{s.products?.name||'—'}</td>
                <td className="td-muted">{s.formats?.name||'—'}</td>
                <td><span className="badge badge-rest" style={{textTransform:'capitalize'}}>{s.channel}</span></td>
                <td className="td-muted">{s.customer||'—'}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{s.units_sold}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>R{Number(s.price_per_unit).toFixed(2)}</td>
                <td style={{fontFamily:'var(--font-mono)',color:'var(--gold)',fontWeight:600}}>
                  R{(s.units_sold*s.price_per_unit).toFixed(2)}
                </td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn btn-outline btn-xs" onClick={()=>setEditing(s)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={()=>setDeleting(s)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
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
            <div className="modal-hd"><div className="modal-title">Delete Sale</div></div>
            <div className="modal-body" style={{textAlign:'center',padding:24}}>
              <p style={{color:'var(--text2)',marginBottom:20}}>Delete this sale record? Cannot be undone.</p>
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
