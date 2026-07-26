import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const navigation = [
  ['OVERVIEW', [['/dashboard', '⌂', 'Dashboard']]],
  ['ACADEMIC', [['/manage?section=students', '♙', 'Students'], ['/manage?section=classes', '◫', 'Classes'], ['/manage?section=subjects', '◈', 'Subjects'], ['/manage?section=terms', '◷', 'Terms'], ['/results', '▤', 'Results'], ['/attendance', '✓', 'Attendance'], ['/timetable', '▦', 'Timetable']]],
  ['FINANCE', [['/payments', '₦', 'Payments']]],
  ['OPERATIONS', [['/documents', '▣', 'ID Cards & Certificates']]],
]

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [profile, setProfile] = useState(null)
  const navigate = useNavigate()
  useEffect(() => { supabase.from('profiles').select('full_name, role').single().then(({ data }) => setProfile(data)) }, [])
  async function logout() { await supabase.auth.signOut(); navigate('/') }
  return <div className={`portal-layout ${collapsed ? 'collapsed' : ''}`}>
    <aside className="portal-sidebar"><div className="portal-brand"><div className="brand-mark">▦</div>{!collapsed && <div><strong>School Portal</strong><small>Management Suite</small></div>}<button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '›' : '‹'}</button></div><nav className="portal-nav">{navigation.map(([title, links]) => <div key={title}><p className="nav-section">{title}</p>{links.map(([to, icon, label]) => <NavLink key={to} to={to} className="portal-nav-link"><span>{icon}</span>{!collapsed && label}</NavLink>)}</div>)}<p className="nav-section">PLATFORM</p><NavLink to="/developer" className="portal-nav-link developer-link"><span>◈</span>{!collapsed && 'Developer Console'}</NavLink></nav><div className="portal-user"><div className="avatar">{(profile?.full_name || 'U').slice(0, 1).toUpperCase()}</div>{!collapsed && <div className="user-copy"><strong>{profile?.full_name || 'Loading...'}</strong><small>{profile?.role || 'School user'}</small></div>}<button className="signout-button" onClick={logout} title="Log out">↪</button></div></aside>
    <main className="portal-main"><header className="portal-topbar"><button className="mobile-menu" onClick={() => setCollapsed(!collapsed)}>☰</button><div><small>School Management Platform</small><strong>Welcome back</strong></div><div className="topbar-actions"><span className="status-dot"></span><span>System online</span></div></header><div className="app-main">{children}</div></main>
  </div>
}
