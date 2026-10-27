'use client'

/** Typed fetch wrapper — adds CSRF header, normalizes {ok,data|error} envelope. */
export async function apiFetch<T>(url: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('X-Requested-With', 'XMLHttpRequest')
  let body = options.body
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.json)
  }
  const res = await fetch(url, { ...options, headers, body, credentials: 'same-origin' })
  let payload: { ok?: boolean; data?: T; error?: string } = {}
  try {
    payload = await res.json()
  } catch {
    throw new Error(`HTTP ${res.status}`)
  }
  if (!res.ok || payload.ok === false) {
    const err = new Error(payload.error || `HTTP ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload.data as T
}

export async function apiUpload<T>(url: string, formData: FormData, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && payload.ok !== false) resolve(payload.data as T)
        else reject(new Error(payload.error || `HTTP ${xhr.status}`))
      } catch {
        reject(new Error(`HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(formData)
  })
}
