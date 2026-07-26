import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Results() {
  const [classes, setClasses] = useState([])
  const [terms, setTerms] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [students, setStudents] = useState([])
  const [schoolId, setSchoolId] = useState(null)
  const [scores, setScores] = useState({})
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { init() }, [])
  useEffect(() => { if (selectedClass) loadStudents() }, [selectedClass, selectedTerm, selectedSubject])

  async function init() {
    const { data: profile } = await supabase.from('profiles').select('school_id').single()
    setSchoolId(profile?.school_id)
    const { data: c } = await supabase.from('classes').select('*')
    const { data: t } = await supabase.from('terms').select('*')
    const { data: sub } = await supabase.from('subjects').select('*')
    setClasses(c || [])
    setTerms(t || [])
    setSubjects(sub || [])
  }

  async function loadStudents() {
    const { data } = await supabase.from('students').select('*').eq('class_id', selectedClass)
    setStudents(data || [])
    if (!selectedTerm || !selectedSubject) { setScores({}); return }
    const { data: existing, error } = await supabase
      .from('results')
      .select('*')
      .eq('term_id', selectedTerm)
      .eq('subject_id', selectedSubject)
    if (error) { setMessage(`Error: ${error.message}`); return }
    const loaded = {}
    ;(existing || []).forEach((row) => {
      loaded[row.student_id] = { ca1: row.ca1, ca2: row.ca2, ca3: row.ca3, exam: row.exam, id: row.id }
    })
    setScores(loaded)
  }

  function setScore(studentId, field, value) {
    setScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: Number(value) },
    }))
  }

  async function saveResults() {
    setSaved(false)
    setMessage('')
    const rows = students.map((s) => ({
      school_id: schoolId,
      student_id: s.id,
      subject_id: selectedSubject,
      term_id: selectedTerm,
      ca1: scores[s.id]?.ca1 || 0,
      ca2: scores[s.id]?.ca2 || 0,
      ca3: scores[s.id]?.ca3 || 0,
      exam: scores[s.id]?.exam || 0,
    }))
    const { error } = await supabase.from('results').upsert(rows, { onConflict: 'student_id,subject_id,term_id' })
    if (error) setMessage(`Error: ${error.message}`)
    else { setSaved(true); setMessage('Results saved.'); loadStudents() }
  }

  async function deleteResult(studentId) {
    const resultId = scores[studentId]?.id
    if (!resultId || !window.confirm('Delete this student\'s result for the selected subject and term?')) return
    const { error } = await supabase.from('results').delete().eq('id', resultId)
    if (error) setMessage(`Error: ${error.message}`)
    else { setMessage('Result deleted.'); loadStudents() }
  }

  const ready = selectedClass && selectedTerm && selectedSubject

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Enter Results</h2>
      <div style={{ marginBottom: 16 }}>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ padding: 6, marginRight: 8 }}>
          <option value="">-- Class --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select>
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} style={{ padding: 6, marginRight: 8 }}>
          <option value="">-- Term --</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.term_name}</option>)}
        </select>
        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={{ padding: 6 }}>
          <option value="">-- Subject --</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
        </select>
      </div>

      {ready && students.length > 0 && (
        <div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Student</th>
                <th>CA1</th><th>CA2</th><th>CA3</th><th>Exam</th><th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  {['ca1', 'ca2', 'ca3', 'exam'].map((field) => (
                    <td key={field}>
                      <input type="number" style={{ width: 60, padding: 4 }}
                        value={scores[s.id]?.[field] ?? ''}
                        onChange={(e) => setScore(s.id, field, e.target.value)} />
                    </td>
                  ))}
                  <td>{scores[s.id]?.id && <button onClick={() => deleteResult(s.id)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={saveResults} style={{ padding: '8px 16px', marginTop: 12 }}>Save Results</button>
          {saved && <p style={{ color: 'green' }}>Saved!</p>}
          {message && <p style={{ color: message.startsWith('Error:') ? 'red' : 'green' }}>{message}</p>}
        </div>
      )}
    </div>
  )
}
