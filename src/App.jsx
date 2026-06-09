import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import { ToastProvider } from './lib/toast'
import { SettingsProvider } from './lib/settings'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Batches from './pages/Batches'
import Greens from './pages/Greens'
import Packaging from './pages/Packaging'
import Products from './pages/Products'
import Formats from './pages/Formats'
import Suppliers from './pages/Suppliers'
import Sales from './pages/Sales'
import StockLedger from './pages/StockLedger'
import Costing from './pages/Costing'
import CertPage from './pages/CertPage'
import ProductRuns from './pages/ProductRuns'
import Settings from './pages/Settings'
import './index.css'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <div className="app">
            <button className="nav-toggle" onClick={()=>setSidebarOpen(o=>!o)} aria-label="Toggle menu">
              <span/><span/><span/>
            </button>
            <div className={`sidebar-backdrop${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)}/>
            <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} />
            <div className="main">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/batches" element={<Batches />} />
                <Route path="/greens" element={<Greens />} />
                <Route path="/packaging" element={<Packaging />} />
                <Route path="/products" element={<Products />} />
                <Route path="/formats" element={<Formats />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/ledger" element={<StockLedger />} />
                <Route path="/costing" element={<Costing />} />
                <Route path="/runs" element={<ProductRuns />} />
                <Route path="/cert/:id" element={<CertPage />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </div>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
