import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ToastProvider } from './lib/toast'
import { SettingsProvider } from './lib/settings'
import { supabase } from './lib/supabase'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Batches from './pages/Batches'
import Greens from './pages/Greens'
import Packaging from './pages/Packaging'
import Products from './pages/Products'
import Formats from './pages/Formats'
import Suppliers from './pages/Suppliers'
import Customers from './pages/Customers'
import Sales from './pages/Sales'
import StockLedger from './pages/StockLedger'
import Costing from './pages/Costing'
import CertPage from './pages/CertPage'
import ProductRuns from './pages/ProductRuns'
import Settings from './pages/Settings'
import './index.css'

function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const handleSignOut = () => supabase.auth.signOut()
  return (
    <SettingsProvider>
      <ToastProvider>
        <div className="app">
          <button className="nav-toggle" onClick={()=>setSidebarOpen(o=>!o)} aria-label="Toggle menu">
            <span/><span/><span/>
          </button>
          <div className={`sidebar-backdrop${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)}/>
          <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} onSignOut={handleSignOut} />
          <div className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/batches" element={<Batches />} />
              <Route path="/greens" element={<Greens />} />
              <Route path="/packaging" element={<Packaging />} />
              <Route path="/products" element={<Products />} />
              <Route path="/formats" element={<Formats />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/customers" element={<Customers />} />
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
  )
}

function AppShell({ session }) {
  const location = useLocation()
  // Public certificate pages are accessible without login
  if (location.pathname.startsWith('/cert/')) {
    return (
      <Routes>
        <Route path="/cert/:id" element={<CertPage />} />
      </Routes>
    )
  }
  if (!session) return <LoginPage />
  return <AuthenticatedApp />
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="auth-loading">
        <div className="logo-mark">CoffeeOS</div>
        <div className="logo-sub" style={{ marginTop: 6 }}>Roastery Management</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppShell session={session} />
    </BrowserRouter>
  )
}
