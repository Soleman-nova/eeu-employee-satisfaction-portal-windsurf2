export function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString()
}

export function formatNumber(n?: number, digits = 1) {
  if (n == null) return ''
  return n.toFixed(digits)
}
