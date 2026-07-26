const json = (body, status = 200, origin = '') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(origin) } })
const cors = (origin) => ({ 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' })

async function profileForRequest(request, env) {
  const token = request.headers.get('authorization')
  if (!token?.startsWith('Bearer ')) throw new Error('Sign in is required.')
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: token } })
  if (!userResponse.ok) throw new Error('Your login session is not valid.')
  const user = await userResponse.json()
  const profileResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,school_id,role`, { headers: serviceHeaders(env) })
  const [profile] = await profileResponse.json()
  if (!profile || !['SUPER_ADMIN', 'ADMIN', 'BURSAR'].includes(profile.role)) throw new Error('You do not have permission to record payments.')
  return { user, profile }
}

const serviceHeaders = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' })

async function verifyPaystackSignature(raw, receivedSignature, secret) {
  if (!receivedSignature) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const received = new Uint8Array(receivedSignature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
  if (signature.length !== received.length) return false
  let difference = 0
  for (let index = 0; index < signature.length; index += 1) difference |= signature[index] ^ received[index]
  return difference === 0
}

async function initializePayment(request, env) {
  const { user, profile } = await profileForRequest(request, env)
  const { studentId, amount } = await request.json()
  const amountNaira = Number(amount)
  if (!studentId || !Number.isFinite(amountNaira) || amountNaira < 100) throw new Error('Enter a valid payment amount of at least ₦100.')
  const studentResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&school_id=eq.${encodeURIComponent(profile.school_id)}&select=id,full_name,balance`, { headers: serviceHeaders(env) })
  const [student] = await studentResponse.json()
  if (!student) throw new Error('Student was not found in your school.')
  if (amountNaira > Number(student.balance)) throw new Error('The amount cannot be greater than this student’s outstanding balance.')
  const reference = `school_${crypto.randomUUID().replaceAll('-', '')}`
  const pendingResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/online_payments`, { method: 'POST', headers: { ...serviceHeaders(env), Prefer: 'return=minimal' }, body: JSON.stringify({ school_id: profile.school_id, student_id: student.id, amount: amountNaira, reference, status: 'PENDING' }) })
  if (!pendingResponse.ok) throw new Error('Could not prepare this payment.')
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, amount: Math.round(amountNaira * 100), currency: 'NGN', reference, callback_url: `${env.APP_URL}/payments?payment=${encodeURIComponent(reference)}`, channels: ['card', 'bank_transfer'], metadata: { student_id: student.id, school_id: profile.school_id } }) })
  const paystack = await paystackResponse.json()
  if (!paystackResponse.ok || !paystack.status) throw new Error(paystack.message || 'Paystack could not start the transaction.')
  return paystack.data
}

async function verifyTransaction(reference, env) {
  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } })
  const verified = await verifyResponse.json()
  if (!verifyResponse.ok || !verified.status || verified.data?.status !== 'success' || verified.data?.reference !== reference || verified.data?.currency !== 'NGN') throw new Error('Paystack could not verify this payment.')
  const amount = Number(verified.data.amount) / 100
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Paystack returned an invalid payment amount.')
  return amount
}

async function processWebhook(request, env) {
  const raw = await request.text()
  if (!await verifyPaystackSignature(raw, request.headers.get('x-paystack-signature'), env.PAYSTACK_SECRET_KEY)) return new Response('Invalid signature', { status: 401 })
  const event = JSON.parse(raw)
  if (event.event !== 'charge.success') return new Response('Ignored', { status: 200 })
  const reference = event.data?.reference
  if (!reference) return new Response('Invalid event', { status: 400 })
  let paidAmount
  try { paidAmount = await verifyTransaction(reference, env) } catch { console.log(JSON.stringify({ event: 'paystack_verification_failed', reference })); return new Response('Verification failed', { status: 400 }) }
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/confirm_online_payment`, { method: 'POST', headers: serviceHeaders(env), body: JSON.stringify({ payment_reference: reference, paid_amount: paidAmount }) })
  if (!response.ok) { console.log(JSON.stringify({ event: 'paystack_webhook_failed', reference, status: response.status })); return new Response('Processing failed', { status: 500 }) }
  return new Response('OK', { status: 200 })
}

export default { async fetch(request, env) {
  const origin = env.ALLOWED_ORIGIN
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })
  try {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/paystack/webhook') return processWebhook(request, env)
    if (request.method === 'POST' && url.pathname === '/payments/initialize') return json(await initializePayment(request, env), 200, origin)
    return json({ error: 'Not found' }, 404, origin)
  } catch (error) { return json({ error: error.message || 'Unexpected payment error.' }, 400, origin) }
} }
