import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const blank = { class_id: '', subject_id: '', day_of_week: 'Monday', start_time: '', end_time: '', teacher_name: '', room: '' }
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Timetable() {
  const [schoolId, setSchoolId] = useState('')
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    const { data: profile, error } = await supabase.from('profiles').select('school_id').single()
    if (error) { setMessage(`Error: ${error.message}`); return }
    setSchoolId(profile.school_id)
    const [classResult, subjectResult, timetableResult] = await Promise.all([
      supabase.from('classes').select('*').order('class_name'),
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('timetables').select('*, classes(class_name), subjects(subject_name)').order('start_time'),
    ])
    setClasses(classResult.data || []); setSubjects(subjectResult.data || []); setRows(timetableResult.data || [])
  }
  function change(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  async function save(e) {
    e.preventDefault(); setMessage('')
    const row = { ...form, school_id: schoolId, subject_id: form.subject_id || null, teacher_name: form.teacher_name || null, room: form.room || null }
    const { error } = editing ? await supabase.from('timetables').update(row).eq('id', editing) : await supabase.from('timetables').insert(row)
    if (error) setMessage(`Error: ${error.message}`)
    else { setMessage(editing ? 'Lesson updated.' : 'Lesson added.'); setForm(blank); setEditing(null); load() }
  }
  async function remove(id) {
    if (!window.confirm('Delete this timetable lesson?')) return
    const { error } = await supabase.from('timetables').delete().eq('id', id)
    setMessage(error ? `Error: ${error.message}` : 'Lesson deleted.'); if (!error) load()
  }
  const input = { padding: 7, margin: '4px 6px 4px 0' }
  return <div style={{ maxWidth: 950, margin: '40px auto', fontFamily: 'sans-serif' }}>
    <p><Link to="/dashboard">← Dashboard</Link></p><h2>Weekly Timetable</h2>
    {message && <p style={{ color: message.startsWith('Error:') ? 'crimson' : 'green' }}>{message}</p>}
    <form onSubmit={save}>
      <select required value={form.class_id} onChange={(e) => change('class_id', e.target.value)} style={input}><option value="">Class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select>
      <select value={form.subject_id} onChange={(e) => change('subject_id', e.target.value)} style={input}><option value="">Subject (optional)</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.subject_name}</option>)}</select>
      <select value={form.day_of_week} onChange={(e) => change('day_of_week', e.target.value)} style={input}>{days.map((day) => <option key={day}>{day}</option>)}</select>
      <input required type="time" value={form.start_time} onChange={(e) => change('start_time', e.target.value)} style={input} /><input required type="time" value={form.end_time} onChange={(e) => change('end_time', e.target.value)} style={input} />
      <input placeholder="Teacher (optional)" value={form.teacher_name} onChange={(e) => change('teacher_name', e.target.value)} style={input} /><input placeholder="Room (optional)" value={form.room} onChange={(e) => change('room', e.target.value)} style={input} />
      <button>{editing ? 'Update lesson' : 'Add lesson'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(blank) }}>Cancel</button>}
    </form>
    {days.map((day) => <section key={day} style={{ marginTop: 24 }}><h3>{day}</h3>{rows.filter((row) => row.day_of_week === day).map((row) => <p key={row.id}>{row.start_time.slice(0, 5)} - {row.end_time.slice(0, 5)} | {row.classes?.class_name} | {row.subjects?.subject_name || 'General'} {row.teacher_name ? `| ${row.teacher_name}` : ''} {row.room ? `| ${row.room}` : ''} <button onClick={() => { setEditing(row.id); setForm({ class_id: row.class_id, subject_id: row.subject_id || '', day_of_week: row.day_of_week, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5), teacher_name: row.teacher_name || '', room: row.room || '' }) }}>Edit</button> <button onClick={() => remove(row.id)}>Delete</button></p>) || <p>No lessons.</p>}</section>)}
  </div>
}
