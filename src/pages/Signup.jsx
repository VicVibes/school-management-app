import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Signup() {
  const [schoolName, setSchoolName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSignup(e) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    // 1. Create the login account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) {
      setErrorMsg(authError.message)
      setLoading(false)
      return
    }

    // 2. Make the ID in the browser. The new user cannot read the school yet:
    // their profile, which grants that access, is created in the next step.
    const schoolId = crypto.randomUUID()
    const { error: schoolError } = await supabase
      .from('schools')
      .insert({ id: schoolId, name: schoolName, plan: 'FREE', max_students: 50 })

    if (schoolError) {
      setErrorMsg('Account created, but school setup failed: ' + schoolError.message)
      setLoading(false)
      return
    }

    // 3. Link the new user to the new school as ADMIN
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      school_id: schoolId,
      full_name: fullName,
      role: 'ADMIN',
    })

    setLoading(false)

    if (profileError) {
      setErrorMsg('School created, but profile setup failed: ' + profileError.message)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', fontFamily: 'sans-serif' }}>
      <h2>Create Your School Account</h2>
      <p style={{ color: '#666', fontSize: 14 }}>Free plan — up to 50 students, no card required.</p>
      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: 12 }}>
          <label>School Name</label><br />
          <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Your Full Name</label><br />
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label><br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label><br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
        <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>Already have an account? <Link to="/">Log in</Link></p>
    </div>
  )
}
