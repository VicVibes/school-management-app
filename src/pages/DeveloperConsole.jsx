import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const featureLabels = { whatsapp_enabled: 'WhatsApp', sms_enabled: 'SMS', cbt_enabled: 'CBT', timetable_enabled: 'Timetable' }

export default function DeveloperConsole() {
  const [schools, setSchools] = useState([])
  const [settings, setSettings] = useState({})
  const [studentCounts, setStudentCounts] = useState({})
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('role').single()
    if (profile?.role !== 'SUPER_ADMIN') { setMessage('Only the developer Super Admin can open this page.'); setLoading(false); return }
    setAllowed(true)
    const [schoolResult, settingResult, studentResult] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('school_settings').select('*'),
      supabase.from('students').select('school_id'),
    ])
    const counts = {}; (studentResult.data || []).forEach((item) => { counts[item.school_id] = (counts[item.school_id] || 0) + 1 })
    const settingMap = {}; (settingResult.data || []).forEach((item) => { settingMap[item.school_id] = item })
    setSchools(schoolResult.data || []); setSettings(settingMap); setStudentCounts(counts); setLoading(false)
  }
  async function saveSchool(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const row = { plan: form.get('plan'), max_students: Number(form.get('max_students')), status: form.get('status') }
    const { error } = await supabase.from('schools').update(row).eq('id', selected.id)
    setMessage(error ? `Error: ${error.message}` : `${selected.name} updated.`); if (!error) { setSelected(null); load() }
  }
  async function toggleFeature(schoolId, key, value) {
    const { error } = await supabase.from('school_settings').update({ [key]: value }).eq('school_id', schoolId)
    setMessage(error ? `Error: ${error.message}` : `${featureLabels[key]} ${value ? 'enabled' : 'disabled'}.`); if (!error) load()
  }
  async function changeStatus(school) {
    const next = school.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const action = next === 'SUSPENDED' ? 'revoke access from' : 'restore access to'
    if (!window.confirm(`Do you want to ${action} ${school.name}?`)) return
    const { error } = await supabase.from('schools').update({ status: next }).eq('id', school.id)
    setMessage(error ? `Error: ${error.message}` : `${school.name} is now ${next}.`); if (!error) load()
  }
  if (loading) return <p style={{ padding: 40 }}>Loading developer console...</p>
  if (!allowed) return <div style={{ maxWidth: 600, margin: '80px auto', padding: 24 }}><h2>Access restricted</h2><p>{message}</p><p><Link to="/dashboard">Return to dashboard</Link></p></div>
  const active = schools.filter((school) => school.status === 'ACTIVE').length
  return <div style={{ maxWidth: 1200, margin: '32px auto', padding: 22 }}>
    <div style={{ background: '#1a1917', borderRadius: 16, padding: 28, color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><small style={{ color: '#e8a93a', fontWeight: 700, letterSpacing: 1 }}>DEVELOPER CONTROL CENTER</small><h2 style={{ color: '#fff', marginTop: 6 }}>School Management SaaS</h2><p style={{ color: '#c8c4bd' }}>Manage access, plans, capacity, and paid features across every school.</p></div><Link to="/dashboard" style={{ alignSelf: 'center', color: '#fff', border: '1px solid #5a564e', borderRadius: 8, padding: '9px 13px' }}>School dashboard</Link></div>
    {message && <p style={{ color: message.startsWith('Error:') ? '#b91c1c' : '#15803d', margin: '16px 0', fontWeight: 600 }}>{message}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, margin: '20px 0' }}><Stat label="All schools" value={schools.length} color="#c9922a" /><Stat label="Active schools" value={active} color="#16a34a" /><Stat label="Suspended" value={schools.length - active} color="#dc2626" /><Stat label="All students" value={Object.values(studentCounts).reduce((a, b) => a + b, 0)} color="#2563eb" /></div>
    <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e0d8', borderRadius: 12 }}><table style={{ minWidth: 850 }}><thead><tr><th>School</th><th>Status</th><th>Plan</th><th>Students</th><th>Enabled features</th><th>Actions</th></tr></thead><tbody>{schools.map((school) => { const schoolSettings = settings[school.id] || {}; return <tr key={school.id}><td><strong>{school.name}</strong><br /><small style={{ color: '#8a8780' }}>Joined {new Date(school.created_at).toLocaleDateString()}</small></td><td><span style={{ background: school.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: school.status === 'ACTIVE' ? '#15803d' : '#b91c1c', padding: '4px 9px', borderRadius: 20, fontWeight: 700, fontSize: 11 }}>{school.status}</span></td><td>{school.plan}</td><td>{studentCounts[school.id] || 0} / {school.max_students}</td><td>{Object.entries(featureLabels).map(([key, label]) => <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 9, fontSize: 12 }}><input type="checkbox" checked={Boolean(schoolSettings[key])} onChange={(e) => toggleFeature(school.id, key, e.target.checked)} />{label}</label>)}</td><td><button onClick={() => setSelected(school)} style={{ background: '#f3f0e8', color: '#80601b' }}>Manage</button><button onClick={() => changeStatus(school)} style={{ background: school.status === 'ACTIVE' ? '#fee2e2' : '#dcfce7', color: school.status === 'ACTIVE' ? '#b91c1c' : '#15803d' }}>{school.status === 'ACTIVE' ? 'Revoke access' : 'Restore access'}</button></td></tr> })}</tbody></table></div>
    {selected && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', padding: 18, zIndex: 20 }}><form onSubmit={saveSchool} style={{ width: '100%', maxWidth: 440, background: '#fff', padding: 24, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}><h3>Manage {selected.name}</h3><label style={{ display: 'block', marginTop: 14 }}>Access status<select name="status" defaultValue={selected.status} style={{ display: 'block', width: '100%', padding: 9, marginTop: 5 }}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label><label style={{ display: 'block', marginTop: 14 }}>Plan<select name="plan" defaultValue={selected.plan} style={{ display: 'block', width: '100%', padding: 9, marginTop: 5 }}><option value="FREE">Free</option><option value="PAID">Paid</option></select></label><label style={{ display: 'block', marginTop: 14 }}>Student limit<input name="max_students" type="number" min="1" defaultValue={selected.max_students} style={{ display: 'block', width: '100%', padding: 9, marginTop: 5 }} /></label><div style={{ marginTop: 20, textAlign: 'right' }}><button type="button" onClick={() => setSelected(null)} style={{ background: '#f3f4f6', color: '#334155' }}>Cancel</button><button>Save changes</button></div></form></div>}
  </div>
}

function Stat({ label, value, color }) { return <div style={{ background: '#fff', border: '1px solid #e2e0d8', borderTop: `3px solid ${color}`, borderRadius: 10, padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,.04)' }}><small style={{ color: '#8a8780', textTransform: 'uppercase', fontWeight: 700, letterSpacing: .7 }}>{label}</small><div style={{ fontSize: 30, fontWeight: 750, marginTop: 5 }}>{value}</div></div> }
