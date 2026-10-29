/**
 * End-to-end test: صورت مغایرت بانکی with the user's real files.
 * Login → create project → upload daftar.xlsx (A) + bank.xlsx (B) →
 * reconcile → poll → GET statement (json + xlsx) → print key numbers.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const BASE = 'http://localhost:3000'
const UPLOAD_DIR = '/home/z/my-project/upload'
let cookie = ''

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(cookie ? { cookie } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]!
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 200)
  }
  return { status: res.status, body }
}

async function main() {
  // 1) login
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@reconciliation.ir', password: 'Admin1234' }),
  })
  console.log('login:', login.status)
  if (login.status !== 200) throw new Error('login failed: ' + JSON.stringify(login.body))

  // 2) create project
  const proj = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name: 'تست صورت مغایرت ' + Date.now(), description: 'bank.xlsx + daftar.xlsx — verification' }),
  })
  console.log('project:', proj.status)
  const projectId = (proj.body as { data?: { project?: { id?: string } } })?.data?.project?.id ?? (proj.body as { data?: { id?: string } })?.data?.id
  if (!projectId) throw new Error('no project id: ' + JSON.stringify(proj.body))

  // 3) upload files (find the two real files by size/name)
  const files = readdirSync(UPLOAD_DIR).filter((f) => f.toLowerCase().endsWith('.xlsx'))
  console.log('xlsx files in upload dir:', files)
  // daftar = the ledger: contains بدهكار/بستانكار; bank = صادرات statement.
  // Pick by reading first sheet header keywords via size heuristic + explicit names if present.
  const daftarFile = files.find((f) => f.toLowerCase().includes('daftar')) ?? files[0]!
  const bankFile = files.find((f) => f.toLowerCase().includes('bank')) ?? files[1]!
  console.log('using A(دفتر) =', daftarFile, '| B(بانک) =', bankFile)

  async function upload(fname: string, side: 'A' | 'B') {
    const buf = readFileSync(join(UPLOAD_DIR, fname))
    const fd = new FormData()
    fd.append('files', new Blob([new Uint8Array(buf)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname)
    fd.append('side', side)
    const r = await api(`/api/projects/${projectId}/files`, { method: 'POST', body: fd })
    console.log(`upload ${side} (${fname}):`, r.status, JSON.stringify(r.body).slice(0, 160))
    return r
  }
  await upload(daftarFile, 'A')
  await upload(bankFile, 'B')

  // wait for parsing then start reconcile
  await new Promise((r) => setTimeout(r, 2500))
  const rec = await api(`/api/projects/${projectId}/reconcile`, { method: 'POST', body: JSON.stringify({}) })
  console.log('reconcile start:', rec.status, JSON.stringify(rec.body).slice(0, 200))

  // 4) poll results
  let recon: { id?: string; status?: string } | null = null
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await api(`/api/projects/${projectId}/results`)
    const data = (res.body as { data?: { reconciliation?: { id: string; status: string } } })?.data
    recon = data?.reconciliation ?? null
    const jobs = (res.body as { data?: { jobs?: { status: string; progressPct: number }[] } })?.data?.jobs ?? []
    console.log(`poll ${i}: recon=${recon?.status} jobs=${jobs.map((j) => j.status + ':' + j.progressPct).join(',')}`)
    if (recon?.status === 'completed' || recon?.status === 'failed') break
  }
  if (recon?.status !== 'completed') throw new Error('reconciliation did not complete: ' + JSON.stringify(recon))

  // 5) statement JSON
  const st = await api(`/api/reports/${projectId}/statement`)
  console.log('\n=== STATEMENT API:', st.status, '===')
  const s = (st.body as { data?: { statement?: Record<string, unknown> } })?.data?.statement
  if (!s) {
    console.log('statement is null!')
    return
  }
  const t = s.totals as Record<string, number>
  const major = (m: number | null) => (m === null ? '—' : (m / 100).toLocaleString('en-US'))
  console.log('bookClosingMinor :', major(s.bookClosingMinor as number))
  console.log('bankClosingMinor :', major(s.bankClosingMinor as number))
  console.log('bookBalanceSource:', s.bookBalanceSource, '| bankBalanceSource:', s.bankBalanceSource)
  console.log('اقلام بستانکار بانک:', major(t.bankCreditsMinor), `(${t.bankCreditsCount} items)`)
  console.log('اقلام بدهکار بانک  :', major(t.bankDebitsMinor), `(${t.bankDebitsCount} items)`)
  console.log('اقلام بدهکار دفتر  :', major(t.bookDebitsMinor), `(${t.bookDebitsCount} items)`)
  console.log('اقلام بستانکار دفتر:', major(t.bookCreditsMinor), `(${t.bookCreditsCount} items)`)
  console.log('trueFromBook:', major(s.trueBalanceFromBookMinor as number))
  console.log('trueFromBank:', major(s.trueBalanceFromBankMinor as number))
  console.log('residual    :', major(s.residualMinor as number), '| converged:', s.converged)
  const credits = s.bankCreditsOpen as { date: string; description: string; inflowMinor: number }[]
  const debits = s.bankDebitsOpen as { date: string; description: string; inflowMinor: number }[]
  console.log('\n— sample bank واریز open items (first 5):')
  for (const c of credits.slice(0, 5)) console.log('   ', c.date, major(c.inflowMinor), (c.description ?? '').slice(0, 60))
  console.log('— sample bank برداشت open items (first 8):')
  for (const d of debits.slice(0, 8)) console.log('   ', d.date, major(d.inflowMinor), (d.description ?? '').slice(0, 60))

  // 6) xlsx export
  const xres = await fetch(`${BASE}/api/reports/${projectId}/statement?format=xlsx`, { headers: { cookie } })
  const xbuf = Buffer.from(await xres.arrayBuffer())
  const out = '/home/z/my-project/download/statement-test.xlsx'
  if (!existsSync('/home/z/my-project/download')) throw new Error('download dir missing')
  writeFileSync(out, xbuf)
  console.log('\nxlsx export:', xres.status, xbuf.length, 'bytes →', out)

  console.log('\nPROJECT_ID=' + projectId)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message)
  process.exit(1)
})
