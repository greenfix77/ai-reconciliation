/** Smoke-test the AI tools with the injected bank-reconciliation statement block */
import { readFileSync } from 'fs'

const BASE = 'http://localhost:3000'
let cookie = ''

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(cookie ? { cookie } : {}),
      ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  const sc = res.headers.get('set-cookie')
  if (sc) cookie = sc.split(';')[0]!
  return { status: res.status, body: await res.text() }
}

async function main() {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@reconciliation.ir', password: 'Admin1234' }),
  })
  if (login.status !== 200) throw new Error('login failed')

  const projectId = process.argv[2]!
  const t0 = Date.now()
  const r = await api('/api/ai/tools', {
    method: 'POST',
    body: JSON.stringify({ projectId, tool: 'discrepancy_analysis' }),
  })
  console.log('tool status:', r.status, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's')
  if (r.status === 200) {
    const json = JSON.parse(r.body) as { data?: { result?: string } }
    const result = json.data?.result ?? ''
    console.log('result length:', result.length)
    console.log('— first 700 chars —')
    console.log(result.slice(0, 700))
    // orthography sanity: check for common glued words in the AI output
    const glued = ['میشود', 'نمیشود', 'مبغایرت', 'تطبیقنشده'].filter((w) => result.includes(w))
    console.log('glued-word violations:', glued.length ? glued.join(',') : 'none')
  } else {
    console.log(r.body.slice(0, 300))
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
