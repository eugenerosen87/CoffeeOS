import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { batchStatus, fmtDate, ROAST_NAMES, getPeakWindow } from '../lib/coffee'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const GOLD = '#c9a84c'
const GREEN = '#3d6b3a'
const GREEN2 = '#5a9e56'
const RED = '#8b3a2a'
const RED2 = '#c4543c'
const AMBER = '#c9a84c'

function KpiCard({ label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,
        padding:'16px 20px',cursor:onClick?'pointer':'default',transition:'border-color .15s',
        borderLeft:`3px solid ${color||'var(--border)'}`,
      }}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor=color||'var(--gold)')}
      onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor='var(--border)')}
    >
      <div style={{fontSize:'9px',letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>{label}</div>
      <div style={{fontFamily:'var(--font-head)',fontSize:28,color:color||'var(--gold)',lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:'var(--text3)',marginTop:5}}>{sub}</div>}
    </div>
  )
}

// Visual freshness bar for a batch
function FreshnessBar({ batch }) {
  const nav = useNavigate()
  const daysOld = Math.floor((new Date() - new Date(batch.date)) / 86400000)
  const peak = getPeakWindow(batch.date, batch.roast_level, 'washed')
  const totalDays = peak.peakEndDay + 7
  const pct = Math.min(100, (daysOld / totalDays) * 100)

  let phase, color, label
  if (daysOld < peak.peakStartDay) {
    phase = 'resting'; color = 'var(--text3)'; label = `Resting — peak in ${peak.peakStartDay - daysOld}d`
  } else if (daysOld <= peak.peakEndDay) {
    phase = 'peak'; color = GREEN2; label = `Peak — ${peak.peakEndDay - daysOld}d left`
  } else {
    phase = 'decline'; color = AMBER; label = `Past peak — ${daysOld - peak.peakEndDay}d ago`
  }

  // Progress segments
  const restPct   = (peak.peakStartDay / totalDays) * 100
  const peakPct   = ((peak.peakEndDay - peak.peakStartDay) / totalDays) * 100
  const declinePct = 100 - restPct - peakPct

  return (
    <div
      style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',cursor:'pointer',transition:'border-color .15s'}}
      onClick={()=>nav(`/cert/${batch.id}`)}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--gold)'}}>{batch.id}</span>
          <span style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>{batch.coffee_id}</span>
          <span style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>{ROAST_NAMES[batch.roast_level]||batch.roast_level}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:10,color,fontWeight:600}}>{label}</span>
          <span style={{fontSize:10,color:'var(--text3)'}}>Day {daysOld}</span>
        </div>
      </div>

      {/* Segmented bar */}
      <div style={{height:6,borderRadius:3,overflow:'hidden',display:'flex',background:'var(--bg4)'}}>
        <div style={{width:`${restPct}%`,background:'var(--border2)',flexShrink:0}}/>
        <div style={{width:`${peakPct}%`,background:GREEN,flexShrink:0}}/>
        <div style={{width:`${declinePct}%`,background:'#5a3010',flexShrink:0}}/>
      </div>

      {/* Marker */}
      <div style={{position:'relative',height:10,marginTop:2}}>
        <div style={{
          position:'absolute',left:`${Math.min(98,pct)}%`,transform:'translateX(-50%)',
          width:2,height:10,background:color,borderRadius:1
        }}/>
      </div>

      {/* Phase labels */}
      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text3)',letterSpacing:'1px',textTransform:'uppercase',marginTop:2}}>
        <span>Resting</span>
        <span style={{color:GREEN2}}>Peak Window</span>
        <span>Decline</span>
      </div>
    </div>
  )
}

// Stock bar card
function StockCard({ coffee }) {
  const stock = Number(coffee.stock_kg||0)
  const threshold = Number(coffee.threshold||5)
  const purchased = Number(coffee.total_purchased_kg||0)
  const pct = purchased > 0 ? Math.min(100, (stock/purchased)*100) : 0
  const isEmpty = stock <= 0
  const isLow = stock < threshold
  const barColor = isEmpty ? RED : isLow ? AMBER : GREEN

  return (
    <div style={{background:'var(--bg3)',border:`1px solid ${isEmpty?RED:isLow?AMBER:'var(--border)'}`,borderRadius:6,padding:'12px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--gold)'}}>{coffee.coffee_id}</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{coffee.origin}{coffee.variety?` · ${coffee.variety}`:''}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:16,color:isEmpty?RED2:isLow?AMBER:GREEN2,lineHeight:1}}>{stock.toFixed(1)}</div>
          <div style={{fontSize:9,color:'var(--text3)'}}>kg stock</div>
        </div>
      </div>
      <div style={{height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:2,transition:'width .3s'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text3)',marginTop:4}}>
        <span>{isEmpty?'⚠ Empty':isLow?'⚠ Low stock':'In stock'}</span>
        <span>R{Number(coffee.current_price_per_kg||0).toFixed(2)}/kg · alert at {threshold}kg</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [batches, setBatches]     = useState([])
  const [greens, setGreens]       = useState([])
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const navigate = useNavigate()
  const now = new Date()

  useEffect(() => {
    Promise.all([
      supabase.from('roasts').select('*').eq('archived', false).order('date', {ascending:false}),
      supabase.from('green_stock').select('*').order('stock_kg', {ascending:true}),
      supabase.from('products').select('*').eq('archived', false).order('name'),
    ]).then(([{data:b},{data:g},{data:p}]) => {
      setBatches(b||[]); setGreens(g||[]); setProducts(p||[])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="page"><div className="loading">Loading dashboard…</div></div>

  // KPIs
  const activeBatches  = batches.filter(b => !b.archived)
  const inPeak         = activeBatches.filter(b => { const d=Math.floor((now-new Date(b.date))/86400000); return d>=5&&d<=14 })
  const resting        = activeBatches.filter(b => Math.floor((now-new Date(b.date))/86400000) < 5)
  const totalStock     = greens.reduce((s,g)=>s+Number(g.stock_kg||0),0)
  const lowStock       = greens.filter(g=>Number(g.stock_kg||0)<Number(g.threshold||5))
  const stockValue     = greens.reduce((s,g)=>s+Number(g.stock_kg||0)*Number(g.current_price_per_kg||0),0)
  const thisMonthKg    = activeBatches.filter(b=>{const r=new Date(b.date);return r.getMonth()===now.getMonth()&&r.getFullYear()===now.getFullYear()}).reduce((s,b)=>s+Number(b.output_kg||0),0)

  // Chart data — last 8 batches
  const chartData = activeBatches.slice(0,8).reverse().map(b=>({
    name: b.id, kg: Number(b.output_kg)||0,
    color: Math.floor((now-new Date(b.date))/86400000)<=14 ? GREEN : GOLD
  }))

  // Freshness groups
  const peakBatches    = activeBatches.filter(b=>{ const d=Math.floor((now-new Date(b.date))/86400000); return d>=5&&d<=14 })
  const restingBatches = activeBatches.filter(b=>Math.floor((now-new Date(b.date))/86400000)<5)
  const declineBatches = activeBatches.filter(b=>Math.floor((now-new Date(b.date))/86400000)>14).slice(0,3)

  return (
    <div className="page">
      {/* Header */}
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:28,color:'var(--text)',lineHeight:1}}>
          Good {now.getHours()<12?'morning':now.getHours()<17?'afternoon':'evening'} ☕
        </div>
        <div style={{fontSize:11,color:'var(--text3)',letterSpacing:'2px',textTransform:'uppercase',marginTop:5}}>
          {now.toLocaleDateString('en-ZA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:28}}>
        <KpiCard label="In Peak Window"   value={inPeak.length}            sub={`${resting.length} resting`}                color={GREEN2}  onClick={()=>navigate('/batches')}/>
        <KpiCard label="Green Stock"      value={totalStock.toFixed(1)+' kg'} sub={`R${stockValue.toFixed(0)} value`}       color={GOLD}    onClick={()=>navigate('/greens')}/>
        <KpiCard label="Low Stock Alerts" value={lowStock.length}           sub={lowStock.map(g=>g.coffee_id).join(', ')||'All good'} color={lowStock.length?RED2:GREEN2} onClick={()=>navigate('/greens')}/>
        <KpiCard label="Output This Month" value={thisMonthKg.toFixed(1)+' kg'} sub={`${activeBatches.filter(b=>{const r=new Date(b.date);return r.getMonth()===now.getMonth()}).length} batches`} color={GOLD}/>
        <KpiCard label="Active Products"  value={products.length}           sub="click to manage"                          color="var(--text3)" onClick={()=>navigate('/products')}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>

        {/* Freshness Tracker */}
        <div>
          <div style={{fontSize:'9px',letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12,fontWeight:600}}>
            Freshness Tracker
          </div>

          {peakBatches.length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:GREEN2,marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:GREEN2}}/>
                In Peak Window ({peakBatches.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {peakBatches.map(b=><FreshnessBar key={b.id} batch={b}/>)}
              </div>
            </div>
          )}

          {restingBatches.length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'var(--border2)'}}/> Resting ({restingBatches.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {restingBatches.map(b=><FreshnessBar key={b.id} batch={b}/>)}
              </div>
            </div>
          )}

          {declineBatches.length > 0 && (
            <div>
              <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:AMBER,marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:AMBER}}/> Past Peak ({declineBatches.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {declineBatches.map(b=><FreshnessBar key={b.id} batch={b}/>)}
              </div>
            </div>
          )}

          {activeBatches.length === 0 && (
            <div className="empty"><div className="empty-icon">◎</div>No active batches yet</div>
          )}
        </div>

        {/* Right column */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>

          {/* Output chart */}
          <div>
            <div style={{fontSize:'9px',letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12,fontWeight:600}}>
              Output kg — Recent Batches
            </div>
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'16px'}}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{top:4,right:4,left:-20,bottom:4}}>
                    <XAxis dataKey="name" tick={{fill:'#6b5840',fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#6b5840',fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#1e1914',border:'1px solid #3d3128',color:'#f0e6d3',fontSize:12}} formatter={v=>[v+' kg','Output']}/>
                    <Bar dataKey="kg" radius={[3,3,0,0]}>
                      {chartData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{padding:24}}>No batch data yet</div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <div style={{fontSize:'9px',letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12,fontWeight:600}}>
              Recent Activity
            </div>
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
              {activeBatches.slice(0,5).map((b,i)=>{
                const st = batchStatus(b.date)
                const loss = b.input_kg&&b.output_kg ? ((1-b.output_kg/b.input_kg)*100).toFixed(1)+'%' : '—'
                return (
                  <div key={b.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',borderBottom:i<4?'1px solid var(--border)':'none',cursor:'pointer'}}
                    onClick={()=>navigate(`/cert/${b.id}`)}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <div style={{width:6,height:6,borderRadius:'50%',background:st.cls==='badge-peak'?GREEN2:st.cls==='badge-rest'?'var(--border2)':AMBER,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--gold)'}}>{b.id}</span>
                        <span style={{fontSize:11,color:'var(--text2)'}}>{b.coffee_id}</span>
                      </div>
                      <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>
                        {ROAST_NAMES[b.roast_level]||b.roast_level} · {b.output_kg||'?'} kg · {loss} loss
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:11,color:'var(--text2)'}}>{fmtDate(b.date)}</div>
                      <span className={`badge ${st.cls}`} style={{fontSize:8}}>{st.label}</span>
                    </div>
                  </div>
                )
              })}
              {activeBatches.length === 0 && <div className="empty" style={{padding:24}}>No activity yet</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Green Stock Panel */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div style={{fontSize:'9px',letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text3)',fontWeight:600}}>
            Green Stock Levels
          </div>
          <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>navigate('/greens')}>
            Manage inventory →
          </button>
        </div>
        {greens.length > 0 ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
            {greens.map(g=><StockCard key={g.coffee_id} coffee={g}/>)}
          </div>
        ) : (
          <div className="empty">No green coffees yet</div>
        )}
      </div>

      {/* Low stock call to action */}
      {lowStock.length > 0 && (
        <div style={{background:'rgba(139,58,42,.12)',border:'1px solid var(--red)',borderRadius:8,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:13,color:RED2,fontWeight:600,marginBottom:3}}>
              ⚠ {lowStock.length} coffee{lowStock.length>1?'s':''} running low
            </div>
            <div style={{fontSize:11,color:'var(--text3)'}}>
              {lowStock.map(g=>`${g.coffee_id} (${Number(g.stock_kg||0).toFixed(1)} kg)`).join(' · ')}
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={()=>navigate('/greens')}>View Inventory</button>
        </div>
      )}
    </div>
  )
}
