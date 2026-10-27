import ZAI from 'z-ai-web-dev-sdk'
import { db } from './db'
import { decryptSecret } from './crypto'

/**
 * Unified AI access layer (SERVER ONLY).
 * - Built-in platform AI: z-ai-web-dev-sdk (no user credentials needed).
 * - User providers: OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint.
 * API keys are decrypted in-memory only, never logged, never sent to the client.
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type AiCallOptions = {
  providerId?: string | null // null/undefined => built-in AI
  model?: string | null
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

export type AiCallResult = {
  content: string
  providerName: string
  model: string
}

const DEFAULT_TIMEOUT = 120_000

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function callBuiltIn(messages: ChatMessage[], opts: { model?: string | null; temperature?: number; maxTokens?: number }): Promise<AiCallResult> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: messages.map((m) => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content })) as never,
    thinking: { type: 'disabled' },
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  } as never)
  const content = completion?.choices?.[0]?.message?.content ?? ''
  if (!content.trim()) throw new Error('Empty AI response')
  return { content, providerName: 'Built-in AI', model: opts.model || 'z-ai' }
}

async function callOpenAiCompatible(base: string, apiKey: string, model: string, messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; timeoutMs: number }): Promise<AiCallResult> {
  const url = `${base.replace(/\/+$/, '')}/chat/completions`
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens ?? 4096 }),
    },
    opts.timeoutMs
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Provider returned empty content')
  return { content, providerName: 'OpenAI-compatible', model }
}

async function callAnthropic(base: string, apiKey: string, model: string, messages: ChatMessage[], opts: { maxTokens?: number; timeoutMs: number }): Promise<AiCallResult> {
  const url = `${base.replace(/\/+$/, '')}/messages`
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
  const rest = messages.filter((m) => m.role !== 'system')
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, system: system || undefined, messages: rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })), max_tokens: opts.maxTokens ?? 4096 }),
    },
    opts.timeoutMs
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const content = Array.isArray(data?.content) ? data.content.map((c: { text?: string }) => c?.text ?? '').join('') : ''
  if (!content.trim()) throw new Error('Provider returned empty content')
  return { content, providerName: 'Anthropic', model }
}

async function callGemini(base: string, apiKey: string, model: string, messages: ChatMessage[], opts: { maxTokens?: number; timeoutMs: number }): Promise<AiCallResult> {
  const url = `${base.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined, generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096, temperature: 0.2 } }),
    },
    opts.timeoutMs
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const content = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p?.text ?? '').join('')
  if (!content.trim()) throw new Error('Provider returned empty content')
  return { content, providerName: 'Google Gemini', model }
}

/** Single entrypoint for all AI calls. */
export async function aiChat(options: AiCallOptions): Promise<AiCallResult> {
  const { providerId, model, messages, timeoutMs = DEFAULT_TIMEOUT } = options

  if (providerId) {
    const provider = await db.aiProvider.findUnique({ where: { id: providerId } })
    if (!provider) throw new Error('AI provider not found')
    let apiKey: string
    try {
      apiKey = decryptSecret(provider.apiKeyEnc)
    } catch {
      throw new Error('Failed to decrypt provider credentials')
    }
    const chosenModel = model || (JSON.parse(provider.models || '[]')[0] as string | undefined) || ''
    if (!chosenModel) throw new Error('No model selected for provider')
    const base = provider.baseUrl || defaultBase(provider.type)
    switch (provider.type) {
      case 'openai':
      case 'custom':
        return callOpenAiCompatible(base, apiKey, chosenModel, messages, { temperature: options.temperature, maxTokens: options.maxTokens, timeoutMs })
      case 'anthropic':
        return callAnthropic(base, apiKey, chosenModel, messages, { maxTokens: options.maxTokens, timeoutMs })
      case 'gemini':
        return callGemini(base, apiKey, chosenModel, messages, { maxTokens: options.maxTokens, timeoutMs })
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`)
    }
  }

  return callBuiltIn(messages, { model, temperature: options.temperature, maxTokens: options.maxTokens })
}

function defaultBase(type: string): string {
  switch (type) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'anthropic':
      return 'https://api.anthropic.com/v1'
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta'
    default:
      return 'https://api.openai.com/v1'
  }
}

/** Robust JSON extraction from an LLM response (handles code fences, prose). */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/gi, '```')
  const fenced = /```([\s\S]*?)```/.exec(cleaned)
  const candidates: string[] = []
  if (fenced) candidates.push(fenced[1].trim())
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(cleaned.slice(first, last + 1))
  candidates.push(cleaned.trim())
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      // try next
    }
  }
  throw new Error('AI response was not valid JSON')
}
