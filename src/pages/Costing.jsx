import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcBatchCost, calcProductCost, fmtDate, ROAST_NAMES } from '../lib/coffee'
import { useSettings } from '../lib/settings'

const R   = n => n==null ? '—' : `R ${Number(n).toFixed(2)}`
const Pct = n => n==null ? '—' : `${Number(n).toFixed(1)}%`

function MarginBar({ pct }) {
  const val = Math.min(100, Math.max(0, pct||0))
  const color = pct==null?'var(--border2)':pct<20?'#8b3a2a':pct<35?'#c9a84c':'#3d6b3a'
  return (
    <div style={{height:3,background:'var(--bg4)',borderRadius:2,overflow:'hidden',margin:'5px 0 3px'}}>
      <div style={{height:'100%',borderRadius:2,background:color,width:`${val}%`}}/>
    </div>
  )
}

// ── TAB: BATCH COSTING ────────────────────────────────────────────
function BatchCosting({ batches, greenStock, settings }) {
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const id = searchParams.get('batch')
    if (id && batches.length) setSelected(batches.find(b=>b.id===id)||null)
  }, [batches])

  const stock   = selected ? greenStock.find(g=>g.coffee_id===selected.coffee_id) : null
  const c       = selected ? calcBatchCost({...selected, _current_price: stock?.current_price_per_kg||0}, settings) : null

  return (
    <div>
      <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
        <select style={{width:320}} value={selected?.id||''} onChange={e=>setSelected(batches.find(b=>b.id===e.target.value)||null)}>
          <option value="">— Select batch —</option>
          {batches.map(b=><option key={b.id} value={b.id}>{b.id} · {b.coffee_id||''} · {ROAST_NAMES[b.roast_level]||''} ({fmtDate(b.date)})</option>)}
        </select>
        {c && <span style={{fontSize:12,color:'var(--text3)'}}>Cost/kg roasted: <strong style={{color:'var(--gold)',fontFamily:'var(--font-mono)'}}>{R(c.costPerKg)}</strong></span>}
      </div>

      {!selected && <div className="empty"><div className="empty-icon">◎</div>Select a roast batch to see its production cost</div>}

      {selected && c && (
        <div className="cost-card">
          <div className="cost-card-title">
            Production Cost — {selected.id} · {selected.coffee_id} · {ROAST_NAMES[selected.roast_level]||selected.roast_level}
          </div>

          {[
            [`Green beans — ${c.inputKg.toFixed(1)} kg × R${c.greenCostPerKg.toFixed(2)}/kg`, c.greenTotal],
            [`Gas — ${c.gasIsOverride?'batch override':`${c.outputKg.toFixed(1)} kg × R${Number(settings.gas_rate||0).toFixed(2)}`}`, c.gasCost],
            [`Electricity — ${c.elecIsOverride?'batch override':`${c.outputKg.toFixed(1)} kg × R${Number(settings.elec_rate||0).toFixed(2)}`}`, c.elecCost],
            [`Labour — ${c.labourHours.toFixed(2)} h × R${c.labourRate.toFixed(0)}/hr`, c.labourCost],
          ].map(([l,v])=>(
            <div key={l} className="cost-row">
              <span className="cost-row-label" style={v===0?{color:'var(--text3)'}:{}}>{l}</span>
              <span className="cost-row-val">{R(v)}</span>
            </div>
          ))}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
            <div className="cost-total">
              <span className="cost-total-label">Total Roast Cost</span>
              <span className="cost-total-val">{R(c.roastCost)}</span>
            </div>
            <div className="cost-total" style={{borderColor:'var(--border2)'}}>
              <span className="cost-total-label">Cost per kg roasted</span>
              <span className="cost-total-val" style={{fontSize:15}}>{R(c.costPerKg)}/kg</span>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:11,color:'var(--text3)',display:'flex',gap:16,flexWrap:'wrap'}}>
            <span>Roast loss: <strong style={{color:'var(--text)'}}>{c.actualLoss.toFixed(1)}%</strong> ({c.inputKg.toFixed(1)} kg green → {c.outputKg.toFixed(1)} kg roasted)</span>
            {c.wasteKg > 0 && <span>Waste: <strong style={{color:'var(--red2)'}}>{c.wasteKg.toFixed(2)} kg</strong> ({c.wastePct.toFixed(1)}%)</span>}
            <span>Available: <strong style={{color:'var(--green2)'}}>{c.availableKg.toFixed(2)} kg</strong></span>
          </div>
          {c.usingSnapped && (
            <div style={{marginTop:8,padding:'6px 12px',background:'var(--green-dim)',borderRadius:4,fontSize:11,color:'var(--green2)',borderLeft:'2px solid var(--green)'}}>
              ✓ Using snapped costs from roast date — rates locked, not affected by Settings changes
            </div>
          )}
          {!c.usingSnapped && (
            <div style={{marginTop:8,padding:'6px 12px',background:'var(--bg4)',borderRadius:4,fontSize:11,color:'var(--gold-dim)',borderLeft:'2px solid var(--gold-dim)'}}>
              Using live Settings rates — re-save this batch to lock historical costs
            </div>
          )}
          {(c.labourCost===0||(c.gasCost===0&&!c.gasIsOverride))&&(
            <div style={{marginTop:8,padding:'8px 12px',background:'var(--bg4)',borderRadius:4,fontSize:11,color:'var(--gold-dim)',borderLeft:'2px solid var(--gold-dim)'}}>
              Some costs are R0 — check your rates in <strong style={{color:'var(--gold)'}}>Settings</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TAB: PRODUCT COSTING ─────────────────────────────────────────
function ProductCosting({ products, batches, formats, greenStock, settings }) {
  const [selected, setSelected] = useState(null)
  const [recipe, setRecipe]     = useState([])
  const [prices, setPrices]     = useState([])
  const [costData, setCostData] = useState(null)
  const nn = v => { const p = parseFloat(v); return isNaN(p) ? 0 : p }

  useEffect(() => {
    if (!selected) { setRecipe([]); setPrices([]); setCostData(null); return }
    Promise.all([
      supabase.from("product_recipe").select("*").eq("product_id",selected.id),
      supabase.from("product_prices").select("*").eq("product_id",selected.id),
    ]).then(([{data:r},{data:p}]) => {
      const rec = (r||[]).map(row => {
        const approvedBatches = batches
          .filter(b => b.coffee_id === row.coffee_id && ["approved","resting"].includes(b.status) && !b.archived)
          .sort((a,b) => new Date(b.date) - new Date(a.date))
        const bestBatch = approvedBatches[0]
        const stock = bestBatch ? greenStock.find(g=>g.coffee_id===bestBatch.coffee_id) : null
        const bCost = bestBatch ? calcBatchCost({...bestBatch, _current_price: nn(stock?.current_price_per_kg)}, settings) : null
        const coffee = greenStock.find(g=>g.coffee_id===row.coffee_id)
        return {
          ...row,
          _batchCostPerKg: bCost?.costPerKg || nn(coffee?.current_price_per_kg) || 0,
          _batchId: bestBatch?.id || null,
          _batchDate: bestBatch?.date || null,
          _availableKg: nn(bestBatch?.available_kg),
          _usingSnapped: bCost?.usingSnapped || false,
        }
      })
      setRecipe(rec); setPrices(p||[])
      const c = calcProductCost(rec, formats.filter(f=>f.active).sort((a,b)=>a.sort_order-b.sort_order), p||[], settings)
      setCostData(c)
    })
  }, [selected])

  return (
    <div>
      <div style={{marginBottom:16}}>
        <select style={{width:320}} value={selected?.id||''} onChange={e=>setSelected(products.find(p=>p.id===e.target.value)||null)}>
          <option value="">— Select product —</option>
          {products.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.name} ({p.product_type==='blend'?'Blend':'Single Origin'})</option>)}
        </select>
      </div>

      {!selected && <div className="empty"><div className="empty-icon">◇</div>Select a product to see its blended cost and pricing</div>}

      {selected && costData && (<>
        {/* Recipe breakdown */}
        <div className="cost-card" style={{marginBottom:16}}>
          <div className="cost-card-title">Blended Cost — {selected.name}</div>
          {recipe.map(r=>(
            <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:50,height:3,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{width:`${r.percentage}%`,height:'100%',background:'var(--gold)'}}/>
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--gold)',minWidth:42}}>{r.percentage}%</span>
                <span style={{fontSize:12,color:'var(--text2)'}}>{r.coffee_id}</span>
                {r._batchId&&<span style={{fontSize:11,color:'var(--text3)'}}>· using {r._batchId} ({fmtDate(r._batchDate)}){r._usingSnapped?' ✓ locked':''}</span>}
                {!r._batchId&&<span style={{fontSize:11,color:'var(--red2)'}}>· no approved batch available</span>}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text)'}}>R{r._batchCostPerKg.toFixed(2)}/kg</div>
                <div style={{fontSize:10,color:'var(--text3)'}}>× {r.percentage}% = R{(r._batchCostPerKg*r.percentage/100).toFixed(2)}</div>
              </div>
            </div>
          ))}
          <div className="cost-total" style={{marginTop:12}}>
            <span className="cost-total-label">Weighted blended cost/kg</span>
            <span className="cost-total-val">{R(costData.weightedCostPerKg)}</span>
          </div>
        </div>

        {/* Per format */}
        <div style={{fontSize:'9px',letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:10}}>
          Per Format — Unit Cost · Recommended · Your Price
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
          {costData.formatBreakdown.map(fb=>{
            const {format:fmt,unitCost,recPrice,recPriceVat,recMargin,yourPrice,margin,units,profit} = fb
            const hasPrice = yourPrice!=null
            const diff = hasPrice?yourPrice-unitCost:null
            const marginColor = margin==null?'var(--text3)':margin<20?'#c4543c':margin<35?'#c9a84c':'#5a9e56'
            return (
              <div key={fmt.id} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
                <div style={{background:'var(--bg4)',padding:'9px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--gold-dim)',fontWeight:600}}>{fmt.name}</span>
                  {!fmt.is_wholesale&&<span style={{fontSize:10,color:'var(--text3)'}}>bag R{fmt.bag_cost} + sticker R{fmt.sticker_cost}</span>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderBottom:'1px solid var(--border)'}}>
                  <div style={{padding:'12px 14px',borderRight:'1px solid var(--border)'}}>
                    <div style={{fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:5}}>Unit cost</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:18,color:'var(--text)',lineHeight:1}}>{R(unitCost)}</div>
                  </div>
                  <div style={{padding:'12px 14px',borderRight:'1px solid var(--border)',background:'rgba(201,168,76,.04)'}}>
                    <div style={{fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:5}}>Recommended ({costData.wsMarkup}% markup)</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:18,color:'var(--text2)',lineHeight:1}}>{R(recPrice)}</div>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>
                      {Pct(recMargin)} margin
                      {costData.vatEnabled && <> · {R(recPriceVat)} incl. VAT</>}
                    </div>
                  </div>
                  <div style={{padding:'12px 14px',background:hasPrice?'rgba(61,107,58,.12)':'transparent'}}>
                    <div style={{fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase',color:hasPrice?'var(--green2)':'var(--text3)',marginBottom:5}}>
                      {hasPrice?'Your price':'Your price — not set'}
                    </div>
                    {hasPrice
                      ? <><div style={{fontFamily:'var(--font-mono)',fontSize:18,color:'var(--gold)',lineHeight:1}}>{R(yourPrice)}</div>
                          <div style={{fontSize:10,color:diff>=0?'var(--green2)':'var(--red2)',marginTop:3}}>{diff>=0?'+':''}{R(diff)} vs cost</div></>
                      : <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Set in <Link to="/products" style={{color:'var(--gold)'}}>Products → Edit</Link></div>
                    }
                  </div>
                </div>
                <div style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:16}}>
                  <div style={{flex:1}}>
                    <MarginBar pct={hasPrice?margin:recMargin}/>
                    <span style={{fontSize:10,color:hasPrice?marginColor:'var(--text3)',fontWeight:600}}>
                      {hasPrice?`${Pct(margin)} margin`:`Rec: ${Pct(recMargin)} margin`}
                    </span>
                  </div>
                  {hasPrice&&profit!=null&&(
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:'8px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:2}}>Profit on {units} units</div>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:14,color:'var(--green2)'}}>R{Number(profit).toFixed(0)}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </>)}
    </div>
  )
}

// ── MAIN COSTING PAGE ─────────────────────────────────────────────
export default function Costing() {
  const [tab, setTab]           = useState('batch')
  const [batches, setBatches]   = useState([])
  const [products, setProducts] = useState([])
  const [formats, setFormats]   = useState([])
  const [greenStock, setGreenStock] = useState([])
  const [loading, setLoading]   = useState(true)
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('batch')) setTab('batch')
    Promise.all([
      supabase.from('roasts').select('*').order('date',{ascending:false}),
      supabase.from('products').select('*').order('name'),
      supabase.from('formats').select('*').order('sort_order'),
      supabase.from('green_stock').select('*'),
    ]).then(([{data:b},{data:p},{data:f},{data:g}]) => {
      setBatches(b||[]); setProducts(p||[]); setFormats(f||[]); setGreenStock(g||[])
      setLoading(false)
    })
  }, [])

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Costing</div><div className="page-sub">Batch cost · Product pricing · Margins</div></div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:24,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',width:'fit-content'}}>
        {[['batch','Roast Batch Cost'],['product','Product Pricing']].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={{padding:'10px 24px',border:'none',background:tab===key?'var(--bg4)':'transparent',color:tab===key?'var(--gold)':'var(--text2)',fontFamily:'var(--font-body)',fontSize:12,fontWeight:600,letterSpacing:'.5px',cursor:'pointer',borderRight:'1px solid var(--border)'}}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading…</div> : (
        tab==='batch'
          ? <BatchCosting batches={batches} greenStock={greenStock} settings={settings}/>
          : <ProductCosting products={products} batches={batches} formats={formats} greenStock={greenStock} settings={settings}/>
      )}
    </div>
  )
}
