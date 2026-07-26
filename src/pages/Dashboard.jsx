import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'


export default function Dashboard() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: classData } = await supabase.from('classes').select('*')
    const { data: studentData } = await supabase.from('students').select('*')
    const { data: paymentData } = await supabase.from('payments').select('*')

    setClasses(classData || [])
    setStudents(studentData || [])
    setPayments(paymentData || [])
    setLoading(false)
  }

  if (loading) return <p style={{ padding: 40 }}>Loading your school data...</p>

  return (
    <div className="dashboard-page">
      <div className="page-header"><div><p className="eyebrow">OVERVIEW</p><h2>School Dashboard</h2><p>See a clear snapshot of your school today.</p></div><a className="primary-action" href="/manage">+ Add school data</a></div>
      <div className="stat-grid"><Stat label="Classes" value={classes.length} icon="◫" color="accent" /><Stat label="Students" value={students.length} icon="♙" color="ok" /><Stat label="Payments" value={payments.length} icon="₦" color="info" /></div>

      <h3>Classes ({classes.length})</h3>
      {classes.length === 0 ? <p>No classes yet.</p> : (
        <ul>
          {classes.map((c) => (
            <li key={c.id}>{c.class_name} — Fee: {c.class_fee}</li>
          ))}
        </ul>
      )}

      <h3>Students ({students.length})</h3>
      {students.length === 0 ? <p>No students yet.</p> : (
        <ul>
          {students.map((s) => (
            <li key={s.id}>
              {s.full_name} — Balance: {s.balance} — Stage: {s.debt_stage}
              {' '}<a href={`/report-card/${s.id}`}>View Report Card</a>
            </li>
          ))}
        </ul>
      )}

      <h3>Payments ({payments.length})</h3>
      {payments.length === 0 ? <p>No payments recorded yet.</p> : (
        <ul>
          {payments.map((p) => (
            <li key={p.id}>Amount: {p.amount} — Mode: {p.mode}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, icon, color }) { return <div className={`portal-stat ${color}`}><span className="stat-icon">{icon}</span><small>{label}</small><strong>{value}</strong><em>Current total</em></div> }
