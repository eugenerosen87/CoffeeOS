import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toast'

const ROAST_LEVELS = [
  {value:'cinnamon',label:'Cinnamon (Very Light)'},{value:'city',label:'City (Light)'},
  {value:'cityplus',label:'City+ (Light-Medium)'},{value:'fullcity',label:'Full City (Medium)'},
  {value:'fullcityplus',label:'Full City+ (Medium-Dark)'},{value:'vienna',label:'Vienna (Dark)'},
  {value:'french',label:'French (Very Dark)'},{value:'italian',label:'Italian (Espresso Dark)'},
]
const SCORES = ['0','1','1.5','2','2.5','3','3.5','4','4.5','5']
const SCORE_LABELS = {'0':'— Not set —','1':'1 — Very Low','1.5':'1.5','2':'2 — Low','2.5':'2.5','3':'3 — Medium','3.5':'3.5','4':'4 — High','4.5':'4.5','5':'5 — Very High'}

const EMPTY = {
  id:'', date: new Date().toISOString().split('T')[0],
  coffee_id:'', roast_level:'cityplus', roaster_name:'',
  input_kg:'', output_kg:'', labour_hours:'',
  gas_cost:'', electric_cost:'',
  charge_temp:'', drop_temp:'', first_crack_min:'', dev_time_pct:'',
  cupping_score:'', cupping_notes:'',
  hero_img:'', story:'', notes:'',
  acidity:'0', body:'0', sweetness:'0',
  status:'resting', waste_kg:''
}

export default function BatchForm({ open, batch, onClose, onSaved }) {
  const { settings } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [greenStock, setGreenStock] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const isEditing = !!batch

  useEffect(() => {
    if (!open) return
    supabase.from('green_stock').select('*').order('coffee_id')
      .then(({ data }) => setGreenStock(data||[]))

    if (batch) {
      setForm({
        ...EMPTY, ...batch,
        date: batch.date ? new Date(batch.date).toISOString().split('T')[0] : '',
        coffee_id: batch.coffee_id||'',
        labour_hours: batch.labour_hours||'',
        gas_cost: batch.gas_cost??'',
        electric_cost: batch.electric_cost??'',
        charge_temp: batch.charge_temp||'',
        drop_temp: batch.drop_temp||'',
        first_crack_min: batch.first_crack_min||'',
        dev_time_pct: batch.dev_time_pct||'',
        cupping_score: batch.cupping_score||'',
        acidity: String(batch.acidity||0),
        body: String(batch.body||0),
        sweetness: String(batch.sweetness||0),
        status: batch.status || 'resting',
        waste_kg: batch.waste_kg||'',
      })
    } else {
      setForm({...EMPTY, date:new Date().toISOString().split('T')[0], labour_hours:settings.default_hours})
    }
  }, [open, batch])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleCoffeeSelect = async (coffeeId) => {
    set('coffee_id', coffeeId)
    if (!coffeeId) return

    // Only auto-suggest if batch ID is empty (don't overwrite what user typed)
    if (!form.id.trim() && !isEditing) {
      // Count existing batches for this coffee to get next sequence number
      const { data } = await supabase
        .from('roasts')
        .select('id')
        .ilike('id', `${coffeeId}-%`)
      const next = String((data?.length || 0) + 1).padStart(3, '0')
      set('id', `${coffeeId}-${next}`)
    }
  }

  const handleImage = async (file) => {
    if (!file) return
    if (file.size > 5*1024*1024) { toast('Image must be under 5MB', true); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('hero-images').upload(path, file, {upsert:true})
    if (error) { toast('Upload failed: '+error.message, true); setUploading(false); return }
    const { data } = supabase.storage.from('hero-images').getPublicUrl(path)
    set('hero_img', data.publicUrl)
    setUploading(false)
    toast('Image uploaded ✓')
  }

  const selectedStock = greenStock.find(g => g.coffee_id === form.coffee_id)

  const handleSave = async () => {
    if (!form.id.trim()) { toast('Batch ID is required', true); return }
    if (!form.coffee_id)  { toast('Select a green coffee', true); return }
    setSaving(true)

    const inputKg  = parseFloat(form.input_kg)||0
    const outputKg = parseFloat(form.output_kg)||0
    const wasteKg  = parseFloat(form.waste_kg)||0
    const greenCostPerKg = selectedStock ? parseFloat(selectedStock.current_price_per_kg)||0 : 0

    // ── FIX 1: Snapshot current rates at save time ──────────────
    // These never change even if Settings are updated later
    const snapGasRate    = parseFloat(settings.gas_rate)||0
    const snapElecRate   = parseFloat(settings.elec_rate)||0
    const snapLabourRate = parseFloat(settings.labour_rate)||0
    const snapGreenCost  = inputKg * greenCostPerKg  // total green cost in ZAR

    const payload = {
      id: form.id.trim(),
      coffee_id: form.coffee_id,
      date: form.date ? new Date(form.date).toISOString() : null,
      roast_level: form.roast_level,
      roaster_name: form.roaster_name,
      status: form.status || 'resting',
      input_kg: inputKg,
      output_kg: outputKg,
      waste_kg: wasteKg,
      available_kg: Math.max(0, outputKg - wasteKg),
      labour_hours: parseFloat(form.labour_hours)||settings.default_hours,
      gas_cost: form.gas_cost !== '' ? parseFloat(form.gas_cost) : null,
      electric_cost: form.electric_cost !== '' ? parseFloat(form.electric_cost) : null,
      // Snapped cost fields — written once, never recalculated
      snapped_green_cost:  snapGreenCost,
      snapped_gas_rate:    snapGasRate,
      snapped_elec_rate:   snapElecRate,
      snapped_labour_rate: snapLabourRate,
      charge_temp: form.charge_temp !== '' ? parseFloat(form.charge_temp) : null,
      drop_temp: form.drop_temp !== '' ? parseFloat(form.drop_temp) : null,
      first_crack_min: form.first_crack_min !== '' ? parseFloat(form.first_crack_min) : null,
      dev_time_pct: form.dev_time_pct !== '' ? parseFloat(form.dev_time_pct) : null,
      cupping_score: parseFloat(form.cupping_score)||0,
      cupping_notes: form.cupping_notes,
      hero_img: form.hero_img||null,
      story: form.story,
      notes: form.notes,
      acidity: parseFloat(form.acidity)||0,
      body: parseFloat(form.body)||0,
      sweetness: parseFloat(form.sweetness)||0,
    }

    const { error } = isEditing
      ? await supabase.from('roasts').update(payload).eq('id', batch.id)
      : await supabase.from('roasts').insert(payload)

    if (error) { toast('Error: '+error.message, true); setSaving(false); return }

    // ── FIX: Only write ledger when status is Roasting or beyond ──
    // Planned/Scheduled are informational — no green stock deducted yet
    // ledger_written flag prevents double-writing if batch is re-saved
    const shouldWriteLedger = !isEditing
      && payload.coffee_id
      && inputKg > 0
      && ['roasting','resting','approved'].includes(payload.status)
      && !batch?.ledger_written

    if (shouldWriteLedger) {
      const movements = [{
        coffee_id: payload.coffee_id,
        movement_type: 'roast_out',
        quantity_kg: inputKg,
        reference_id: payload.id,
        reference_type: 'roast',
        note: `Roast batch ${payload.id}`
      }]
      if (wasteKg > 0) {
        movements.push({
          coffee_id: payload.coffee_id,
          movement_type: 'waste_out',
          quantity_kg: wasteKg,
          reference_id: payload.id,
          reference_type: 'roast',
          note: `Waste from batch ${payload.id}`
        })
      }
      await supabase.from('inventory_movements').insert(movements)
      // Mark ledger as written so re-saves don't double-deduct
      await supabase.from('roasts').update({ ledger_written: true }).eq('id', payload.id)
    }

    // If batch was planned/scheduled and now moves to roasting, write ledger
    if (isEditing
      && !batch.ledger_written
      && ['roasting','resting','approved'].includes(payload.status)
      && payload.coffee_id
      && inputKg > 0) {
      const movements = [{
        coffee_id: payload.coffee_id,
        movement_type: 'roast_out',
        quantity_kg: inputKg,
        reference_id: payload.id,
        reference_type: 'roast',
        note: `Roast batch ${payload.id} — ledger written on status change to ${payload.status}`
      }]
      if (wasteKg > 0) {
        movements.push({
          coffee_id: payload.coffee_id,
          movement_type: 'waste_out',
          quantity_kg: wasteKg,
          reference_id: payload.id,
          reference_type: 'roast',
          note: `Waste from batch ${payload.id}`
        })
      }
      await supabase.from('inventory_movements').insert(movements)
      await supabase.from('roasts').update({ ledger_written: true }).eq('id', payload.id)
    }

    setSaving(false)
    toast(isEditing ? 'Batch updated' : 'Batch added')
    onSaved(); onClose()
  }

  if (!open) return null

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <div className="modal-title">{isEditing ? `Edit Batch — ${batch.id}` : 'New Roast Batch'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">

            <div className="fsec">Roast Identity</div>
            <div className="form-group full">
              <label>Green Coffee (select first — Batch ID auto-generates)</label>
              <select value={form.coffee_id} onChange={e=>handleCoffeeSelect(e.target.value)}>
                <option value="">— Select green coffee —</option>
                {greenStock.map(g=>(
                  <option key={g.coffee_id} value={g.coffee_id}>
                    {g.coffee_id} · {g.origin}{g.variety?` · ${g.variety}`:''} — {Number(g.stock_kg||0).toFixed(1)} kg @ R{Number(g.current_price_per_kg||0).toFixed(2)}/kg
                  </option>
                ))}
              </select>
              {selectedStock && (
                <div style={{marginTop:6,padding:'8px 12px',background:'var(--bg4)',borderRadius:4,fontSize:11,color:'var(--text3)',display:'flex',gap:16,flexWrap:'wrap'}}>
                  <span>{selectedStock.origin}{selectedStock.farm?` · ${selectedStock.farm}`:''}</span>
                  <span>{selectedStock.process}</span>
                  {selectedStock.altitude&&<span>{selectedStock.altitude}</span>}
                  <span style={{marginLeft:'auto',color:'var(--gold)'}}>R{Number(selectedStock.current_price_per_kg||0).toFixed(2)}/kg green</span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Batch ID {!isEditing && <span style={{color:'var(--text3)',fontWeight:400,letterSpacing:0,textTransform:'none',fontSize:10}}>(auto-suggested, editable)</span>}</label>
              <input
                value={form.id}
                onChange={e=>set('id',e.target.value)}
                placeholder="Select a coffee above to auto-generate"
                disabled={isEditing}
                style={form.id && !isEditing ? {borderColor:'var(--green)',color:'var(--gold)'} : {}}
              />
            </div>
            <div className="form-group">
              <label>Roast Date</label>
              <input type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Roaster Name</label>
              <input value={form.roaster_name} onChange={e=>set('roaster_name',e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Roast Level</label>
              <select value={form.roast_level} onChange={e=>set('roast_level',e.target.value)}>
                {ROAST_LEVELS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="planned">Planned</option>
                <option value="scheduled">Scheduled</option>
                <option value="roasting">Roasting</option>
                <option value="roasted">Roasted</option>
                <option value="resting">Resting</option>
                <option value="approved">Approved</option>
              </select>
            </div>

            {/* Weights */}
            <div className="fsec">Weights & Operating Costs</div>
            <div className="form-group">
              <label>Input kg (green)</label>
              <input type="number" step="0.1" value={form.input_kg} onChange={e=>set('input_kg',e.target.value)}/>
              {selectedStock && form.input_kg && (
                <div style={{fontSize:10,color:'var(--text3)',marginTop:3,display:'flex',gap:12}}>
                  <span style={{color:'var(--gold)'}}>Est. output: ~{(parseFloat(form.input_kg)*0.855).toFixed(1)} kg</span>
                  <span style={{marginLeft:8}}>at 14.5% loss · R{(Number(form.input_kg)*Number(selectedStock.current_price_per_kg||0)).toFixed(2)} green cost</span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Output kg (roasted)</label>
              <input type="number" step="0.1" value={form.output_kg} onChange={e=>set('output_kg',e.target.value)}/>
              {form.input_kg && form.output_kg && (
                <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>
                  {((1 - form.output_kg/form.input_kg)*100).toFixed(1)}% roast loss (evaporation)
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Waste / Defects kg</label>
              <input type="number" step="0.01" value={form.waste_kg} onChange={e=>set('waste_kg',e.target.value)} placeholder="0 — scorched, destoned, discards"/>
              {form.waste_kg && form.output_kg && (
                <div style={{fontSize:10,color:'var(--red2)',marginTop:3}}>
                  {((form.waste_kg/form.output_kg)*100).toFixed(1)}% of output · Available: {(parseFloat(form.output_kg||0)-parseFloat(form.waste_kg||0)).toFixed(2)} kg
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Labour hours</label>
              <input type="number" step="0.25" value={form.labour_hours} onChange={e=>set('labour_hours',e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Gas override (R, blank = global rate)</label>
              <input type="number" step="0.01" value={form.gas_cost} onChange={e=>set('gas_cost',e.target.value)} placeholder="Optional"/>
            </div>
            <div className="form-group full">
              <label>Electricity override (R, blank = global rate)</label>
              <input type="number" step="0.01" value={form.electric_cost} onChange={e=>set('electric_cost',e.target.value)} placeholder="Optional"/>
            </div>

            {/* Roast Profile */}
            <div className="fsec">Roast Profile</div>
            <div className="form-group">
              <label>Charge Temp (°C)</label>
              <input type="number" step="1" value={form.charge_temp} onChange={e=>set('charge_temp',e.target.value)} placeholder="e.g. 200"/>
            </div>
            <div className="form-group">
              <label>Drop Temp (°C)</label>
              <input type="number" step="1" value={form.drop_temp} onChange={e=>set('drop_temp',e.target.value)} placeholder="e.g. 210"/>
            </div>
            <div className="form-group">
              <label>First Crack (min)</label>
              <input type="number" step="0.25" value={form.first_crack_min} onChange={e=>set('first_crack_min',e.target.value)} placeholder="e.g. 9.5"/>
            </div>
            <div className="form-group">
              <label>Dev Time % (DTR)</label>
              <input type="number" step="0.1" value={form.dev_time_pct} onChange={e=>set('dev_time_pct',e.target.value)} placeholder="e.g. 22"/>
              {form.first_crack_min && form.dev_time_pct && (
                <div className="form-hint">
                  Dev time: ~{((parseFloat(form.first_crack_min)||0)*(parseFloat(form.dev_time_pct)||0)/100).toFixed(1)} min
                </div>
              )}
            </div>

            {/* Cupping */}
            <div className="fsec">Cupping</div>
            <div className="form-group">
              <label>Cupping Score (0–100)</label>
              <input type="number" step="0.25" value={form.cupping_score} onChange={e=>set('cupping_score',e.target.value)}/>
            </div>
            <div className="form-group full">
              <label>Cupping Notes</label>
              <textarea style={{minHeight:70}} value={form.cupping_notes} onChange={e=>set('cupping_notes',e.target.value)} placeholder="Tasting notes — aroma, flavour, aftertaste, balance…"/>
            </div>

            {/* Certificate */}
            <div className="fsec">Certificate</div>
            <div className="form-group full">
              <label>Hero Image</label>
              <div className={`upload-area${form.hero_img?' has-img':''}`} onClick={()=>fileRef.current.click()}>
                {form.hero_img && <img src={form.hero_img} className="upload-preview" style={{display:'block'}} alt=""/>}
                <div style={{fontSize:12,color:'var(--text3)'}}>
                  {uploading?'Uploading to Supabase Storage…':form.hero_img?'Click to change image':'Click to upload · JPG or PNG'}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} onChange={e=>handleImage(e.target.files[0])}/>
            </div>
            <div className="form-group full">
              <label>Batch Story</label>
              <textarea style={{minHeight:70}} value={form.story} onChange={e=>set('story',e.target.value)}/>
            </div>
            <div className="form-group full">
              <label>Flavour Notes | Roaster Note</label>
              <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Toasty | Sweet | Nuts | Cocoa | Mild acidity, creamy finish."/>
              <div className="form-hint">Pipe-separated icons, last segment = prose note on certificate</div>
            </div>

            <div className="fsec">Cup Profile (1–5)</div>
            {['acidity','body','sweetness'].map(k=>(
              <div className="form-group" key={k}>
                <label>{k.charAt(0).toUpperCase()+k.slice(1)}</label>
                <select value={form[k]} onChange={e=>set(k,e.target.value)}>
                  {SCORES.map(s=><option key={s} value={s}>{SCORE_LABELS[s]}</option>)}
                </select>
              </div>
            ))}

          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving?'Saving…':'Save Batch'}
          </button>
        </div>
      </div>
    </div>
  )
}
