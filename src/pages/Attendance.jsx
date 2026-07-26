import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Attendance() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState([])
  const [statuses, setStatuses] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.from('classes').select('*').then(({ data }) => setClasses(data || []))
  }, [])

  useEffect(() => {
    if (!selectedClass) return
    supabase
      .from('students')
      .select('*')
      .eq('class_id', selectedClass)
      .then(({ data }) => {
        setStudents(data || [])
        const initial = {}
        ;(data || []).forEach((s) => (initial[s.id] = 'PRESENT'))
        setStatuses(initial)
      })
  }, [selectedClass])

  function setStatus(studentId, value) {
    setStatuses((prev) => ({ ...prev, [studentId]: value }))
  }

  async function saveAttendance() {
    setSaving(true)
    setMessage('')

    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', userData.user.id)
      .single()

    const rows = students.map((s) => ({
      school_id: profile.school_id,
      student_id: s.id,
      class_id: selectedClass,
      date: new Date().toISOString().slice(0, 10),
      status: statuses[s.id],
    }))

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,date' })

    setSaving(false)
    setMessage(error ? `Error: ${error.message}` : 'Attendance saved for today.')
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Mark Attendance — {new Date().toLocaleDateString()}</h2>

      <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
        <option value="">Select a class...</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.class_name}</option>
        ))}
      </select>

      {students.length > 0 && (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Student</th>
              <th style={{ borderBottom: '1px solid #ccc' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: '6px 0' }}>{s.full_name}</td>
                <td>
                  <select value={statuses[s.id]} onChange={(e) => setStatus(s.id, e.target.value)}>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LATE">Late</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {students.length > 0 && (
        <button onClick={saveAttendance} disabled={saving} style={{ marginTop: 16, padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      )}

      {message && <p style={{ marginTop: 12 }}>{message}</p>}

      {selectedClass && students.length === 0 && (
        <p style={{ marginTop: 20 }}>No students in this class yet. Add students first (Students page coming in a future phase update, or add them directly in Supabase's Table Editor for now).</p>
      )}
    </div>
  )
}
