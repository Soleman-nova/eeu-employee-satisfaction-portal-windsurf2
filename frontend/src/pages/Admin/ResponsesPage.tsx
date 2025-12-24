import React, { useEffect, useMemo, useState } from 'react'
import { listResponses, exportResponsesExcel, exportResponsesPdf, type ResponsesQuery, type AdminResponseItem, listSurveys, type AdminSurvey } from '@/api/adminAPI'
import { useI18n } from '@/context/I18nContext'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

const stripHtml = (html?: string | null) => {
  const raw = (html ?? '').toString()
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ResponsesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AdminResponseItem[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [surveys, setSurveys] = useState<AdminSurvey[]>([])
  const [survey, setSurvey] = useState<number | undefined>(undefined)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [question, setQuestion] = useState<number | undefined>(undefined)
  const [ratingMin, setRatingMin] = useState<number | undefined>(undefined)
  const [ratingMax, setRatingMax] = useState<number | undefined>(undefined)
  const [sortKey, setSortKey] = useState<'id' | 'submitted_at' | 'survey'>('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const query: ResponsesQuery = useMemo(() => ({
    survey,
    from: from || undefined,
    to: to || undefined,
    question,
    rating_min: ratingMin,
    rating_max: ratingMax,
    page,
    page_size: pageSize,
  }), [survey, from, to, question, ratingMin, ratingMax, page, pageSize])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listResponses(query)
      setItems(res.results)
      setCount(res.count)
    } catch (e: any) {
      setError(e?.message || 'Failed to load responses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    listSurveys().then(setSurveys).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      load()
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.page_size, query.survey, query.from, query.to, query.question, query.rating_min, query.rating_max])

  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  const currentSurvey = useMemo(() => surveys.find(s => s.id === survey), [surveys, survey])
  const questionOptions = useMemo(() => {
    if (!currentSurvey) return []
    const fromSections = (currentSurvey.sections || []).flatMap((sec) => sec.questions || [])
    const fromRoot = currentSurvey.questions || []
    const all = [...fromSections, ...fromRoot]
    const map = new Map<number, (typeof all)[number]>()
    for (const q of all) {
      if (q?.id == null) continue
      if (!map.has(q.id)) map.set(q.id, q)
    }
    return Array.from(map.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [currentSurvey])
  const selectedQuestion = useMemo(
    () => questionOptions.find(q => q.id === question),
    [questionOptions, question]
  )
  const ratingDisabled = !!(selectedQuestion && selectedQuestion.question_type !== 'rating')

  useEffect(() => {
    if (ratingDisabled && (ratingMin != null || ratingMax != null)) {
      setRatingMin(undefined)
      setRatingMax(undefined)
      setPage(1)
    }
  }, [ratingDisabled, ratingMin, ratingMax])

  const isFiltered = !!(survey || from || to || question || ratingMin || ratingMax)

  const sortedItems = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      if (sortKey === 'id') { va = a.id; vb = b.id }
      else if (sortKey === 'submitted_at') { va = new Date(a.submitted_at).getTime(); vb = new Date(b.submitted_at).getTime() }
      else { va = stripHtml(a.survey.title).toLowerCase(); vb = stripHtml(b.survey.title).toLowerCase() }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [items, sortKey, sortDir])

  const toggleSort = (key: 'id' | 'submitted_at' | 'survey') => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const onExportExcel = async () => {
    const blob = await exportResponsesExcel({ ...query, page: undefined, page_size: undefined })
    downloadBlob(blob, 'responses.xlsx')
  }
  const onExportPdf = async () => {
    const blob = await exportResponsesPdf({ ...query, page: undefined, page_size: undefined })
    downloadBlob(blob, 'responses.pdf')
  }

  const onExportCsv = () => {
    const header = ['ID','Submitted','Survey','Answers']
    const rows = sortedItems.map(r => {
      const answers = r.answers.map(a => {
        const parts = [a.question]
        if (a.type === 'rating') parts.push(`Rating: ${a.rating ?? '-'}`)
        if (a.comment) parts.push(`"${a.comment.replace(/"/g, '""')}"`)
        return parts.join(' — ')
      }).join(' | ')
      return [
        r.id,
        new Date(r.submitted_at).toLocaleString(),
        stripHtml(r.survey.title).replace(/"/g, '""'),
        answers,
      ]
    })
    const csv = [header, ...rows]
      .map(row => row.map(val => typeof val === 'string' ? `"${val}"` : String(val)).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, 'responses.csv')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="px-3 py-1.5 rounded border inline-flex items-center gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back</span>
          </button>
          <h2 className="text-2xl font-semibold">{t('responses.title')}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={onExportCsv} className="px-3 py-2 rounded bg-slate-600 text-white inline-flex items-center gap-2">
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>{t('responses.export_csv')}</span>
          </button>
          <button onClick={onExportExcel} className="px-3 py-2 rounded bg-emerald-600 text-white inline-flex items-center gap-2">
            <DocumentArrowDownIcon className="h-5 w-5" />
            <span>{t('responses.export_excel')}</span>
          </button>
          <button onClick={onExportPdf} className="px-3 py-2 rounded bg-amber-600 text-white inline-flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" />
            <span>{t('responses.export_pdf')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded border dark:border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-700 dark:text-slate-200">{t('responses.filters')}</div>
          {isFiltered && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{t('responses.filters_applied')}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1">{t('responses.survey')}</label>
            <select
              value={survey ?? ''}
              onChange={e => { const id = e.target.value ? Number(e.target.value) : undefined; setSurvey(id); setQuestion(undefined); setPage(1) }}
              className="w-full border dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">All</option>
              {surveys.map(s => <option key={s.id} value={s.id}>{stripHtml(s.title)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1">{t('responses.from')}</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="w-full border dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1">{t('responses.to')}</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="w-full border dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1">{t('responses.question')}</label>
            <select
              value={question ?? ''}
              disabled={!survey}
              onChange={e => { const v = e.target.value; setQuestion(v ? Number(v) : undefined); setPage(1) }}
              className="w-full border dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 dark:disabled:text-slate-500"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">All</option>
              {questionOptions.map(q => (
                <option key={q.id} value={q.id}>{stripHtml(q.text)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1">{t('responses.rating_min')}</label>
            <input
              type="number"
              min={1}
              max={5}
              disabled={ratingDisabled}
              value={ratingMin ?? ''}
              onChange={e => {
                const raw = e.target.value
                const next = raw ? Math.max(1, Math.min(5, Math.trunc(Number(raw)))) : undefined
                setRatingMin(next)
                if (next != null && ratingMax != null && next > ratingMax) setRatingMax(next)
                setPage(1)
              }}
              className="w-full border dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 dark:disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-300 mb-1">{t('responses.rating_max')}</label>
            <input
              type="number"
              min={1}
              max={5}
              disabled={ratingDisabled}
              value={ratingMax ?? ''}
              onChange={e => {
                const raw = e.target.value
                const next = raw ? Math.max(1, Math.min(5, Math.trunc(Number(raw)))) : undefined
                setRatingMax(next)
                if (next != null && ratingMin != null && next < ratingMin) setRatingMin(next)
                setPage(1)
              }}
              className="w-full border dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 dark:disabled:text-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left cursor-pointer select-none" onClick={() => toggleSort('id')}>ID {sortKey==='id' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
              <th className="p-3 text-left cursor-pointer select-none" onClick={() => toggleSort('submitted_at')}>Submitted {sortKey==='submitted_at' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
              <th className="p-3 text-left cursor-pointer select-none" onClick={() => toggleSort('survey')}>{t('responses.survey')} {sortKey==='survey' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
              <th className="p-3 text-left">Answers</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-4" colSpan={4}>{t('responses.loading')}</td></tr>
            )}
            {error && !loading && (
              <tr><td className="p-4 text-red-600" colSpan={4}>{error}</td></tr>
            )}
            {!loading && !error && sortedItems.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.id}</td>
                <td className="p-3">{new Date(r.submitted_at).toLocaleString()}</td>
                <td className="p-3">{stripHtml(r.survey.title)}</td>
                <td className="p-3">
                  <ul className="space-y-1">
                    {r.answers.map((a, i) => (
                      <li key={i} className="text-gray-700">
                        <span className="font-medium">{a.question}</span>
                        {a.type === 'rating' ? <span> — Rating: {a.rating ?? '-'}</span> : null}
                        {a.comment ? <span> — "{a.comment}"</span> : null}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
            {!loading && !error && items.length === 0 && (
              <tr><td className="p-4 text-gray-600" colSpan={4}>{t('responses.no_results')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Page {page} of {totalPages} • {count} results</div>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded border disabled:opacity-50">{t('responses.prev')}</button>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border disabled:opacity-50">{t('responses.next')}</button>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="ml-2 border rounded px-2 py-1 text-sm">
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

