import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ChartCard from '@/components/ChartCard'
import { fetchDashboardWithParams, listSurveys, type AdminSurvey } from '@/api/adminAPI'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, LabelList } from 'recharts'
import SafeHtml from '@/components/SafeHtml'
import { ClipboardDocumentListIcon, InboxStackIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { useI18n } from '@/context/I18nContext'
import { useTheme } from '@/context/ThemeContext'
import RegionsEn from '@/data/Regions-en.json'
import RegionsAm from '@/data/Regions-am.json'

type DashboardData = {
  survey: { id: number; title: string } | null
  totals: { responses: number }
  averages: Array<{ question_id: number; question: string; avg_rating: number | null }>
  recent: Array<{ id: number; submitted_at: string }>
  timeseries?: Array<{ date: string; count: number }>
  distributions?: Record<string, Record<string | number, number>>
  rating_overview?: Record<string, { count: number; total: number; percent: number }>
  rating_question_overview?: Record<string, Record<string, { count: number; total: number; percent: number }>>
  rating_section_overview?: Array<{
    section_id: number | null
    title: string
    order?: number
    ratings: Record<string, { count: number; total: number; percent: number }>
  }>
  gender?: {
    question_id: number
    question: string
    counts: { male: number; female: number }
    total: number
    percent: { male: number; female: number }
  } | null
  education?: {
    question_id: number
    question: string
    counts: Record<string, number>
    total: number
    percent: Record<string, number>
  } | null
  age?: {
    question_id: number
    question: string
    counts: Record<string, number>
    total: number
    percent: Record<string, number>
  } | null
  filters?: { region?: string | null }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [region, setRegion] = useState<string>('')
  const [surveys, setSurveys] = useState<AdminSurvey[]>([])
  const [surveyQuery, setSurveyQuery] = useState<string>('')
  const [budgetYear, setBudgetYear] = useState<string>('')
  const [surveyId, setSurveyId] = useState<number | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const tooltipContentStyle = isDark
    ? { backgroundColor: 'rgb(15 23 42)', border: '1px solid rgb(51 65 85)', color: 'rgb(241 245 249)' }
    : undefined
  const tooltipLabelStyle = isDark ? { color: 'rgb(226 232 240)' } : undefined
  const tooltipItemStyle = isDark ? { color: 'rgb(241 245 249)' } : undefined

  // Load dashboard data when filters change
  useEffect(() => {
    setLoading(true)
    const params: any = {}
    if (region) params.region = region
    if (surveyId != null) params.survey = surveyId
    if (fromDate) params.from = fromDate
    if (toDate) params.to = toDate
    fetchDashboardWithParams(Object.keys(params).length ? params : undefined)
      .then((res) => setData(res))
      .catch((e) => setError(e?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [region, surveyId, fromDate, toDate])

  // Load surveys for selection with server-side filters (name and budget year)
  useEffect(() => {
    const params: any = {}
    if (surveyQuery) params.q = surveyQuery
    if (budgetYear) {
      const by = Number(budgetYear)
      if (Number.isFinite(by)) params.budget_year = by
    }
    listSurveys(params).then(setSurveys).catch(() => {})
  }, [surveyQuery, budgetYear])

  const regionOptions = (lang === 'am' ? (RegionsAm as any) : (RegionsEn as any)) as Array<{ value: string; title: string }>

  if (loading) return <div className="p-6">Loading dashboard...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!data) return <div className="p-6">No data.</div>

  const stripHtml = (html?: string | null) => {
    const raw = (html ?? '').toString()
    return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const chartData = (data.averages || []).map(a => ({ name: stripHtml(a.question), value: a.avg_rating ?? 0 }))
  const lineData = (data.timeseries || []).map(p => ({ label: new Date(p.date).toLocaleDateString(), value: p.count, dateISO: p.date }))

  const genderLabelMale = lang === 'am' ? 'ወንድ' : 'Male'
  const genderLabelFemale = lang === 'am' ? 'ሴት' : 'Female'
  const genderData = data.gender
    ? [
        { name: genderLabelMale, value: data.gender.counts?.male ?? 0, percent: data.gender.percent?.male ?? 0 },
        { name: genderLabelFemale, value: data.gender.counts?.female ?? 0, percent: data.gender.percent?.female ?? 0 },
      ]
    : []
  const genderColors = ['#3B82F6', '#EC4899']

  const ageLabel = lang === 'am' ? 'እድሜ' : 'Age'
  const ageData = data.age
    ? Object.entries(data.age.counts || {}).map(([name, value]) => ({
        name,
        value: (value as number) ?? 0,
        percent: (data.age?.percent as any)?.[name] ?? 0,
      }))
    : []
  const ageColors = ['#60A5FA', '#F59E0B', '#10B981', '#F472B6', '#8B5CF6', '#F87171', '#22D3EE', '#34D399']

  const eduTitle = lang === 'am' ? 'የትምህርት ደረጃ' : 'Education Level'
  const percentLabel = lang === 'am' ? 'መቶኛ' : 'Percent'
  const countLabel = lang === 'am' ? 'ብዛት' : 'Count'
  const eduData = data.education
    ? Object.entries(data.education.percent || {}).map(([name, p]) => ({
        name,
        value: Number(p) || 0,
        label: `${Number(p) || 0}%`,
        count: (data.education?.counts as any)?.[name] ?? 0,
      }))
    : []
  const eduChartHeight = Math.max(200, Math.min(400, 40 * (eduData.length || 1) + 40))

  const noActiveSurvey = !data.survey
  const noResponses = (data.totals?.responses ?? 0) === 0

  const ratingOverview = data.rating_overview || {}
  const pct1 = ratingOverview['1']?.percent ?? 0
  const pct2 = ratingOverview['2']?.percent ?? 0
  const pct3 = ratingOverview['3']?.percent ?? 0
  const pct4 = ratingOverview['4']?.percent ?? 0
  const pct5 = ratingOverview['5']?.percent ?? 0

  const ratingQuestionOverview = data.rating_question_overview || {}
  const ratingSectionOverview = (data.rating_section_overview || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const fmtPct = (v: number) => `${Number.isFinite(v) ? v : 0}%`
  const fmtK = (v: number) => {
    const n = Number(v) || 0
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}m`
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
    return String(n)
  }

  const ratingSliceColors = isDark
    ? ['#7F1D1D', '#EF4444', '#94A3B8', '#4ADE80', '#14532D']
    : ['#B91C1C', '#DC2626', '#6B7280', '#16A34A', '#15803D']

  return (
    <div className="space-y-6">
      <div className="bg-white rounded border p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-2xl font-semibold">{t('dashboard.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/manage-surveys')}
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <ClipboardDocumentListIcon className="h-5 w-5 text-gray-700" />
              <span>Manage Surveys</span>
            </button>
            <button
              onClick={() => navigate('/admin/responses')}
              className="px-3 py-1.5 rounded bg-eeuLightBlue text-white hover:opacity-95 inline-flex items-center gap-2"
            >
              <InboxStackIcon className="h-5 w-5" />
              <span>View Responses</span>
            </button>
          </div>
        </div>
        {data.survey && (
          <div className="text-sm text-gray-600">
            {t('dashboard.active_survey')}: <SafeHtml html={data.survey.title} className="rte-content inline font-medium" />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Search name</label>
            <input
              value={surveyQuery}
              onChange={(e) => setSurveyQuery(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
              placeholder="Survey name"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Budget year</label>
            <input
              type="number"
              value={budgetYear}
              onChange={(e) => setBudgetYear(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
              placeholder="e.g. 2025"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Survey</label>
            <select
              value={surveyId ?? ''}
              onChange={(e) => setSurveyId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              <option value="">Active survey</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>{stripHtml(s.title)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950" />
          </div>
          <div className="flex items-end">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded border bg-white dark:bg-slate-950 text-sm dark:border-slate-800 w-full">
              <MapPinIcon className="h-5 w-5 text-gray-600 dark:text-slate-300" />
              <select
                className="flex-1 bg-white dark:bg-slate-950 focus:outline-none text-gray-900 dark:text-slate-100"
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">All Regions</option>
                {regionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {noActiveSurvey && (
        <div className="bg-white rounded border p-8 text-center text-gray-700">
          <div className="text-6xl mb-3">📝</div>
          <div className="text-lg font-medium">{t('dashboard.no_active')}</div>
          <div className="text-sm">{t('dashboard.no_active_desc')}</div>
        </div>
      )}

      
      
      

      

      

      {ratingSectionOverview.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Rating % by Section</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ratingSectionOverview.map((sec) => {
              const r = sec.ratings || {}
              const spct1 = r['1']?.percent ?? 0
              const spct2 = r['2']?.percent ?? 0
              const spct3 = r['3']?.percent ?? 0
              const spct4 = r['4']?.percent ?? 0
              const spct5 = r['5']?.percent ?? 0
              const total = r['1']?.total ?? r['2']?.total ?? r['3']?.total ?? r['4']?.total ?? r['5']?.total ?? 0

              return (
                <div key={String(sec.section_id ?? 'null')} className="bg-white rounded border p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <SafeHtml html={sec.title || 'Untitled Section'} className="rte-content font-semibold leading-snug" />
                    <div className="text-xs text-gray-500">{total} ratings</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-600">{t('dashboard.rating_1')}</div>
                      <div className="text-xl font-bold mt-1 text-red-700">{fmtPct(spct1)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-600">{t('dashboard.rating_2')}</div>
                      <div className="text-xl font-bold mt-1 text-red-600">{fmtPct(spct2)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-600">{t('dashboard.rating_3')}</div>
                      <div className="text-xl font-bold mt-1 text-gray-700">{fmtPct(spct3)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-600">{t('dashboard.rating_4')}</div>
                      <div className="text-xl font-bold mt-1 text-green-600">{fmtPct(spct4)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-600">{t('dashboard.rating_5')}</div>
                      <div className="text-xl font-bold mt-1 text-green-700">{fmtPct(spct5)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {noResponses && (
        <div className="bg-white rounded border p-8 text-center text-gray-700">
          <div className="text-6xl mb-3">📭</div>
          <div className="text-lg font-medium">{t('dashboard.no_responses')}</div>
          <div className="text-sm">{t('dashboard.no_responses_desc')}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded border p-4">
          <div className="text-sm text-gray-600">{t('dashboard.total_responses')}</div>
          <div className="text-3xl font-bold mt-1">{data.totals?.responses ?? 0}</div>
        </div>
        <div className="bg-white rounded border p-4">
          <div className="text-sm text-gray-600">{t('dashboard.questions_rated')}</div>
          <div className="text-3xl font-bold mt-1">{data.averages?.length ?? 0}</div>
        </div>
        <div className="bg-white rounded border p-4">
          <div className="text-sm text-gray-600">{t('dashboard.recent_submissions')}</div>
          <div className="text-3xl font-bold mt-1">{data.recent?.length ?? 0}</div>
        </div>
      </div>

      <div className="bg-white rounded border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{t('dashboard.sentiment_overview')}</h3>
          <div className="text-xs text-gray-500">%</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-600">{t('dashboard.rating_1')}</div>
            <div className="text-2xl font-bold mt-1 text-red-700">{fmtPct(pct1)}</div>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-600">{t('dashboard.rating_2')}</div>
            <div className="text-2xl font-bold mt-1 text-red-600">{fmtPct(pct2)}</div>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-600">{t('dashboard.rating_3')}</div>
            <div className="text-2xl font-bold mt-1 text-gray-700">{fmtPct(pct3)}</div>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-600">{t('dashboard.rating_4')}</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{fmtPct(pct4)}</div>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-600">{t('dashboard.rating_5')}</div>
            <div className="text-2xl font-bold mt-1 text-green-700">{fmtPct(pct5)}</div>
          </div>
        </div>
      </div>

      {(data.averages?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Rating % by Question</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data.averages || []).map((q) => {
              const qOverview = ratingQuestionOverview[String(q.question_id)] || {}
              const qpct1 = qOverview['1']?.percent ?? 0
              const qpct2 = qOverview['2']?.percent ?? 0
              const qpct3 = qOverview['3']?.percent ?? 0
              const qpct4 = qOverview['4']?.percent ?? 0
              const qpct5 = qOverview['5']?.percent ?? 0

              const total =
                qOverview['1']?.total ??
                qOverview['2']?.total ??
                qOverview['3']?.total ??
                qOverview['4']?.total ??
                qOverview['5']?.total ??
                0

              const donutData = [
                { key: '1', name: t('dashboard.rating_1'), value: qpct1 },
                { key: '2', name: t('dashboard.rating_2'), value: qpct2 },
                { key: '3', name: t('dashboard.rating_3'), value: qpct3 },
                { key: '4', name: t('dashboard.rating_4'), value: qpct4 },
                { key: '5', name: t('dashboard.rating_5'), value: qpct5 },
              ]

              return (
                <div key={q.question_id} className="bg-white rounded border p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="font-semibold leading-snug">{stripHtml(q.question)}</div>
                    <div className="text-xs text-gray-500">{total} ratings</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="w-full h-56">
                      <ResponsiveContainer>
                        <PieChart>
                          <Tooltip
                            formatter={(value: any, name: any) => [`${Number(value) || 0}%`, name]}
                            contentStyle={tooltipContentStyle}
                            labelStyle={tooltipLabelStyle}
                            itemStyle={tooltipItemStyle}
                          />
                          <Pie
                            data={donutData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={2}
                            stroke="#ffffff"
                            strokeWidth={2}
                            isAnimationActive={false}
                          >
                            {donutData.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={ratingSliceColors[idx]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {donutData.map((d, idx) => (
                        <div key={d.key} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ratingSliceColors[idx] }}></span>
                            <span className="text-xs text-gray-700">{d.name}</span>
                          </div>
                          <div className="text-xs font-semibold text-gray-900 tabular-nums">{fmtPct(d.value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ChartCard
        title={t('dashboard.avg_ratings')}
        data={chartData}
        xLabelPrefix="Question"
        valueLabel="Avg Rating"
        allowDecimals
        yDomain={[1, 5]}
        yTicks={[1, 2, 3, 4, 5]}
      />

      {/* Sex and Age distributions */}
      {(data.gender || data.age) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.gender && (
            <div className="bg-white rounded border p-4">
              <h3 className="font-semibold mb-2">{lang === 'am' ? 'ጾታ' : 'Sex'}</h3>
              <div className="w-full h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${entry.name}: ${entry.percent}%`}
                    >
                      {genderData.map((_, idx) => (
                        <Cell key={idx} fill={genderColors[idx % genderColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, _name: any, props: any) => [value, 'Count']}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {data.age && (
            <div className="bg-white rounded border p-4">
              <h3 className="font-semibold mb-2">{ageLabel}</h3>
              <div className="w-full h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={ageData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${entry.name}: ${entry.percent}%`}
                    >
                      {ageData.map((_, idx) => (
                        <Cell key={idx} fill={ageColors[idx % ageColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, _name: any, props: any) => [value, 'Count']}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Education level horizontal bar (% on bars) placed below the pie charts */}
      {data.education && eduData.length > 0 && (
        <div className="bg-white rounded border p-4">
          <h3 className="font-semibold mb-2">{eduTitle}</h3>
          <div className="w-full" style={{ height: eduChartHeight }}>
            <ResponsiveContainer>
              <BarChart data={eduData} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tickCount={6} />
                <YAxis type="category" dataKey="name" width={180} interval={0} />
                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [
                    `${value}% (${countLabel}: ${props?.payload?.count ?? 0})`,
                    percentLabel,
                  ]}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="value" name={percentLabel} fill="#10B981" radius={[4, 4, 4, 4]}>
                  <LabelList dataKey="label" position="right" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Responses over time (line chart) */}
      <div className="bg-white rounded border p-4">
        <h3 className="font-semibold mb-2">{t('dashboard.responses_over_time')}</h3>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <LineChart data={lineData}>
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} tickFormatter={fmtK} tickCount={5} />
              <Tooltip
                formatter={(value: any) => [value, 'Responses']}
                labelFormatter={(label: any) => `Date: ${label}`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend />
              <Line name="Responses" type="monotone" dataKey="value" stroke="#00D1FF" strokeWidth={2} dot={false} activeDot={{ r: 4, onClick: (props: any) => {
                const d = props?.payload?.dateISO as string | undefined
                if (!d) return
                const day = new Date(d)
                const y = day.getFullYear()
                const m = String(day.getMonth()+1).padStart(2,'0')
                const da = String(day.getDate()).padStart(2,'0')
                const dateStr = `${y}-${m}-${da}`
                const params = new URLSearchParams()
                params.set('from', dateStr)
                params.set('to', dateStr)
                if (data?.survey?.id) params.set('survey', String(data.survey.id))
                navigate(`/admin/responses?${params.toString()}`)
              }}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rating distributions per question */}
      <div className="space-y-3">
        <h3 className="font-semibold">{t('dashboard.rating_distributions')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data.distributions ? Object.entries(data.distributions) : []).map(([qid, counts]) => {
            const avgMeta = data.averages?.find(a => String(a.question_id) === String(qid))
            const distData = [1,2,3,4,5].map(n => ({ name: String(n), value: (counts as any)[String(n)] ?? (counts as any)[n] ?? 0 }))
            return (
              <ChartCard
                key={qid}
                title={avgMeta ? avgMeta.question : `Question ${qid}`}
                data={distData}
                valueLabel="Responses"
                yTickFormatter={fmtK}
                yTickCount={5}
                onBarClick={(entry) => {
                  const rating = parseInt(entry.name, 10)
                  if (!Number.isFinite(rating)) return
                  const params = new URLSearchParams()
                  params.set('question', String(qid))
                  params.set('rating_min', String(rating))
                  params.set('rating_max', String(rating))
                  if (data?.survey?.id) params.set('survey', String(data.survey.id))
                  navigate(`/admin/responses?${params.toString()}`)
                }}
              />
            )
          })}
          {(!data.distributions || Object.keys(data.distributions).length === 0) && (
            <div className="text-gray-600 flex items-center justify-center h-40 bg-gray-50 rounded">{t('dashboard.no_rating_q')}</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded border p-4">
        <h3 className="font-semibold mb-2">Recent</h3>
        <ul className="text-sm divide-y">
          {(data.recent || []).map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between">
              <span>Response #{r.id}</span>
              <span className="text-gray-600">{new Date(r.submitted_at).toLocaleString()}</span>
            </li>
          ))}
          {data.recent?.length === 0 && <li className="py-2 text-gray-600">No recent submissions</li>}
        </ul>
      </div>
    </div>
  )
}
