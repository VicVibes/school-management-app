import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Signup from './pages/Signup'
import Attendance from './pages/Attendance'
import Results from './pages/Results'
import ReportCard from './pages/ReportCard'
import SchoolData from './pages/SchoolData'
import Timetable from './pages/Timetable'
import Documents from './pages/Documents'
import DeveloperConsole from './pages/DeveloperConsole'
import AppShell from './components/AppShell'
import Payments from './pages/Payments'


function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [access, setAccess] = useState({ checking: true, blocked: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setAccess((current) => ({ ...current, checking: false })); return }
    async function verifyAccess() {
      setAccess({ checking: true, blocked: false })
      const { data: profile } = await supabase.from('profiles').select('school_id, role').single()
      if (!profile) { await supabase.auth.signOut(); setAccess({ checking: false, blocked: true }); return }
      if (profile.role === 'SUPER_ADMIN') { setAccess({ checking: false, blocked: false }); return }
      const { data: school } = await supabase.from('schools').select('status').eq('id', profile.school_id).single()
      if (school?.status !== 'ACTIVE') { await supabase.auth.signOut(); setAccess({ checking: false, blocked: true }); return }
      setAccess({ checking: false, blocked: false })
    }
    verifyAccess()
  }, [session])

  if (checking || access.checking) return <p style={{ padding: 40 }}>Loading...</p>
  if (access.blocked) return <div style={{ maxWidth: 460, margin: '100px auto', padding: 28, textAlign: 'center', background: '#fff', borderRadius: 14 }}><h2>School access is paused</h2><p>Your school account is currently suspended. Please contact the platform administrator to restore access.</p></div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={session ? <AppShell><Dashboard /></AppShell> : <Navigate to="/" />} />
        <Route path="/signup" element={session ? <Navigate to="/dashboard" /> : <Signup />} />
        <Route path="/attendance" element={session ? <AppShell><Attendance /></AppShell> : <Navigate to="/" />} />
        <Route path="/results" element={session ? <AppShell><Results /></AppShell> : <Navigate to="/" />} />
        <Route path="/report-card/:studentId" element={session ? <AppShell><ReportCard /></AppShell> : <Navigate to="/" />} />
        <Route path="/manage" element={session ? <AppShell><SchoolData /></AppShell> : <Navigate to="/" />} />
        <Route path="/timetable" element={session ? <AppShell><Timetable /></AppShell> : <Navigate to="/" />} />
        <Route path="/documents" element={session ? <AppShell><Documents /></AppShell> : <Navigate to="/" />} />
        <Route path="/developer" element={session ? <AppShell><DeveloperConsole /></AppShell> : <Navigate to="/" />} />
        <Route path="/payments" element={session ? <AppShell><Payments /></AppShell> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
