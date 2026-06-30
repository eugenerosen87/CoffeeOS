import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? null : n
}

export default function PriceList() {
  const [products, setProducts] = useState([])
  const [formats, setFormats] = useState([])
  const [priceMap, setPriceMap] = useState({})
  const [draftMap, setDraftMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const toast = useToast()

  const cellKey = (productId, formatId) => `${productId}::${formatId}`

  const load = async () => {
    setLoading(true)
    const [{ data: productRows, error: productErr }, { data: formatRows, error: formatErr }, { data: priceRows, error: priceErr }] = await Promise.all([
      supabase.from('products').select('id,name,product_type,archived').order('name'),
      supabase.from('formats').select('id,name,sort_order,active,is_wholesale').order('sort_order'),
      supabase.from('product_prices').select('product_id,format_id,price'),
    ])

    if (productErr || formatErr || priceErr) {
      toast(`Failed to load price list: ${(productErr || formatErr || priceErr).message}`, true)
      setLoading(false)
      return
    }

    const nextMap = {}
    for (const row of priceRows || []) {
      nextMap[cellKey(row.product_id, row.format_id)] = parseNum(row.price)
    }

    setProducts(productRows || [])
    setFormats((formatRows || []).filter((f) => f.active))
    setPriceMap(nextMap)
    setDraftMap({})
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const normalizedSearch = search.trim().toLowerCase()
  const visibleProducts = useMemo(() => {
    return (products || []).filter((p) => {
      if (!showArchived && p.archived) return false
      if (!normalizedSearch) return true
      return (p.name || '').toLowerCase().includes(normalizedSearch)
    })
  }, [products, showArchived, normalizedSearch])

  const getBaseValue = (productId, formatId) => {
    const key = cellKey(productId, formatId)
    return priceMap[key] ?? null
  }

  const getDisplayValue = (productId, formatId) => {
    const key = cellKey(productId, formatId)
    if (Object.prototype.hasOwnProperty.call(draftMap, key)) return draftMap[key]
    const base = getBaseValue(productId, formatId)
    return base == null ? '' : String(base)
  }

  const changedKeys = useMemo(() => {
    return Object.keys(draftMap).filter((key) => {
      const draft = parseNum(draftMap[key])
      const base = priceMap[key] ?? null
      return draft !== base
    })
  }, [draftMap, priceMap])

  const coverage = useMemo(() => {
    const productIds = new Set(visibleProducts.map((p) => p.id))
    const totalCells = visibleProducts.length * formats.length
    let pricedCells = 0
    for (const [key, value] of Object.entries(priceMap)) {
      if (value == null) continue
      const productId = key.split('::')[0]
      if (productIds.has(productId)) pricedCells += 1
    }
    return { totalCells, pricedCells }
  }, [visibleProducts, formats, priceMap])

  const setDraft = (productId, formatId, value) => {
    const key = cellKey(productId, formatId)
    setDraftMap((prev) => ({ ...prev, [key]: value }))
  }

  const resetChanges = () => setDraftMap({})

  const saveChanges = async () => {
    if (!changedKeys.length) return
    setSaving(true)

    const nextMap = { ...priceMap }
    const errors = []

    for (const key of changedKeys) {
      const [product_id, format_id] = key.split('::')
      const nextValue = parseNum(draftMap[key])

      if (nextValue == null) {
        const { error } = await supabase
          .from('product_prices')
          .delete()
          .eq('product_id', product_id)
          .eq('format_id', format_id)
        if (error) {
          errors.push(error.message)
          continue
        }
        delete nextMap[key]
      } else {
        const { error } = await supabase
          .from('product_prices')
          .upsert({ product_id, format_id, price: nextValue }, { onConflict: 'product_id,format_id' })
        if (error) {
          errors.push(error.message)
          continue
        }
        nextMap[key] = nextValue
      }
    }

    if (errors.length) {
      toast(`Some prices could not be saved: ${errors[0]}`, true)
    } else {
      toast(`Saved ${changedKeys.length} price change${changedKeys.length === 1 ? '' : 's'}`)
    }

    setPriceMap(nextMap)
    setDraftMap((prev) => {
      const copy = { ...prev }
      for (const key of changedKeys) delete copy[key]
      return copy
    })
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <div className="page-title">Price List</div>
          <div className="page-sub">All product prices in one editable grid</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={resetChanges} disabled={!changedKeys.length || saving}>Reset</button>
          <button className="btn btn-gold" onClick={saveChanges} disabled={!changedKeys.length || saving}>
            {saving ? 'Saving...' : `Save Changes (${changedKeys.length})`}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Products shown</div>
          <div className="stat-val">{visibleProducts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active formats</div>
          <div className="stat-val">{formats.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Prices set</div>
          <div className="stat-val">{coverage.pricedCells}</div>
          <div className="stat-sub">of {coverage.totalCells || 0} visible cells</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product name"
          style={{ width: 260 }}
        />
        <button className={`btn btn-sm ${showArchived ? 'btn-outline' : 'btn-ghost'}`} onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Type</th>
              {formats.map((fmt) => (
                <th key={fmt.id}>{fmt.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={2 + formats.length}>
                  <div className="loading">Loading...</div>
                </td>
              </tr>
            )}

            {!loading && !visibleProducts.length && (
              <tr>
                <td colSpan={2 + formats.length}>
                  <div className="empty">
                    <div className="empty-icon">%</div>
                    No products match this filter
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{product.name}</td>
                  <td>
                    <span className={`badge ${product.product_type === 'blend' ? 'badge-peak' : 'badge-rest'}`}>
                      {product.product_type === 'blend' ? 'Blend' : 'Single Origin'}
                    </span>
                  </td>
                  {formats.map((fmt) => {
                    const key = cellKey(product.id, fmt.id)
                    const nextValue = parseNum(draftMap[key])
                    const baseValue = getBaseValue(product.id, fmt.id)
                    const isChanged = Object.prototype.hasOwnProperty.call(draftMap, key) && nextValue !== baseValue
                    return (
                      <td key={fmt.id}>
                        <div style={{ position: 'relative', minWidth: 120 }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 11 }}>R</span>
                          <input
                            type="number"
                            step="0.01"
                            value={getDisplayValue(product.id, fmt.id)}
                            onChange={(e) => setDraft(product.id, fmt.id, e.target.value)}
                            style={{
                              paddingLeft: 22,
                              borderColor: isChanged ? 'var(--gold)' : undefined,
                              background: isChanged ? 'rgba(201,168,76,.08)' : undefined,
                            }}
                            placeholder="-"
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}