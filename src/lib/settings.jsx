import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const SettingsContext = createContext(null)

const DEFAULT_SETTINGS = {
  gas_rate: 0.80, elec_rate: 0.60, labour_rate: 120, default_hours: 1.5,
  bag_250_cost: 8.00, bag_1kg_cost: 22.00,
  sticker_250_cost: 3.00, sticker_1kg_cost: 3.00,
  ws_markup: 40, rt_markup: 40, vat_rate: 15,
  roastery_name: 'Specialty Roastery'
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => {
        if (data) setSettings(s => ({ ...s, ...data }))
        setLoading(false)
      })
  }, [])

  const saveSettings = async (updates) => {
    const { error } = await supabase.from('settings')
      .upsert({ id: 1, ...updates, updated_at: new Date().toISOString() })
    if (!error) setSettings(s => ({ ...s, ...updates }))
    return { error }
  }

  return (
    <SettingsContext.Provider value={{ settings, saveSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
