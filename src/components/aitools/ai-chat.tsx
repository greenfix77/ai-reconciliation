'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Eraser, MessageSquareText, SendHorizonal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { AiChatMessage } from '@/lib/types'
import { MarkdownLite } from '@/components/aitools/markdown-lite'
import { cn } from '@/lib/utils'

const SUGGESTION_KEYS = ['s1', 's2', 's3', 's4'] as const

export function AiChatCard({ projectId }: { projectId: string | null }) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<AiChatMessage[]>([{ role: 'assistant', content: '' }])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // welcome message + reset when project changes
  useEffect(() => {
    setMessages([{ role: 'assistant', content: t('aitools.chat.welcome') }])
  }, [projectId, t])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading || !projectId) return
    const nextMessages: AiChatMessage[] = [...messages.filter((m) => m.content !== ''), { role: 'user', content }]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setDraft('')
    setLoading(true)
    try {
      const res = await apiFetch<{ reply: AiChatMessage }>('/api/ai/chat', {
        method: 'POST',
        json: { projectId, messages: nextMessages.slice(-20) },
      })
      setMessages([...nextMessages, res.reply])
    } catch (err) {
      setMessages(nextMessages)
      toast.error(`${t('aitools.chat.error')}${err instanceof Error ? ` — ${err.message}` : ''}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex min-h-[420px] flex-col rounded-2xl border bg-card card-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          {t('aitools.chat.title')}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg text-[11px] text-muted-foreground" onClick={() => setMessages([{ role: 'assistant', content: t('aitools.chat.welcome') }])}>
          <Eraser className="h-3 w-3" />
          {t('aitools.chat.newChat')}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        {!projectId && <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">{t('aitools.chat.requiresProject')}</p>}

        <div ref={scrollRef} className="max-h-72 min-h-56 flex-1 overflow-y-auto rounded-xl bg-muted/30 p-2.5" role="log" aria-live="polite">
          <div className="flex flex-col gap-2.5">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-6',
                    m.role === 'user'
                      ? 'rounded-es-md bg-primary text-primary-foreground'
                      : 'rounded-ee-md border bg-card text-foreground/90'
                  )}
                >
                  {m.role === 'assistant' ? (
                    m.content ? (
                      <MarkdownLite content={m.content} className="text-xs" />
                    ) : (
                      <span className="flex items-center gap-1 py-0.5" aria-label={t('aitools.chat.thinking')}>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
                      </span>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* suggested prompts */}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTION_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!projectId || loading}
              onClick={() => void send(t(`aitools.chat.${k}`))}
              className="rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50 dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
            >
              {t(`aitools.chat.${k}`)}
            </button>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={projectId ? t('aitools.chat.placeholder') : t('aitools.chat.requiresProject')}
            disabled={!projectId || loading}
            maxLength={2000}
            className="h-9 flex-1 rounded-xl text-xs"
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600" disabled={!projectId || loading || !draft.trim()} aria-label={t('aitools.chat.send')}>
            <SendHorizonal className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
