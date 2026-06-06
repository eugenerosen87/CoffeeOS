export const ROAST_NAMES = {
  cinnamon:'Cinnamon', city:'City', cityplus:'City+',
  fullcity:'Full City', fullcityplus:'Full City+',
  vienna:'Vienna', french:'French', italian:'Italian'
}
export const ROAST_POS = {
  cinnamon:4, city:15, cityplus:27, fullcity:42,
  fullcityplus:58, vienna:72, french:84, italian:94
}

// ── BATCH COSTING (single bean, one roast) ────────────────────────
// Returns cost per kg roasted for a single batch
export function calcBatchCost(batch, settings) {
  const n = v => { const p = parseFloat(v); return isNaN(p) ? 0 : p }
  const hasVal = v => v !== null && v !== '' && v !== undefined && !isNaN(parseFloat(v))

  const inputKg    = n(batch.input_kg)
  const outputKg   = n(batch.output_kg)
  const wasteKg    = n(batch.waste_kg)
  const availableKg = hasVal(batch.available_kg) ? n(batch.available_kg) : Math.max(0, outputKg - wasteKg)

  // ── Use snapped costs if available (historical cost locking) ──
  // snapped values are written at save time and never change
  const greenCostPerKg = hasVal(batch.snapped_green_cost) && inputKg > 0
    ? n(batch.snapped_green_cost) / inputKg
    : n(batch._current_price || 0)

  const gasRate   = hasVal(batch.snapped_gas_rate)    ? n(batch.snapped_gas_rate)    : n(settings.gas_rate)
  const elecRate  = hasVal(batch.snapped_elec_rate)   ? n(batch.snapped_elec_rate)   : n(settings.elec_rate)
  const labRate   = hasVal(batch.snapped_labour_rate) ? n(batch.snapped_labour_rate) : n(settings.labour_rate)

  const greenTotal  = inputKg * greenCostPerKg
  const labourHours = n(batch.labour_hours) || n(settings.default_hours) || 1.5
  const labourCost  = labourHours * labRate

  const gasIsOverride  = hasVal(batch.gas_cost)
  const elecIsOverride = hasVal(batch.electric_cost)
  const gasCost  = gasIsOverride  ? n(batch.gas_cost)      : outputKg * gasRate
  const elecCost = elecIsOverride ? n(batch.electric_cost) : outputKg * elecRate

  const roastCost   = greenTotal + gasCost + elecCost + labourCost
  // ── FIX: divide by AVAILABLE kg (output minus waste) not output kg
  // Waste kg cannot be sold — spreading cost over it artificially inflates margins
  const costPerKg   = availableKg > 0 ? roastCost / availableKg : 0
  const actualLoss  = inputKg  > 0 ? ((inputKg - outputKg) / inputKg * 100) : 0
  const wastePct    = outputKg > 0 ? (wasteKg / outputKg * 100) : 0

  // Flag if using snapped vs live rates (for UI display)
  const usingSnapped = hasVal(batch.snapped_gas_rate)

  return {
    inputKg, outputKg, wasteKg, availableKg,
    greenCostPerKg, greenTotal,
    labourHours, labourCost, labourRate: labRate,
    gasCost, elecCost, gasIsOverride, elecIsOverride,
    gasRate, elecRate,
    roastCost, costPerKg, actualLoss, wastePct,
    usingSnapped
  }
}

// ── PRODUCT COSTING (blend of batches → formats) ─────────────────
// recipe   : [{batch_id, percentage, batch: {cost per kg already calculated}}]
// formats  : format rows
// prices   : product_prices rows
// unitsPacked : {format_id: units} from a product_run
export function calcProductCost(recipe, formats, prices, settings, unitsPacked = {}) {
  const n = v => { const p = parseFloat(v); return isNaN(p) ? 0 : p }
  const vatMulti = 1 + n(settings.vat_rate) / 100
  const wsMulti  = 1 + n(settings.ws_markup) / 100

  // Weighted average cost per kg from recipe batches
  const weightedCostPerKg = recipe.reduce((sum, r) => {
    return sum + (n(r.percentage) / 100) * n(r._batchCostPerKg)
  }, 0)

  // Per format breakdown
  const formatBreakdown = formats.map(fmt => {
    const weightKg   = fmt.is_wholesale ? 1 : n(fmt.weight_g) / 1000
    const bagCost    = n(fmt.bag_cost)
    const stickerCost = n(fmt.sticker_cost)
    const coffeeCost = weightedCostPerKg * weightKg
    const unitCost   = fmt.is_wholesale ? weightedCostPerKg : coffeeCost + bagCost + stickerCost

    const recPrice    = unitCost * wsMulti
    const recPriceVat = recPrice * vatMulti
    const recMargin   = recPrice > 0 ? ((recPrice - unitCost) / recPrice * 100) : 0

    const priceRow  = prices.find(p => p.format_id === fmt.id)
    const yourPrice = priceRow?.price != null ? n(priceRow.price) : null
    const margin    = yourPrice ? ((yourPrice - unitCost) / yourPrice * 100) : null

    const units  = n(unitsPacked[fmt.id])
    const profit = yourPrice && units > 0 ? (yourPrice - unitCost) * units : null
    const packagingSpend = fmt.is_wholesale ? 0 : (bagCost + stickerCost) * units

    return {
      format: fmt, weightKg,
      coffeeCost, bagCost, stickerCost, unitCost,
      recPrice, recPriceVat, recMargin,
      yourPrice, margin, units, profit, packagingSpend
    }
  })

  const totalPackagingSpend = formatBreakdown.reduce((s,f) => s + f.packagingSpend, 0)
  const totalProfit = formatBreakdown.reduce((s,f) => s + (f.profit||0), 0)

  return {
    weightedCostPerKg, formatBreakdown,
    totalPackagingSpend, totalProfit,
    wsMarkup: n(settings.ws_markup), vatRate: n(settings.vat_rate)
  }
}

// ── FRESHNESS ENGINE ──────────────────────────────────────────────
export function getPeakWindow(isoDate, roastLevel, process) {
  const level = (roastLevel||'cityplus').toLowerCase()
  const proc  = (process||'washed').toLowerCase()
  let restEnd, peakStart, peakEnd
  if      (level==='cinnamon')     { restEnd=1; peakStart=3;  peakEnd=8  }
  else if (level==='city')         { restEnd=2; peakStart=4;  peakEnd=10 }
  else if (level==='cityplus')     { restEnd=3; peakStart=5;  peakEnd=12 }
  else if (level==='fullcity')     { restEnd=3; peakStart=6;  peakEnd=15 }
  else if (level==='fullcityplus') { restEnd=2; peakStart=5;  peakEnd=12 }
  else if (level==='vienna')       { restEnd=2; peakStart=3;  peakEnd=10 }
  else if (level==='french')       { restEnd=1; peakStart=3;  peakEnd=8  }
  else if (level==='italian')      { restEnd=1; peakStart=2;  peakEnd=7  }
  else                             { restEnd=3; peakStart=5;  peakEnd=14 }
  const off = proc==='natural'?1 : proc==='anaerobic'?2 : proc==='honey'?1 : 0
  peakStart+=off; peakEnd+=off
  const base=new Date(isoDate)
  const start=new Date(base); start.setDate(start.getDate()+peakStart)
  const end=new Date(base);   end.setDate(end.getDate()+peakEnd)
  return { peakStartDay:peakStart, peakEndDay:peakEnd, restEndDay:restEnd, start, end }
}

export function buildTimeline(isoDate, roastLevel, process) {
  const level=(roastLevel||'cityplus').toLowerCase()
  const proc=(process||'washed').toLowerCase()
  const off=proc==='natural'?1:proc==='anaerobic'?2:proc==='honey'?1:0
  let restEnd,peakStart,peakEnd,plateau
  if(level==='cinnamon')     {restEnd=1;peakStart=3; peakEnd=8; plateau=12}
  else if(level==='city')    {restEnd=2;peakStart=4; peakEnd=10;plateau=14}
  else if(level==='cityplus'){restEnd=3;peakStart=5; peakEnd=12;plateau=18}
  else if(level==='fullcity'){restEnd=3;peakStart=6; peakEnd=15;plateau=22}
  else if(level==='fullcityplus'){restEnd=2;peakStart=5;peakEnd=12;plateau=18}
  else if(level==='vienna')  {restEnd=2;peakStart=3; peakEnd=10;plateau=14}
  else if(level==='french')  {restEnd=1;peakStart=3; peakEnd=8; plateau=12}
  else if(level==='italian') {restEnd=1;peakStart=2; peakEnd=7; plateau=10}
  else                       {restEnd=3;peakStart=5; peakEnd=14;plateau=20}
  peakStart+=off;peakEnd+=off;plateau+=off
  const base=new Date(isoDate),days=plateau+8,pts=[]
  for(let i=0;i<=days;i++){
    let q; const d=new Date(base); d.setDate(d.getDate()+i)
    if(i<=restEnd)    q=8+(i/Math.max(restEnd,1))*30
    else if(i<=peakStart) q=38+((i-restEnd)/Math.max(peakStart-restEnd,1))*52
    else if(i<=peakEnd){const mid=(peakStart+peakEnd)/2,dist=Math.abs(i-mid)/Math.max((peakEnd-peakStart)/2,1);q=100-(dist*dist*6)}
    else if(i<=plateau)  q=93-((i-peakEnd)/Math.max(plateau-peakEnd,1))*20
    else q=73-((i-plateau)/14)*30
    pts.push({day:i,quality:Math.max(5,Math.min(100,Math.round(q))),date:`${d.getMonth()+1}/${d.getDate()}`})
  }
  return{points:pts,peakStartDay:peakStart,peakEndDay:peakEnd,restEndDay:restEnd}
}

export function parseFlavorParts(notesText) {
  const raw=(notesText||'').trim()
  if(!raw)return{icons:[],roasterNote:''}
  if(raw.includes('|')){
    const parts=raw.split('|').map(s=>s.trim()).filter(Boolean)
    if(parts.length===1)return{icons:[],roasterNote:parts[0]}
    return{icons:parts.slice(0,parts.length-1).slice(0,5),roasterNote:parts[parts.length-1]}
  }
  return{icons:[],roasterNote:raw}
}

export function fmtDate(iso){
  if(!iso)return'—'
  const d=new Date(iso)
  return isNaN(d)?iso:d.toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})
}
export function daysAgo(iso){
  if(!iso)return''
  const d=Math.floor((new Date()-new Date(iso))/86400000)
  return d===0?'Today':d===1?'1 day ago':`${d} days ago`
}
export function batchStatus(date){
  const d=Math.floor((new Date()-new Date(date))/86400000)
  if(d<5)return{cls:'badge-rest',label:'Resting'}
  if(d<=14)return{cls:'badge-peak',label:'Peak'}
  return{cls:'badge-done',label:'Past Peak'}
}
