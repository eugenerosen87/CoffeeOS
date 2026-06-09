import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { calcBatchCost, fmtDate, ROAST_NAMES } from '../lib/coffee'
import { useSettings } from '../lib/settings'

const n = v => { const p = parseFloat(v); return isNaN(p) ? 0 : p }

// ── PRODUCT FORM ─────────────────────────────────────────────────
// Recipe now links to GREEN COFFEE PROFILES (stable)
// Specific batches are selected at pack time in Product Runs
function ProductForm({ open, product, greenStock, formats, onClose, onSaved }) {
  const toast = useToast()
  const { settings } = useSettings()
  const [name, setName]     = useState('')
  const [desc, setDesc]     = useState('')
  const [type, setType]     = useState('single_origin')
  const [recipe, setRecipe] = useState([{ coffee_id:'', percentage:100 }])
  const [prices, setPrices] = useState({})
  const [saving, setSaving] = useState(false)
  const isEditing = !!product

  useEffect(() => {
    if (!open) return
    if (product) {
      setName(product.name||''); setDesc(product.description||''); setType(product.product_type||'single_origin')
      supabase.from('product_recipe').select('*').eq('product_id', product.id)
        .then(({ data }) => setRecipe(data?.length ? data.map(r=>({coffee_id:r.coffee_id||'',percentage:r.percentage})) : [{coffee_id:'',percentage:100}]))
      supabase.from('product_prices').select('*').eq('product_id', product.id)
        .then(({ data }) => { const p={}; data?.forEach(r=>{p[r.format_id]=r.price}); setPrices(p) })
    } else {
      setName(''); setDesc(''); setType('single_origin')
      setRecipe([{coffee_id:'',percentage:100}]); setPrices({})
    }
  }, [open, product])

  const totalPct   = recipe.reduce((s,r)=>s+(parseFloat(r.percentage)||0),0)
  const addCoffee  = () => setRecipe(r=>[...r,{coffee_id:'',percentage:0}])
  const removeRow  = i => setRecipe(r=>r.filter((_,j)=>j!==i))
  const setRow     = (i,k,v) => setRecipe(r=>r.map((row,j)=>j===i?{...row,[k]:v}:row))

  // Estimated blended cost based on current price of each coffee × %
  const weightedCost = recipe.reduce((sum, r) => {
    const coffee = greenStock.find(g=>g.coffee_id===r.coffee_id)
    const pricePerKg = n(coffee?.current_price_per_kg)
    return sum + (n(r.percentage)/100) * pricePerKg
  }, 0)

  const handleSave = async () => {
    if (!name.trim()) { toast('Product name required', true); return }
    if (Math.abs(totalPct-100)>0.1) { toast('Recipe must total 100%', true); return }
    if (recipe.some(r=>!r.coffee_id)) { toast('Select a coffee for each recipe line', true); return }
    setSaving(true)

    let pid = product?.id
    if (isEditing) {
      const { error } = await supabase.from('products').update({name:name.trim(),description:desc,product_type:type}).eq('id',pid)
      if (error) { toast('Error: '+error.message,true); setSaving(false); return }
    } else {
      const { data,error } = await supabase.from('products').insert({name:name.trim(),description:desc,product_type:type}).select().single()
      if (error) { toast('Error: '+error.message,true); setSaving(false); return }
      pid = data.id
    }

    // Save recipe using coffee_id (not batch_id)
    await supabase.from('product_recipe').delete().eq('product_id',pid)
    const { error: re } = await supabase.from('product_recipe').insert(
      recipe.map(r=>({product_id:pid, coffee_id:r.coffee_id, percentage:parseFloat(r.percentage)||0}))
    )
    if (re) { toast('Recipe error: '+re.message,true); setSaving(false); return }

    const priceRows = Object.entries(prices).filter(([,v])=>v!==''&&v!=null).map(([format_id,price])=>({product_id:pid,format_id,price:parseFloat(price)||0}))
    if (priceRows.length) {
      await supabase.from('product_prices').delete().eq('product_id',pid)
      await supabase.from('product_prices').insert(priceRows)
    }

    setSaving(false); toast(isEditing?'Product updated':'Product created'); onSaved(); onClose()
  }

  const wsMarkup   = n(settings.ws_markup)
  const vatRate    = n(settings.vat_rate)
  const vatEnabled = settings.vat_enabled !== false
  const wsMulti    = 1 + wsMarkup/100
  const vatMulti   = vatEnabled ? 1 + vatRate/100 : 1

  if (!open) return null
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:740}}>
        <div className="modal-hd">
          <div className="modal-title">{isEditing?`Edit — ${product.name}`:'New Product'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fsec">Product Identity</div>
            <div className="form-group full"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. House Espresso Blend"/></div>
            <div className="form-group full"><label>Description (optional)</label><input value={desc} onChange={e=>setDesc(e.target.value)}/></div>
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={e=>setType(e.target.value)}>
                <option value="single_origin">Single Origin</option>
                <option value="blend">Blend</option>
              </select>
            </div>

            {/* Recipe — coffee profiles, NOT batches */}
            <div className="fsec">Blend Recipe — Green Coffee Profiles</div>
            <div style={{gridColumn:'1/-1',fontSize:11,color:'var(--text3)',marginBottom:8,fontStyle:'italic'}}>
              Define using coffee origins — this recipe never changes. Specific batches are selected at pack time in Product Runs.
            </div>
            <div style={{gridColumn:'1/-1'}}>
              {recipe.map((row,i)=>{
                const coffee = greenStock.find(g=>g.coffee_id===row.coffee_id)
                return (
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 110px 32px',gap:8,marginBottom:8,alignItems:'start'}}>
                    <div>
                      <select value={row.coffee_id} onChange={e=>setRow(i,'coffee_id',e.target.value)}>
                        <option value="">— Select green coffee —</option>
                        {greenStock.map(g=>(
                          <option key={g.coffee_id} value={g.coffee_id}>
                            {g.coffee_id} · {g.origin}{g.variety?` · ${g.variety}`:''} — {Number(g.stock_kg||0).toFixed(1)} kg in stock
                          </option>
                        ))}
                      </select>
                      {coffee && (
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>
                          {coffee.origin}{coffee.farm?` · ${coffee.farm}`:''} · {coffee.process}
                          {coffee.current_price_per_kg&&<span style={{color:'var(--gold)',marginLeft:8}}>R{Number(coffee.current_price_per_kg).toFixed(2)}/kg green</span>}
                        </div>
                      )}
                    </div>
                    <div style={{position:'relative'}}>
                      <input type="number" step="0.1" min="0" max="100" value={row.percentage} onChange={e=>setRow(i,'percentage',e.target.value)} style={{paddingRight:24}}/>
                      <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'var(--text3)',pointerEvents:'none'}}>%</span>
                    </div>
                    {recipe.length>1
                      ? <button className="btn btn-ghost btn-xs" style={{color:'var(--red2)',padding:'4px 8px',marginTop:4}} onClick={()=>removeRow(i)}>✕</button>
                      : <div/>}
                  </div>
                )
              })}
              <div style={{display:'flex',alignItems:'center',gap:14,marginTop:8}}>
                <button className="btn btn-outline btn-xs" onClick={addCoffee}>+ Add coffee</button>
                <span style={{fontSize:11,color:Math.abs(totalPct-100)<0.1?'var(--green2)':'var(--red2)',fontWeight:600}}>
                  Total: {totalPct.toFixed(1)}% {Math.abs(totalPct-100)<0.1?'✓':'(must equal 100%)'}
                </span>
                {weightedCost > 0 && Math.abs(totalPct-100)<0.1 && (
                  <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>
                    Est. green cost: <strong style={{color:'var(--gold)'}}>R{weightedCost.toFixed(2)}/kg</strong>
                  </span>
                )}
              </div>
              {Math.abs(totalPct-100)<0.1 && (
                <div style={{marginTop:8,fontSize:11,color:'var(--text3)',fontStyle:'italic'}}>
                  Note: this is the green bean cost estimate. Actual roasted cost is calculated in Costing once batches are roasted and allocated via Product Runs.
                </div>
              )}
            </div>

            {/* Prices per format */}
            <div className="fsec">Selling Prices per Format (excl. VAT)</div>
            <div style={{gridColumn:'1/-1',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {formats.filter(f=>f.active).sort((a,b)=>a.sort_order-b.sort_order).map(fmt => {
                const weightKg    = fmt.is_wholesale ? 1 : n(fmt.weight_g)/1000
                const estUnitCost = weightedCost > 0 ? (fmt.is_wholesale ? weightedCost : weightedCost*weightKg + n(fmt.bag_cost) + n(fmt.sticker_cost)) : null
                const recPrice    = estUnitCost ? estUnitCost * wsMulti : null
                const recPriceVat = recPrice ? recPrice * vatMulti : null
                return (
                  <div key={fmt.id} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'12px 14px'}}>
                    <div style={{fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--gold-dim)',marginBottom:8,fontWeight:600}}>{fmt.name}</div>
                    {estUnitCost != null && (
                      <div style={{display:'flex',gap:6,marginBottom:8,fontSize:10}}>
                        <div style={{flex:1,background:'var(--bg4)',borderRadius:4,padding:'5px 8px',textAlign:'center'}}>
                          <div style={{color:'var(--text3)',marginBottom:2}}>Est. cost</div>
                          <div style={{fontFamily:'var(--font-mono)',color:'var(--text)',fontSize:11}}>R{estUnitCost.toFixed(2)}</div>
                        </div>
                        <div style={{flex:1,background:'var(--bg4)',borderRadius:4,padding:'5px 8px',textAlign:'center',border:'1px dashed var(--border2)'}}>
                          <div style={{color:'var(--text3)',marginBottom:2}}>Rec. ({wsMarkup}%)</div>
                          <div style={{fontFamily:'var(--font-mono)',color:'var(--text2)',fontSize:11}}>R{recPrice.toFixed(2)}</div>
                          {vatEnabled && <div style={{color:'var(--text3)',fontSize:9}}>R{recPriceVat.toFixed(2)} incl VAT</div>}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>Your price (excl. VAT)</div>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'var(--text3)'}}>R</span>
                        <input type="number" step="0.01" value={prices[fmt.id]||''} onChange={e=>setPrices(p=>({...p,[fmt.id]:e.target.value}))} style={{paddingLeft:24, borderColor: prices[fmt.id] ? 'var(--green)' : undefined}} placeholder={recPrice ? recPrice.toFixed(2) : '0.00'}/>
                      </div>
                      {prices[fmt.id] && estUnitCost != null && (
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:3,display:'flex',justifyContent:'space-between'}}>
                          <span style={{color:(n(prices[fmt.id])-estUnitCost)/n(prices[fmt.id])*100 > 20?'var(--green2)':'var(--gold)'}}>
                            {(((n(prices[fmt.id])-estUnitCost)/n(prices[fmt.id]))*100).toFixed(1)}% margin
                          </span>
                          <span>R{(n(prices[fmt.id])*vatMulti).toFixed(2)} incl VAT</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Product'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Products() {
  const [products, setProducts]     = useState([])
  const [greenStock, setGreenStock] = useState([])
  const [formats, setFormats]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [formState, setFormState]   = useState({open:false,product:null})
  const [deleting, setDeleting]     = useState(null)
  const toast = useToast()

  const load = async () => {
    const [{data:p},{data:f},{data:g}] = await Promise.all([
      supabase.from('products').select('*, product_recipe(*), product_prices(*)').order('created_at',{ascending:false}),
      supabase.from('formats').select('*').order('sort_order'),
      supabase.from('green_stock').select('*'),
    ])
    setProducts(p||[]); setFormats(f||[]); setGreenStock(g||[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const handleArchive = async (product) => {
    const archived = !product.archived
    await supabase.from('products').update({archived, archived_at: archived?new Date().toISOString():null}).eq('id',product.id)
    toast(archived?'Product archived':'Product restored'); load()
  }

  const handleDelete = async (id) => {
    await supabase.from('products').delete().eq('id',id)
    toast('Deleted'); setDeleting(null); load()
  }

  const visible = products.filter(p=>showArchived?true:!p.archived)
  const archivedCount = products.filter(p=>p.archived).length

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Products</div><div className="page-sub">Recipes, Blends & Prices</div></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {archivedCount>0&&<button className={`btn btn-sm ${showArchived?'btn-outline':'btn-ghost'}`} onClick={()=>setShowArchived(s=>!s)}>{showArchived?'← Active Only':`Archived (${archivedCount})`}</button>}
          <button className="btn btn-gold" onClick={()=>setFormState({open:true,product:null})}>+ New Product</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          ['Active Products',products.filter(p=>!p.archived).length,''],
          ['Blends',products.filter(p=>p.product_type==='blend'&&!p.archived).length,''],
          ['Single Origins',products.filter(p=>p.product_type==='single_origin'&&!p.archived).length,''],
        ].map(([l,v])=>(
          <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-val">{v}</div></div>
        ))}
      </div>

      {loading&&<div className="loading">Loading…</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {visible.map(p=>{
          const recipe = p.product_recipe||[]
          const prices = p.product_prices||[]
          const priceCount = prices.filter(pr=>pr.price>0).length
          return (
            <div key={p.id} style={{background:'var(--bg2)',border:`1px solid ${p.archived?'var(--border)':'var(--border2)'}`,borderRadius:8,overflow:'hidden',opacity:p.archived?.6:1}}>
              <div style={{background:'var(--bg3)',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                  <div>
                    <div style={{fontFamily:'var(--font-head)',fontSize:17,color:'var(--text)'}}>{p.name}</div>
                    {p.description&&<div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{p.description}</div>}
                  </div>
                  <span className={`badge ${p.product_type==='blend'?'badge-peak':'badge-rest'}`}>{p.product_type==='blend'?'Blend':'Single Origin'}</span>
                </div>
              </div>

              {/* Recipe — shows coffee profiles */}
              <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>Blend Recipe</div>
                {recipe.map(r=>{
                  const coffee = greenStock.find(g=>g.coffee_id===r.coffee_id)
                  return (
                    <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                      <div style={{fontSize:12,color:'var(--text2)'}}>
                        <span style={{fontFamily:'var(--font-mono)',color:'var(--gold)',fontSize:11}}>{r.coffee_id}</span>
                        {coffee&&<span style={{color:'var(--text3)',marginLeft:8,fontSize:11}}>{coffee.origin}</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:50,height:3,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
                          <div style={{width:`${r.percentage}%`,height:'100%',background:'var(--gold)',borderRadius:2}}/>
                        </div>
                        <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--gold)',minWidth:36,textAlign:'right'}}>{r.percentage}%</span>
                      </div>
                    </div>
                  )
                })}
                {!recipe.length&&<div style={{fontSize:11,color:'var(--text3)'}}>No recipe set</div>}
              </div>

              <div style={{padding:'10px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'var(--text3)'}}>{priceCount} of {formats.filter(f=>f.active).length} formats priced</span>
                <div style={{display:'flex',gap:4}}>
                  {formats.filter(f=>f.active).slice(0,5).map(f=>{
                    const has = prices.find(pr=>pr.format_id===f.id&&pr.price>0)
                    return <div key={f.id} style={{width:8,height:8,borderRadius:2,background:has?'var(--green2)':'var(--border2)'}} title={f.name}/>
                  })}
                </div>
              </div>

              <div style={{padding:'12px 18px',display:'flex',gap:8}}>
                <button className="btn btn-gold btn-sm" style={{flex:1}} onClick={()=>setFormState({open:true,product:p})}>Edit</button>
                <button className="btn btn-outline btn-sm" onClick={()=>handleArchive(p)}>{p.archived?'Restore':'Archive'}</button>
                <button className="btn btn-danger btn-sm" onClick={()=>setDeleting(p)}>Del</button>
              </div>
            </div>
          )
        })}
        {!loading&&!visible.length&&(
          <div style={{gridColumn:'1/-1'}}><div className="empty"><div className="empty-icon">◉</div>No products yet</div></div>
        )}
      </div>

      <ProductForm open={formState.open} product={formState.product} greenStock={greenStock} formats={formats} onClose={()=>setFormState({open:false,product:null})} onSaved={load}/>

      {deleting&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setDeleting(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-hd"><div className="modal-title">Delete Product</div></div>
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
