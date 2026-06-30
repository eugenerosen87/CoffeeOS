import { NavLink } from 'react-router-dom'
import { useSettings } from '../lib/settings'

export default function Sidebar({ open, onClose, onSignOut }) {
  const { settings } = useSettings()
  return (
    <div className={`sidebar${open?' open':''}`}>
      <div className="logo">
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
          <div>
            <div className="logo-mark">CoffeeOS</div>
            <div className="logo-sub">Roastery Management</div>
          </div>
          <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:16,lineHeight:1}} onClick={onClose} aria-label="Close menu">✕</button>
        </div>
      </div>
      <nav className="nav" onClick={onClose}>
        <div className="nav-section">Overview</div>
        <NavLink to="/" end className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">⬡</span> Dashboard</NavLink>

        <div className="nav-section">Production</div>
        <NavLink to="/batches" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◎</span> Roast Batches</NavLink>
        <NavLink to="/greens" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◈</span> Green Inventory</NavLink>
        <NavLink to="/suppliers" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◫</span> Suppliers</NavLink>
        <NavLink to="/packaging" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◱</span> Packaging</NavLink>

        <div className="nav-section">Products & Pricing</div>
        <NavLink to="/products" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◉</span> Products</NavLink>
        <NavLink to="/formats" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◧</span> Formats</NavLink>        <NavLink to="/runs" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◐</span> Product Runs</NavLink>
        <NavLink to="/pricelist" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">▦</span> Price List</NavLink>
        <div className="nav-section">Sales & Finance</div>
        <NavLink to="/sales" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◆</span> Sales</NavLink>
        <NavLink to="/customers" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◑</span> Customers</NavLink>
        <NavLink to="/costing" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◇</span> Costing</NavLink>
        <NavLink to="/ledger" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◰</span> Stock Ledger</NavLink>

        <div className="nav-section">Config</div>
        <NavLink to="/settings" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon">◻</span> Settings</NavLink>
      </nav>
      <div className="sidebar-bottom">
        Gas: <span>R{Number(settings.gas_rate||0).toFixed(2)}/kg</span><br/>
        Elec: <span>R{Number(settings.elec_rate||0).toFixed(2)}/kg</span><br/>
        Labour: <span>R{Number(settings.labour_rate||0).toFixed(0)}/hr</span>
        <button className="btn btn-ghost btn-signout" onClick={onSignOut} title="Sign out">
          ⏻ Sign Out
        </button>
      </div>
    </div>
  )
}
