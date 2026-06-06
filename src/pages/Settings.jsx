import { useState, useEffect } from 'react'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toast'

export default function Settings() {
  const { settings, saveSettings } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)

  useEffect(() => { setForm(settings) }, [settings])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const updates = {
      gas_rate: parseFloat(form.gas_rate)||0,
      elec_rate: parseFloat(form.elec_rate)||0,
      labour_rate: parseFloat(form.labour_rate)||0,
      default_hours: parseFloat(form.default_hours)||1.5,
      bag_250_cost: parseFloat(form.bag_250_cost)||0,
      bag_1kg_cost: parseFloat(form.bag_1kg_cost)||0,
      sticker_250_cost: parseFloat(form.sticker_250_cost)||0,
      sticker_1kg_cost: parseFloat(form.sticker_1kg_cost)||0,
      ws_markup: parseFloat(form.ws_markup)||0,
      rt_markup: parseFloat(form.rt_markup)||0,
      vat_rate: parseFloat(form.vat_rate)||15,
      roastery_name: form.roastery_name||'Specialty Roastery',
    }
    const { error } = await saveSettings(updates)
    if (error) { toast('Error: ' + error.message, true); return }
    toast('Settings saved')
  }

  return (
    <div className="page">
      <div className="page-hd">
        <div><div className="page-title">Settings</div><div className="page-sub">Global Defaults</div></div>
        <button className="btn btn-gold" onClick={handleSave}>Save Settings</button>
      </div>

      <div className="settings-section">
        <div className="settings-title">Roastery</div>
        <div className="settings-grid">
          <div className="form-group full">
            <label>Roastery name (for certificates)</label>
            <input value={form.roastery_name||''} onChange={e => set('roastery_name', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Operating Costs — Global Defaults</div>
        <div className="settings-grid">
          <div className="form-group"><label>Gas rate (R per kg roasted)</label><input type="number" step="0.01" value={form.gas_rate||''} onChange={e => set('gas_rate', e.target.value)} /></div>
          <div className="form-group"><label>Electricity rate (R per kg roasted)</label><input type="number" step="0.01" value={form.elec_rate||''} onChange={e => set('elec_rate', e.target.value)} /></div>
          <div className="form-group"><label>Labour rate (R per hour)</label><input type="number" step="1" value={form.labour_rate||''} onChange={e => set('labour_rate', e.target.value)} /></div>
          <div className="form-group"><label>Default labour hours per batch</label><input type="number" step="0.25" value={form.default_hours||''} onChange={e => set('default_hours', e.target.value)} /></div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Packaging Costs</div>
        <div className="settings-grid">
          <div className="form-group"><label>250g bag cost (R per bag)</label><input type="number" step="0.50" value={form.bag_250_cost||''} onChange={e => set('bag_250_cost', e.target.value)} /></div>
          <div className="form-group"><label>1kg bag cost (R per bag)</label><input type="number" step="0.50" value={form.bag_1kg_cost||''} onChange={e => set('bag_1kg_cost', e.target.value)} /></div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Branding Costs</div>
        <div className="settings-grid">
          <div className="form-group">
            <label>Sticker / label cost — 250g bag (R per bag)</label>
            <input type="number" step="0.50" value={form.sticker_250_cost||''} onChange={e => set('sticker_250_cost', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sticker / label cost — 1kg bag (R per bag)</label>
            <input type="number" step="0.50" value={form.sticker_1kg_cost||''} onChange={e => set('sticker_1kg_cost', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Pricing & Markup</div>
        <div className="settings-grid">
          <div className="form-group"><label>Wholesale markup % (on cost)</label><input type="number" step="1" value={form.ws_markup||''} onChange={e => set('ws_markup', e.target.value)} /></div>
          <div className="form-group"><label>Retail markup % (on wholesale)</label><input type="number" step="1" value={form.rt_markup||''} onChange={e => set('rt_markup', e.target.value)} /></div>
          <div className="form-group"><label>VAT rate %</label><input type="number" step="1" value={form.vat_rate||''} onChange={e => set('vat_rate', e.target.value)} /></div>
        </div>
      </div>
    </div>
  )
}
