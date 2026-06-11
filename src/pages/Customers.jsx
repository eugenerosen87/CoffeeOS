import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

const CUSTOMER_TYPES = [
  'individual',
  'corporate',
  'cafe',
  'restaurant',
  'wholesale',
  'online',
  'other'
]

const TYPE_BADGE = {
  individual: 'badge-ok',
  corporate:  'badge-rest',
  cafe:       'badge-low',
  wholesale:  'badge-rest',
  restaurant: 'badge-empty',
  online:     'badge-ok',
  other:      '',
}

const EMPTY = { name: '', contact_name: '', email: '', phone: '', type: 'individual', notes: '' }

// ── CUSTOMER FORM ────────────────────────────────────────────────
function CustomerForm({ open, customer, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const isEditing = !!customer

  useEffect(() => {
    if (!open) return
    setForm(customer ? { ...EMPTY, ...customer } : EMPTY)
  }, [open, customer])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Customer name required', true); return }
    setSaving(true)
    const payload = {
      name:         form.name.trim(),
      contact_name: form.contact_name,
      email:        form.email,
      phone:        form.phone,
      type:         form.type,
      notes:        form.notes,
    }
    const { error } = isEditing
      ? await supabase.from('customers').update(payload).eq('id', customer.id)
      : await supabase.from('customers').insert(payload)
    if (error) { toast('Error: ' + error.message, true); setSaving(false); return }
    toast(isEditing ? 'Customer updated' : 'Customer added')
    setSaving(false); onSaved(); onClose()
  }

  if (!open) return null
  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-hd">
          <div className="modal-title">{isEditing ? `Edit — ${customer.name}` : 'New Customer'}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fsec">Customer Details</div>
            <div className="form-group full">
              <label>Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Brew Lab Café" />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Contact Name</label>
              <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Payment terms, preferences, etc." />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Customer'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────
export default function Customers() {
  const [customers, setCustomers]   = useState([])
  const [salesStats, setSalesStats] = useState({}) // { customer_id: { count, revenue } }
  const [loading, setLoading]       = useState(true)
  const [formState, setFormState]   = useState({ open: false, customer: null })
  const [deleting, setDeleting]     = useState(null)
  const toast = useToast()

  const load = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('sales').select('customer_id, units_sold, price_per_unit').not('customer_id', 'is', null),
    ])
    setCustomers(c || [])
    const stats = {}
    s?.forEach(sale => {
      if (!stats[sale.customer_id]) stats[sale.customer_id] = { count: 0, revenue: 0 }
      stats[sale.customer_id].count++
      stats[sale.customer_id].revenue += (parseInt(sale.units_sold) || 0) * (parseFloat(sale.price_per_unit) || 0)
    })
    setSalesStats(stats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { toast('Error: ' + error.message, true); return }
    toast('Customer deleted'); setDeleting(null); load()
  }

  const totalRevenue = Object.values(salesStats).reduce((s, v) => s + v.revenue, 0)

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-sub">Manage your customer accounts</div>
        </div>
        <button className="btn btn-gold" onClick={() => setFormState({ open: true, customer: null })}>+ Add Customer</button>
      </div>

      <div className="stats-grid">
        {[
          ['Total Customers',  customers.length,                         ''],
          ['With Sales',       Object.keys(salesStats).length,           ''],
          ['Total Revenue',    'R ' + totalRevenue.toFixed(0),           ''],
        ].map(([l, v]) => (
          <div className="stat-card" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-val">{v}</div>
          </div>
        ))}
      </div>

      {loading && <div className="loading">Loading…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {customers.map(c => {
          const sc = salesStats[c.id]
          return (
            <div key={c.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: 'var(--bg3)', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, color: 'var(--text)' }}>{c.name}</div>
                    {c.contact_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.contact_name}</div>}
                  </div>
                  <span className={`badge ${TYPE_BADGE[c.type] || ''}`}>{c.type}</span>
                </div>
              </div>

              {/* Details */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                {c.email && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 50, fontSize: 11 }}>Email</span>
                    <a href={`mailto:${c.email}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{c.email}</a>
                  </div>
                )}
                {c.phone && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 50, fontSize: 11 }}>Phone</span>
                    <span style={{ color: 'var(--text)' }}>{c.phone}</span>
                  </div>
                )}
                {sc ? (
                  <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 50, fontSize: 11 }}>Sales</span>
                    <span style={{ color: 'var(--green2)' }}>{sc.count} line{sc.count !== 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>· R{sc.revenue.toFixed(0)} revenue</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>No sales recorded yet</div>
                )}
              </div>

              {c.notes && (
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                  {c.notes}
                </div>
              )}

              {/* Actions */}
              <div style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
                <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={() => setFormState({ open: true, customer: c })}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleting(c)}>Del</button>
              </div>
            </div>
          )
        })}
        {!loading && !customers.length && (
          <div style={{ gridColumn: '1/-1' }}>
            <div className="empty">
              <div className="empty-icon">◈</div>
              No customers yet — add your first account
            </div>
          </div>
        )}
      </div>

      <CustomerForm
        open={formState.open} customer={formState.customer}
        onClose={() => setFormState({ open: false, customer: null })} onSaved={load}
      />

      {deleting && (
        <div className="overlay open" onClick={e => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-hd"><div className="modal-title">Delete Customer</div></div>
            <div className="modal-body" style={{ textAlign: 'center', padding: 28 }}>
              <p style={{ color: 'var(--text2)', marginBottom: 20, lineHeight: 1.7 }}>
                Delete <strong style={{ color: 'var(--text)' }}>{deleting.name}</strong>?<br />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sales linked to this customer will be kept but unlinked.</span>
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => setDeleting(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleting.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
