import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const emptyClass = { class_name: '', class_level: '', class_fee: '' }
const emptyStudent = { full_name: '', gender: '', class_id: '', term_id: '', parent_name: '', parent_phone: '' }
const emptySubject = { subject_name: '', code: '' }
const emptyTerm = { term_name: '', term_fee: '', active: false, start_date: '', end_date: '' }

export default function SchoolData() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section')
  const [schoolId, setSchoolId] = useState('')
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [studentPhotos, setStudentPhotos] = useState({})
  const [photoFile, setPhotoFile] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([])
  const [classForm, setClassForm] = useState(emptyClass)
  const [studentForm, setStudentForm] = useState(emptyStudent)
  const [subjectForm, setSubjectForm] = useState(emptySubject)
  const [termForm, setTermForm] = useState(emptyTerm)
  const [editingClass, setEditingClass] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editingSubject, setEditingSubject] = useState(null)
  const [editingTerm, setEditingTerm] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: profile, error } = await supabase.from('profiles').select('school_id').single()
    if (error || !profile?.school_id) { setMessage(error?.message || 'Your school profile could not be found.'); setLoading(false); return }
    setSchoolId(profile.school_id)
    const [classResult, studentResult, subjectResult, termResult] = await Promise.all([
      supabase.from('classes').select('*').order('class_level'),
      supabase.from('students').select('*').order('full_name'),
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('terms').select('*').order('term_name'),
    ])
    setClasses(classResult.data || [])
    const loadedStudents = studentResult.data || []
    setStudents(loadedStudents)
    const signedPhotos = await Promise.all(loadedStudents.map(async (student) => {
      if (!student.photo_url) return [student.id, null]
      const { data } = await supabase.storage.from('student-photos').createSignedUrl(student.photo_url, 3600)
      return [student.id, data?.signedUrl || null]
    }))
    setStudentPhotos(Object.fromEntries(signedPhotos.filter(([, url]) => url)))
    setSubjects(subjectResult.data || [])
    setTerms(termResult.data || [])
    setLoading(false)
  }

  function setForm(setter, field, value) { setter((current) => ({ ...current, [field]: value })) }
  function report(error, success) { setMessage(error ? `Error: ${error.message}` : success); if (!error) loadData() }

  async function saveClass(e) {
    e.preventDefault()
    const row = { school_id: schoolId, class_name: classForm.class_name, class_level: classForm.class_level ? Number(classForm.class_level) : null, class_fee: Number(classForm.class_fee || 0) }
    const { error } = editingClass ? await supabase.from('classes').update(row).eq('id', editingClass) : await supabase.from('classes').insert(row)
    if (!error) { setClassForm(emptyClass); setEditingClass(null) }
    report(error, editingClass ? 'Class updated.' : 'Class created.')
  }

  async function saveStudent(e) {
    e.preventDefault()
    const chosenClass = classes.find((item) => item.id === studentForm.class_id)
    const row = { school_id: schoolId, full_name: studentForm.full_name, gender: studentForm.gender || null, class_id: studentForm.class_id || null, term_id: studentForm.term_id || null, parent_name: studentForm.parent_name || null, parent_phone: studentForm.parent_phone || null }
    if (!editingStudent) row.balance = Number(chosenClass?.class_fee || 0)
    const { data: savedStudent, error } = editingStudent
      ? await supabase.from('students').update(row).eq('id', editingStudent).select().single()
      : await supabase.from('students').insert(row).select().single()
    let finalError = error
    if (!finalError && photoFile) {
      if (!photoFile.type.startsWith('image/') || photoFile.size > 2 * 1024 * 1024) finalError = { message: 'Choose an image smaller than 2 MB.' }
      else {
        const extension = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${schoolId}/${savedStudent.id}.${extension}`
        const { error: uploadError } = await supabase.storage.from('student-photos').upload(path, photoFile, { upsert: true, contentType: photoFile.type })
        if (uploadError) finalError = uploadError
        else {
          const { error: photoError } = await supabase.from('students').update({ photo_url: path }).eq('id', savedStudent.id)
          finalError = photoError
        }
      }
    }
    if (!finalError) { setStudentForm(emptyStudent); setEditingStudent(null); setPhotoFile(null) }
    report(finalError, editingStudent ? 'Student updated.' : 'Student created. A student ID was generated automatically.')
  }

  async function saveSubject(e) {
    e.preventDefault()
    const row = { school_id: schoolId, subject_name: subjectForm.subject_name, code: subjectForm.code || null }
    const { error } = editingSubject ? await supabase.from('subjects').update(row).eq('id', editingSubject) : await supabase.from('subjects').insert(row)
    if (!error) { setSubjectForm(emptySubject); setEditingSubject(null) }
    report(error, editingSubject ? 'Subject updated.' : 'Subject created.')
  }

  async function saveTerm(e) {
    e.preventDefault()
    const row = { school_id: schoolId, term_name: termForm.term_name, term_fee: Number(termForm.term_fee || 0), active: termForm.active, start_date: termForm.start_date || null, end_date: termForm.end_date || null }
    const { error } = editingTerm ? await supabase.from('terms').update(row).eq('id', editingTerm) : await supabase.from('terms').insert(row)
    if (!error) { setTermForm(emptyTerm); setEditingTerm(null) }
    report(error, editingTerm ? 'Term updated.' : 'Term created.')
  }

  async function remove(table, id, label) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    report(error, `${label[0].toUpperCase()}${label.slice(1)} deleted.`)
  }

  const sectionStyle = { borderTop: '1px solid #ddd', marginTop: 28, paddingTop: 16 }
  const input = { padding: 7, margin: '4px 6px 4px 0' }
  const visible = (name) => !section || section === name
  if (loading) return <p style={{ padding: 40 }}>Loading school data...</p>

  return <div style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'sans-serif' }}>
    <p><Link to="/dashboard">← Dashboard</Link></p>
    <h2>Manage School Data</h2>
    {message && <p style={{ color: message.startsWith('Error:') ? 'crimson' : 'green' }}>{message}</p>}

    {visible('classes') && <section style={sectionStyle}><h3>Classes</h3>
      <form onSubmit={saveClass}><input required placeholder="Class name" value={classForm.class_name} onChange={(e) => setForm(setClassForm, 'class_name', e.target.value)} style={input} /><input type="number" placeholder="Level" value={classForm.class_level} onChange={(e) => setForm(setClassForm, 'class_level', e.target.value)} style={input} /><input type="number" min="0" placeholder="Class fee" value={classForm.class_fee} onChange={(e) => setForm(setClassForm, 'class_fee', e.target.value)} style={input} /><button>{editingClass ? 'Update class' : 'Add class'}</button>{editingClass && <button type="button" onClick={() => { setEditingClass(null); setClassForm(emptyClass) }}>Cancel</button>}</form>
      {classes.map((item) => <p key={item.id}>{item.class_name} — Fee: {item.class_fee} <button onClick={() => { setEditingClass(item.id); setClassForm({ class_name: item.class_name, class_level: item.class_level || '', class_fee: item.class_fee || '' }) }}>Edit</button> <button onClick={() => remove('classes', item.id, 'class')}>Delete</button></p>)}
    </section>}

    {visible('students') && <section style={sectionStyle}><h3>Students</h3>
      <form onSubmit={saveStudent}><input required placeholder="Full name" value={studentForm.full_name} onChange={(e) => setForm(setStudentForm, 'full_name', e.target.value)} style={input} /><select value={studentForm.gender} onChange={(e) => setForm(setStudentForm, 'gender', e.target.value)} style={input}><option value="">Gender</option><option>MALE</option><option>FEMALE</option></select><select value={studentForm.class_id} onChange={(e) => setForm(setStudentForm, 'class_id', e.target.value)} style={input}><option value="">Class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select><select value={studentForm.term_id} onChange={(e) => setForm(setStudentForm, 'term_id', e.target.value)} style={input}><option value="">Term (optional)</option>{terms.map((item) => <option key={item.id} value={item.id}>{item.term_name}</option>)}</select><input placeholder="Parent name" value={studentForm.parent_name} onChange={(e) => setForm(setStudentForm, 'parent_name', e.target.value)} style={input} /><input placeholder="Parent phone" value={studentForm.parent_phone} onChange={(e) => setForm(setStudentForm, 'parent_phone', e.target.value)} style={input} /><label style={input}>Photo <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} /></label><button>{editingStudent ? 'Update student' : 'Add student'}</button>{editingStudent && <button type="button" onClick={() => { setEditingStudent(null); setStudentForm(emptyStudent); setPhotoFile(null) }}>Cancel</button>}</form>
      {students.map((item) => <p key={item.id}>{studentPhotos[item.id] && <img src={studentPhotos[item.id]} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: 8 }} />}{item.full_name} ({item.student_code}) <button onClick={() => { setEditingStudent(item.id); setStudentForm({ full_name: item.full_name, gender: item.gender || '', class_id: item.class_id || '', term_id: item.term_id || '', parent_name: item.parent_name || '', parent_phone: item.parent_phone || '' }); setPhotoFile(null) }}>Edit</button> <button onClick={() => remove('students', item.id, 'student')}>Delete</button></p>)}
    </section>}

    {visible('subjects') && <section style={sectionStyle}><h3>Subjects</h3>
      <form onSubmit={saveSubject}><input required placeholder="Subject name" value={subjectForm.subject_name} onChange={(e) => setForm(setSubjectForm, 'subject_name', e.target.value)} style={input} /><input placeholder="Code (optional)" value={subjectForm.code} onChange={(e) => setForm(setSubjectForm, 'code', e.target.value)} style={input} /><button>{editingSubject ? 'Update subject' : 'Add subject'}</button>{editingSubject && <button type="button" onClick={() => { setEditingSubject(null); setSubjectForm(emptySubject) }}>Cancel</button>}</form>
      {subjects.map((item) => <p key={item.id}>{item.subject_name}{item.code ? ` (${item.code})` : ''} <button onClick={() => { setEditingSubject(item.id); setSubjectForm({ subject_name: item.subject_name, code: item.code || '' }) }}>Edit</button> <button onClick={() => remove('subjects', item.id, 'subject')}>Delete</button></p>)}
    </section>}

    {visible('terms') && <section style={sectionStyle}><h3>Terms</h3>
      <form onSubmit={saveTerm}><input required placeholder="Term name (e.g. First Term)" value={termForm.term_name} onChange={(e) => setForm(setTermForm, 'term_name', e.target.value)} style={input} /><input type="number" min="0" placeholder="Term fee" value={termForm.term_fee} onChange={(e) => setForm(setTermForm, 'term_fee', e.target.value)} style={input} /><label style={{ marginRight: 8 }}>Start <input type="date" value={termForm.start_date} onChange={(e) => setForm(setTermForm, 'start_date', e.target.value)} style={input} /></label><label style={{ marginRight: 8 }}>End <input type="date" value={termForm.end_date} onChange={(e) => setForm(setTermForm, 'end_date', e.target.value)} style={input} /></label><label><input type="checkbox" checked={termForm.active} onChange={(e) => setForm(setTermForm, 'active', e.target.checked)} /> Active term</label> <button>{editingTerm ? 'Update term' : 'Add term'}</button>{editingTerm && <button type="button" onClick={() => { setEditingTerm(null); setTermForm(emptyTerm) }}>Cancel</button>}</form>
      {terms.map((item) => <p key={item.id}>{item.term_name}{item.active ? ' (Active)' : ''} — Fee: {item.term_fee} <button onClick={() => { setEditingTerm(item.id); setTermForm({ term_name: item.term_name, term_fee: item.term_fee || '', active: item.active, start_date: item.start_date || '', end_date: item.end_date || '' }) }}>Edit</button> <button onClick={() => remove('terms', item.id, 'term')}>Delete</button></p>)}
    </section>}
  </div>
}
