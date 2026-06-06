import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Certificate from '../components/Certificate'
import { QRCodeSVG } from 'qrcode.react'

export default function CertPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const publicUrl = `${window.location.origin}/cert/${id}`

  useEffect(() => {
    supabase.from('roasts').select('*').eq('id', id).single()
      .then(({ data }) => { setBatch(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="page"><div className="loading">Loading certificate…</div></div>
  if (!batch) return <div className="page"><div className="empty">Batch not found</div></div>

  return (
    <div className="page">
      <div className="cert-toolbar">
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/batches')}>← Back</button>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>⬇ Print / PDF</button>
        <div className="cert-toolbar-title">Certificate — {id}</div>
      </div>

      <div className="cert-wrap">
        <Certificate batch={batch} />

        <div className="qr-block">
          <QRCodeSVG value={publicUrl} size={80} bgColor="transparent" fgColor="#c9a84c" />
          <div className="qr-url">{publicUrl}</div>
          <div style={{fontSize:10,color:'var(--text3)',marginTop:6}}>
            Shareable public certificate link — copy and send to customers
          </div>
        </div>
      </div>
    </div>
  )
}
