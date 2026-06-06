import { useEffect, useRef } from 'react'
import { buildTimeline } from '../lib/coffee'

export default function TimelineSvg({ batch }) {
  const ref = useRef()

  useEffect(() => {
    if (!ref.current || !batch?.date) return
    const svg = ref.current
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const tl = buildTimeline(batch.date, batch.roast_level, batch.process)
    const pts = tl.points
    const quality = pts.map(p => p.quality)
    const peakDay = quality.indexOf(Math.max(...quality))
    const W = 780, PAD = { l:70, r:16, t:52, b:0 }, cW = W-PAD.l-PAD.r, cH = 110
    const DAYS = pts.length - 1
    const dn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const roastDate = new Date(batch.date)

    const xOf = i => PAD.l + (i/DAYS)*cW
    const yOf = q => PAD.t + cH - (Math.max(0,Math.min(100,q))/100)*cH
    const dayDate = n => { const d=new Date(roastDate); d.setDate(d.getDate()+n); return d }
    const fmt = d => `${dn[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`

    const el = (tag, attrs, txt) => {
      const e = document.createElementNS('http://www.w3.org/2000/svg', tag)
      Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v))
      if (txt !== undefined) e.textContent = txt
      return e
    }

    const defs = el('defs',{})
    const pf = el('linearGradient',{id:'pf',x1:'0',y1:'0',x2:'0',y2:'1'})
    pf.appendChild(el('stop',{'offset':'0%','stop-color':'#2c4a2e','stop-opacity':'0.10'}))
    pf.appendChild(el('stop',{'offset':'100%','stop-color':'#2c4a2e','stop-opacity':'0.01'}))
    defs.appendChild(pf)
    const pSp = (tl.peakStartDay/DAYS*100).toFixed(1)
    const pEp = (tl.peakEndDay/DAYS*100).toFixed(1)
    const lg = el('linearGradient',{id:'lg',x1:'0',y1:'0',x2:'1',y2:'0'})
    ;[['0%','#c9b89a'],[(parseFloat(pSp)-1)+'%','#b0a080'],[pSp+'%','#2c4a2e'],[pEp+'%','#1e3d20'],[(parseFloat(pEp)+1)+'%','#c07030'],['100%','#903010']]
      .forEach(([o,c]) => lg.appendChild(el('stop',{'offset':o,'stop-color':c})))
    defs.appendChild(lg)
    const ag = el('linearGradient',{id:'ag',x1:'0',y1:'0',x2:'0',y2:'1'})
    ag.appendChild(el('stop',{'offset':'0%','stop-color':'#2c4a2e','stop-opacity':'0.06'}))
    ag.appendChild(el('stop',{'offset':'100%','stop-color':'#2c4a2e','stop-opacity':'0'}))
    defs.appendChild(ag)
    svg.appendChild(defs)

    ;[50,100].forEach(q => svg.appendChild(el('line',{x1:PAD.l,y1:yOf(q),x2:W-PAD.r,y2:yOf(q),stroke:'#e8dfc8','stroke-width':'0.5'})))
    svg.appendChild(el('rect',{x:xOf(tl.peakStartDay),y:PAD.t,width:xOf(tl.peakEndDay)-xOf(tl.peakStartDay),height:cH,fill:'url(#pf)'}))
    svg.appendChild(el('line',{x1:xOf(tl.peakStartDay),y1:PAD.t,x2:xOf(tl.peakStartDay),y2:PAD.t+cH,stroke:'#2c4a2e','stroke-width':'0.5','stroke-dasharray':'4,4'}))
    svg.appendChild(el('line',{x1:xOf(tl.peakEndDay),y1:PAD.t,x2:xOf(tl.peakEndDay),y2:PAD.t+cH,stroke:'#2c4a2e','stroke-width':'0.5','stroke-dasharray':'4,4'}))

    ;[{q:100,l:'Peak'},{q:50,l:'Good'}].forEach(({q,l}) =>
      svg.appendChild(el('text',{x:PAD.l-6,y:yOf(q)+4,'text-anchor':'end','font-family':'DM Sans,sans-serif','font-size':'9','fill':'#b0a080'},l)))

    let path = `M${xOf(0)},${yOf(quality[0])}`
    for (let i=0;i<pts.length-1;i++) {
      const p0=quality[Math.max(i-1,0)],p1=quality[i],p2=quality[i+1],p3=quality[Math.min(i+2,pts.length-1)]
      const t=0.4
      const cp1x=xOf(i)+(xOf(i+1)-xOf(Math.max(i-1,0)))*t/2, cp1y=yOf(p1)+(yOf(p2)-yOf(p0))*t/2
      const cp2x=xOf(i+1)-(xOf(Math.min(i+2,pts.length-1))-xOf(i))*t/2, cp2y=yOf(p2)-(yOf(p3)-yOf(p1))*t/2
      path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${xOf(i+1).toFixed(1)},${yOf(p2).toFixed(1)}`
    }
    svg.appendChild(el('path',{d:path+` L${xOf(DAYS)},${PAD.t+cH} L${xOf(0)},${PAD.t+cH} Z`,fill:'url(#ag)',stroke:'none'}))
    svg.appendChild(el('path',{d:path,fill:'none',stroke:'url(#lg)','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round'}))

    ;[...new Set([0,tl.peakStartDay,peakDay,tl.peakEndDay])].filter(v => v>=0&&v<=DAYS).forEach(i => {
      const q=quality[i],col=i===0?'#c9a227':i===peakDay?'#1e3d20':'#2c4a2e',r=i===peakDay?6:4
      svg.appendChild(el('circle',{cx:xOf(i),cy:yOf(q),r:r+2,fill:'#faf6ee'}))
      svg.appendChild(el('circle',{cx:xOf(i),cy:yOf(q),r,fill:col}))
    })

    const peakMaxQ=Math.max(...quality), peakIdx=quality.indexOf(peakMaxQ)
    const bW=170,bH=28; let bX=xOf(peakIdx)-bW/2, bY=yOf(peakMaxQ)-bH-12
    if(bX<PAD.l)bX=PAD.l; if(bX+bW>W-PAD.r)bX=W-PAD.r-bW
    svg.appendChild(el('rect',{x:bX,y:bY,width:bW,height:bH,fill:'#faf6ee',stroke:'#c9a227','stroke-width':'1',rx:'1'}))
    svg.appendChild(el('text',{x:xOf(peakIdx),y:bY+11,'text-anchor':'middle','font-family':'DM Sans,sans-serif','font-size':'7','font-weight':'600','fill':'#2c4a2e','letter-spacing':'2'},'OPTIMAL WINDOW'))
    svg.appendChild(el('text',{x:xOf(peakIdx),y:bY+22,'text-anchor':'middle','font-family':'DM Sans,sans-serif','font-size':'8','fill':'#4a6a3a'},`${fmt(dayDate(tl.peakStartDay))} – ${fmt(dayDate(tl.peakEndDay))}`))

    const axY = PAD.t + cH
    const showDays = [...new Set([0,tl.restEndDay,tl.peakStartDay,peakIdx,tl.peakEndDay,DAYS])].filter(v=>v>=0&&v<=DAYS).sort((a,b)=>a-b)
    let lastX = -999
    showDays.forEach(i => {
      const x=xOf(i); if(i!==0&&i!==DAYS&&(x-lastX)<50)return; lastX=x
      const d2=dayDate(i), col=i>=tl.peakStartDay&&i<=tl.peakEndDay?'#1e3d20':i===0?'#c9a227':'#b0a080'
      svg.appendChild(el('line',{x1:x,y1:axY,x2:x,y2:axY+4,stroke:col,'stroke-width':'1'}))
      svg.appendChild(el('text',{x,y:axY+13,'text-anchor':'middle','font-family':'DM Sans,sans-serif','font-size':'8','font-weight':'700','fill':col},`Day ${i}`))
      svg.appendChild(el('text',{x,y:axY+23,'text-anchor':'middle','font-family':'DM Sans,sans-serif','font-size':'7','fill':'#b0a080'},fmt(d2)))
    })

    const brY = axY + 34
    ;[{from:0,to:tl.peakStartDay,col:'#b0a898',label:'Resting'},{from:tl.peakStartDay,to:tl.peakEndDay,col:'#2c4a2e',label:'Peak Window'},{from:tl.peakEndDay,to:DAYS,col:'#c07030',label:'Enjoy Soon'}]
      .forEach(({from,to,col,label}) => {
        const x1=xOf(from),x2=xOf(to),mid=(x1+x2)/2; if(x2-x1<20)return
        svg.appendChild(el('line',{x1,y1:brY,x2,y2:brY,stroke:col,'stroke-width':'1'}))
        svg.appendChild(el('line',{x1,y1:brY-3,x2:x1,y2:brY+3,stroke:col,'stroke-width':'1'}))
        svg.appendChild(el('line',{x1:x2,y1:brY-3,x2,y2:brY+3,stroke:col,'stroke-width':'1'}))
        svg.appendChild(el('text',{x:mid,y:brY+12,'text-anchor':'middle','font-family':'DM Sans,sans-serif','font-size':'7.5','font-weight':'600','fill':col,'letter-spacing':'1.5'},label))
      })

    svg.setAttribute('viewBox', `0 0 ${W} ${brY+20}`)
  }, [batch])

  return <svg ref={ref} width="100%" xmlns="http://www.w3.org/2000/svg" style={{display:'block',marginTop:6}} />
}
