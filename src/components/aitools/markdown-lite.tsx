'use client'

import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight markdown-ish renderer for AI outputs (no deps):
 * - "### Heading" lines
 * - **bold** inline
 * - "- item" / "* item" bullet lists
 * - "| a | b |" table rows → simple grid
 * - numbered lists
 * - blank-line paragraphs
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // split by **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={`${keyPrefix}-t${i}`}>{part}</Fragment>
  })
}

export function MarkdownLite({ content, className }: { content: string; className?: string }) {
  const lines = (content ?? '').replace(/\r/g, '').split('\n')

  const blocks: ReactNode[] = []
  let list: string[] = []
  let table: string[] = []
  let paragraph: string[] = []

  const flushList = () => {
    if (list.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1 ps-4">
        {list.map((item, i) => (
          <li key={i} className="list-disc marker:text-muted-foreground/60 text-sm leading-6">
            {renderInline(item, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>
    )
    list = []
  }

  const flushTable = () => {
    if (table.length === 0) return
    const rows = table
      .map((line) => line.split('|').map((c) => c.trim()))
      .map((cells) => (cells.length > 0 && cells[0] === '' ? cells.slice(1, cells.length - (cells[cells.length - 1] === '' ? 1 : 0)) : cells))
      .map((cells) => cells.filter((c, idx, arr) => !(idx === arr.length - 1 && c === '')))
      .filter((cells) => cells.some((c) => c.length > 0))
      .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)))
    if (rows.length > 0) {
      blocks.push(
        <div key={`tb-${blocks.length}`} className="my-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <tbody>
              {rows.map((cells, ri) => (
                <tr key={ri} className={cn('border-b last:border-0', ri === 0 && 'bg-muted/60 font-medium')}>
                  {cells.map((cell, ci) => (
                    <td key={ci} className={cn('px-2.5 py-1.5 whitespace-nowrap', ri === 0 && 'font-semibold')}>
                      {renderInline(cell, `td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    table = []
  }

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-1.5 text-sm leading-7 whitespace-pre-wrap">
        {paragraph.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(line, `pl-${blocks.length}-${i}`)}
          </Fragment>
        ))}
      </p>
    )
    paragraph = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (t === '') {
      flushList()
      flushTable()
      flushParagraph()
      continue
    }
    // table row
    if (t.startsWith('|') && t.includes('|', 1)) {
      flushList()
      flushParagraph()
      table.push(t)
      continue
    }
    flushTable()
    // heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(t)
    if (heading) {
      flushList()
      flushParagraph()
      const level = heading[1].length
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className={cn(
            'font-semibold text-foreground',
            level <= 2 ? 'text-sm mt-3 mb-1' : 'text-[13px] mt-2.5 mb-1'
          )}
        >
          {renderInline(heading[2], `h-${blocks.length}`)}
        </p>
      )
      continue
    }
    // bullet
    if (/^[-*•]\s+/.test(t)) {
      flushParagraph()
      list.push(t.replace(/^[-*•]\s+/, ''))
      continue
    }
    // numbered list
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(t)
    if (numbered) {
      flushParagraph()
      list.push(`${numbered[1]}. ${numbered[2]}`)
      continue
    }
    flushList()
    paragraph.push(t)
  }
  flushList()
  flushTable()
  flushParagraph()

  return <div className={cn('text-foreground/90', className)}>{blocks}</div>
}
