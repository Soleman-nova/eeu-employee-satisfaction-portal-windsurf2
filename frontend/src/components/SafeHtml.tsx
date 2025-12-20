import React from 'react'
import DOMPurify from 'dompurify'

export type SafeHtmlProps = {
  html?: string | null
  className?: string
}

export default function SafeHtml({ html, className }: SafeHtmlProps) {
  const sanitized = React.useMemo(() => {
    const raw = (html ?? '').toString()
    return DOMPurify.sanitize(raw)
  }, [html])

  if (!sanitized || sanitized.trim().length === 0) return null

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />
}
