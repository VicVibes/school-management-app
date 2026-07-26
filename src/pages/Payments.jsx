import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const blankForm = { student_id: '', amount: '', mode: 'Cash', notes: '' }

export default function Payments() {
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState(blankForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const workerUrl = import.meta.env.VITE_PAYMENTS_WORKER_URL?.replace(/\/$/, '')

  useEffect(() => { load() }, [])
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('payment')
    if (reference) checkReturnedPayment(reference)
  }, [])

  async function load() {
    setLoading(true)
    const [profileResult, studentResult, paymentResult] = await Promise.all([
      supabase.from('profiles').select('id, school_id, role').single(),
      supabase.from('students').select('*').order('full_name'),
      supabase.from('payments').select('*, students(full_name, student_code)').order('created_at', { ascending: false }),
    ])
    setProfile(profileResult.data)
    setStudents(studentResult.data || [])
    setPayments(paymentResult.data || [])
    setLoading(false)
  }

  async function checkReturnedPayment(reference) {
    setMessage('We are confirming your Paystack payment securely…')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data } = await supabase.from('online_payments').select('status').eq('reference', reference).maybeSingle()
      if (data?.status === 'PAID') {
        setMessage('Payment confirmed. The student balance has been updated.')
        window.history.replaceState({}, '', '/payments')
        load()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    setMessage('Your payment is still being confirmed. Please refresh this page in a moment; do not pay again.')
  }

  function validAmount() {
    const student = students.find((item) => item.id === form.student_id)
    const amount = Number(form.amount)
    if (!student) return 'Choose a student first.'
    if (!Number.isFinite(amount) || amount < 100) return 'Enter an amount of at least ₦100.'
    if (amount > Number(student.balance)) return 'The amount cannot be greater than the student’s outstanding balance.'
    return null
  }

  async function save(e) {
    e.preventDefault()
    if (!profile) return
    const errorMessage = validAmount()
    if (errorMessage) return setMessage(`Error: ${errorMessage}`)
    setSubmitting(true)
    const { error } = await supabase.from('payments').insert({ school_id: profile.school_id, student_id: form.student_id, amount: Number(form.amount), mode: form.mode, notes: form.notes || null, recorded_by: profile.id })
    setSubmitting(false)
    setMessage(error ? `Error: ${error.message}` : 'Payment recorded and student balance updated.')
    if (!error) { setForm(blankForm); load() }
  }

  async function payOnline() {
    const errorMessage = validAmount()
    if (errorMessage) return setMessage(`Error: ${errorMessage}`)
    if (!workerUrl) return setMessage('Error: Online payments are not configured yet. Add VITE_PAYMENTS_WORKER_URL to the app settings first.')
    setSubmitting(true)
    setMessage('Opening Paystack’s secure checkout…')
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const response = await fetch(`${workerUrl}/payments/initialize`, { method: 'POST', headers: { authorization: `Bearer ${session?.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ studentId: form.student_id, amount: Number(form.amount) }) })
      const result = await response.json()
      if (!response.ok || !result.authorization_url) throw new Error(result.error || 'Could not open Paystack checkout.')
      window.location.assign(result.authorization_url)
    } catch (error) {
      setSubmitting(false)
      setMessage(`Error: ${error.message || 'Could not open Paystack checkout.'}`)
    }
  }

  if (loading) return <div className="page-loading" role="status">Loading payments…</div>
  const selectedStudent = students.find((student) => student.id === form.student_id)
  const canRecord = ['SUPER_ADMIN', 'ADMIN', 'BURSAR'].includes(profile?.role)
  return <div className="data-page">
    <div className="page-header"><div><p className="eyebrow">FINANCE</p><h2>Payments</h2><p>Record payments, send a family to secure online checkout, and review payment history.</p></div></div>
    {message && <div className={`notice ${message.startsWith('Error:') ? 'notice-error' : 'notice-success'}`} role="status">{message}</div>}
    {!canRecord ? <div className="empty-state"><h3>Payments are restricted</h3><p>Ask your school administrator for finance access.</p></div> : <section>
      <div className="section-heading"><div><h3>Record or collect a payment</h3><p>Online payments are verified by Paystack before a balance changes.</p></div>{selectedStudent && <span className="balance-pill">Balance: ₦{Number(selectedStudent.balance).toLocaleString()}</span>}</div>
      <form onSubmit={save} className="form-grid">
        <label className="form-group">Student<select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Choose student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name} ({student.student_code}) — ₦{Number(student.balance).toLocaleString()} due</option>)}</select></label>
        <label className="form-group">Amount<input required min="100" type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 5000" /></label>
        <label className="form-group">Payment method<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option>Cash</option><option>Transfer</option><option>POS</option></select></label>
        <label className="form-group">Note (optional)<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Receipt or transfer note" /></label>
        <div className="payment-actions"><button type="submit" disabled={submitting}>{submitting ? 'Please wait…' : 'Record payment'}</button><button type="button" className="secondary-button" onClick={payOnline} disabled={submitting}>{submitting ? 'Please wait…' : 'Pay online with Paystack'}</button></div>
      </form>
    </section>}
    <section><div className="section-heading"><div><h3>Recent payments</h3><p>{payments.length ? `${payments.length} payment${payments.length === 1 ? '' : 's'} recorded` : 'Payments will appear here once recorded.'}</p></div></div>
      {payments.length === 0 ? <div className="empty-state compact"><h3>No payments recorded yet</h3><p>Choose a student above to record the first payment.</p></div> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Amount</th><th>Method</th><th>Date</th><th>Note</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.students?.full_name || 'Deleted student'}</strong><br /><small className="id-code">{payment.students?.student_code || '—'}</small></td><td><strong>₦{Number(payment.amount).toLocaleString()}</strong></td><td><span className="method-badge">{payment.mode}</span></td><td>{new Date(payment.created_at).toLocaleDateString()}</td><td>{payment.notes || '—'}</td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
