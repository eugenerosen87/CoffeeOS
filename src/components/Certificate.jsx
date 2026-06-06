import { parseFlavorParts, getPeakWindow, buildTimeline, ROAST_NAMES, ROAST_POS } from '../lib/coffee'
import TimelineSvg from './TimelineSvg'

function DotScale({ acidity, body, sweetness }) {
  const items = []
  if (acidity)   items.push({ label:'Acidity',   score: acidity })
  if (body)      items.push({ label:'Body',       score: body })
  if (sweetness) items.push({ label:'Sweetness',  score: sweetness })
  if (!items.length) return null

  const Dots = ({ score }) => (
    <div style={{display:'flex',gap:6,justifyContent:'center',margin:'8px 0 5px'}}>
      {[1,2,3,4,5].map(i => {
        const diff = score - (i-1)
        const bg = diff>=1 ? '#2c4a2e' : diff>=0.5 ? 'linear-gradient(90deg,#2c4a2e 50%,transparent 50%)' : 'transparent'
        const bdr = diff>=0.5 ? '#2c4a2e' : '#ddd0b0'
        return <div key={i} style={{width:10,height:10,borderRadius:'50%',background:bg,border:`1.5px solid ${bdr}`,flexShrink:0}} />
      })}
    </div>
  )

  return (
    <div style={{padding:'16px 24px',background:'#f7f2e8',borderTop:'0.5px solid rgba(201,162,39,.3)',borderBottom:'1px solid #ddd0b0',display:'grid',gridTemplateColumns:`repeat(${items.length},1fr)`,gap:12,textAlign:'center'}}>
      {items.map(item => (
        <div key={item.label}>
          <div style={{fontSize:'6.5px',letterSpacing:'2.5px',textTransform:'uppercase',color:'#9a7d4a'}}>{item.label}</div>
          <Dots score={item.score} />
          <div style={{fontSize:13,fontWeight:700,color:'#2c1a0e'}}>
            {String(item.score).replace('.0','')}
            <span style={{fontSize:9,color:'#9a7d4a',fontWeight:400}}> / 5</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BrewBlock({ method, temp, ratio, grind }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:'6.5px',letterSpacing:'2px',textTransform:'uppercase',color:'#9a7d4a',marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
        {method}<span style={{flex:1,height:'.5px',background:'#e8dfc8',display:'inline-block'}}/>
      </div>
      <div className="brew-stat-g">
        {[['Temp',temp,'°C'],['Ratio',ratio,'coffee:water'],['Grind',grind,'size']].map(([l,v,u]) => (
          <div className="brew-stat" key={l}><div className="bsl">{l}</div><div className="bsv">{v}</div><div className="bsu">{u}</div></div>
        ))}
      </div>
    </div>
  )
}

export default function Certificate({ batch }) {
  if (!batch) return null

  const tl = buildTimeline(batch.date, batch.roast_level, batch.process)
  const peak = getPeakWindow(batch.date, batch.roast_level, batch.process)
  const flavor = parseFlavorParts(batch.notes)
  const rName = ROAST_NAMES[batch.roast_level] || 'Full City'
  const rPos = ROAST_POS[batch.roast_level] || 42
  const roastDate = new Date(batch.date)
  const fmtS = d => d.toLocaleDateString('en-ZA', { day:'numeric', month:'short' })
  const fmtL = d => d.toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' })

  const beans = (
    <div>
      {[...Array(5)].map((_,i) => (
        <span key={i} style={{display:'inline-block',width:9,height:13,background:i<3?'#2c4a2e':'#e8dfc8',borderRadius:'50% 50% 50% 50%/60% 60% 40% 40%',margin:'0 2px',verticalAlign:'middle'}}/>
      ))}
    </div>
  )

  return (
    <div className="cert">
      {batch.hero_img
        ? <div className="c-hero">
            <img src={batch.hero_img} alt="" />
            <div className="c-hero-overlay">
              <div className="c-hero-title">Batch Certificate</div>
              {batch.roaster_name && <div className="c-hero-roaster">{batch.roaster_name}</div>}
            </div>
          </div>
        : <div className="c-hero-ph">
            <div className="c-hero-ph-title">Batch Certificate</div>
            {batch.roaster_name && <div className="c-hero-ph-roaster">{batch.roaster_name}</div>}
          </div>
      }

      <div className="cmeta">
        {[['Roast Date',fmtL(roastDate)],['Batch',batch.id],['Origin',batch.origin||'—'],['Process',batch.process||'—']].map(([l,v]) => (
          <div className="cmc" key={l}><div className="cml">{l}</div><div className="cmv">{v}</div></div>
        ))}
      </div>

      <div className="c-roast">
        <div style={{flex:1}}>
          <div className="c-roast-track"><div className="c-roast-dot" style={{left:`${rPos}%`}} /></div>
          <div className="c-roast-labels"><span>Cinnamon</span><span>City+</span><span>Full City</span><span>Vienna</span><span>Italian</span></div>
        </div>
        <div className="c-roast-name">{rName}</div>
      </div>

      <div className="c-peak">
        {beans}
        <div className="c-peak-inner">
          <div className="c-peak-ey">Optimal Drinking Window</div>
          <div className="c-peak-dt">{fmtS(peak.start)} – {fmtS(peak.end)}</div>
          <div className="c-peak-sub">Days {tl.peakStartDay}–{tl.peakEndDay} after roast</div>
        </div>
        {beans}
      </div>

      {batch.story && (
        <div className="c-story">
          <div className="c-gem" />
          <div className="c-story-text">{batch.story}</div>
          <div className="c-gem" />
        </div>
      )}

      <div className="cbody">
        <div className="csec">
          <div className="cst">Origin & Traceability</div>
          {[['Farm',batch.farm||'—'],['Green Lot',batch.green_lot_id||'—'],batch.variety&&['Variety',batch.variety],batch.altitude&&['Altitude',batch.altitude],['Input',(batch.input_kg||'—')+' kg'],['Output',(batch.output_kg||'—')+' kg']].filter(Boolean).map(([k,v]) => (
            <div className="cir" key={k}><div className="cik">{k}</div><div className="civ">{v}</div></div>
          ))}
        </div>
        <div className="csec">
          <div className="cst">Brewing Guide</div>
          <BrewBlock method="Filter / Pour-Over" temp="92–96" ratio="1:15" grind="Medium" />
          <BrewBlock method="Espresso" temp="93" ratio="1:2" grind="Fine" />
        </div>
      </div>

      {flavor.icons.length > 0 && (
        <div className="cflavor">
          <div className="cflavor-hd">Flavour Notes</div>
          <div className="cflavor-pills">{flavor.icons.map(l => <span className="cflavor-pill" key={l}>{l}</span>)}</div>
          {flavor.roasterNote && <div className="cflavor-note">{flavor.roasterNote}</div>}
        </div>
      )}

      <DotScale acidity={batch.acidity} body={batch.body} sweetness={batch.sweetness} />

      <div style={{padding:'14px 22px 10px',background:'#faf6ee',borderTop:'0.5px solid rgba(201,162,39,.3)',borderBottom:'1px solid #ddd0b0'}}>
        <div style={{fontSize:'7px',letterSpacing:'2.5px',textTransform:'uppercase',color:'#9a7d4a',textAlign:'center',marginBottom:3}}>Freshness & Peak Flavour Timeline</div>
        <TimelineSvg batch={batch} />
      </div>

      <div className="c-sig">
        <div className="c-sig-l">
          Roasted <span>{fmtL(roastDate)}</span><br/>
          Peak <span>{fmtS(peak.start)} – {fmtS(peak.end)}</span><br/>
          Output <span>{batch.output_kg||'—'} kg</span>
        </div>
        <div className="c-sig-c">
          <div className="c-sig-name">{batch.roaster_name || 'Master Roaster'}</div>
          <div className="c-sig-ttl">Roasted & Approved By</div>
          <div className="c-sig-seal"><div className="c-sig-seal-txt">ROAST<br/>CERT</div></div>
        </div>
        <div className="c-sig-r">
          Batch <span>{batch.id}</span><br/>
          Lot <span>{batch.green_lot_id||'—'}</span><br/>
          Specialty Coffee
        </div>
      </div>
    </div>
  )
}
