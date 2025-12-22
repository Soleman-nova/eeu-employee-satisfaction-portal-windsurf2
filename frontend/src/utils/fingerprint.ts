export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function generateFingerprint(ip?: string): Promise<string> {
  const parts: string[] = []

  try {
    parts.push(navigator.userAgent || '')
  } catch {
    parts.push('')
  }

  try {
    parts.push(String(navigator.language || ''))
  } catch {
    parts.push('')
  }

  try {
    parts.push(String(Intl.DateTimeFormat().resolvedOptions().timeZone || ''))
  } catch {
    parts.push('')
  }

  try {
    parts.push(`${window.screen?.width || ''}x${window.screen?.height || ''}`)
    parts.push(String(window.devicePixelRatio || ''))
  } catch {
    parts.push('')
  }

  // Optional: lightweight canvas fingerprint (best-effort)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('EEU survey', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('EEU survey', 4, 17)
      parts.push(canvas.toDataURL())
    }
  } catch {
    // ignore
  }

  if (ip) parts.push(`ip:${ip}`)

  const raw = parts.join('|')

  // If crypto.subtle is unavailable for some reason, fall back to a simple hash.
  try {
    return await sha256Hex(raw)
  } catch {
    let h = 0
    for (let i = 0; i < raw.length; i++) {
      h = (h << 5) - h + raw.charCodeAt(i)
      h |= 0
    }
    return `h${Math.abs(h)}`
  }
}
