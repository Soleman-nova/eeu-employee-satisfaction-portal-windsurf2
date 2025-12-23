import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { checkAttempts, getActiveSurvey, incrementAttempt, submitSurvey, type ActiveSurvey, type SurveyQuestionType } from '@/api/surveyAPI'
import TextQuestion from '@/components/TextQuestion'
import LinearScaleQuestion from '@/components/LinearScaleQuestion'
import RatingQuestion from '@/components/RatingQuestion'
import RegionDropdownQuestion from '@/components/RegionDropdownQuestion'
import SafeHtml from '@/components/SafeHtml'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { generateFingerprint } from '@/utils/fingerprint'

export default function SurveyPage() {
  const [loading, setLoading] = useState(true)
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null)
  const [answers, setAnswers] = useState<Record<number, { rating?: number; comment?: string; choice?: string }>>({})
  const [missingRequired, setMissingRequired] = useState<Record<number, boolean>>({})
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const { t, lang, setLang } = useI18n()
  const prevLangRef = useRef(lang)
  const { role } = useAuth()
  const isAdminRole = role === 'super_admin' || role === 'survey_designer' || role === 'viewer'
  const fingerprintRef = useRef<string | null>(null)

  useEffect(() => {
    // For now, preview and normal survey both use the active survey endpoint.
    // If in future we support historical survey preview by ID, we can branch here.
    getActiveSurvey().then((data) => {
      setSurvey(data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const run = async () => {
      if (loading) return
      if (!survey) return

      const isPreview = Boolean(params.id) || new URLSearchParams(location.search).has('preview')
      if (isPreview) return

      // Completely exempt admin roles from tracking/limits.
      if (isAdminRole) return

      // Backend provides IP (no need to expose it in the browser, but we include it in the fingerprint input).
      const ip = (survey as any)?.client_ip as string | undefined

      let fp: string | null = null
      try {
        fp = await generateFingerprint(ip)
      } catch {
        fp = null
      }

      if (fp) {
        fingerprintRef.current = fp

        // LocalStorage fallback still applied even when backend is used.
        // Scope attempts to survey id so limits reset when a different survey is activated.
        const localKey = `eeu_survey_attempts_${survey.id}_${fp}`
        const localAttempts = Number(localStorage.getItem(localKey) || '0')
        if (localAttempts >= 2) {
          navigate('/thank-you', {
            replace: true,
            state: {
              message: 'Thank you for your feedback! This survey is limited to two responses per person.',
              variant: 'limit',
            },
          })
          return
        }

        try {
          const res = await checkAttempts(survey.id, fp)
          if (res?.allowed === false) {
            navigate('/thank-you', {
              replace: true,
              state: {
                message: 'Thank you for your feedback! This survey is limited to two responses per person.',
                variant: 'limit',
              },
            })
            return
          }
        } catch {
          // If backend check fails, we still allow access but rely on localStorage enforcement.
        }

        return
      }

      // Fingerprint generation failed: fall back to a generic localStorage key.
      const fallbackKey = `eeu_survey_attempts_fallback_${survey.id}`
      const localAttempts = Number(localStorage.getItem(fallbackKey) || '0')
      if (localAttempts >= 2) {
        navigate('/thank-you', {
          replace: true,
          state: {
            message: 'Thank you for your feedback! This survey is limited to two responses per person.',
            variant: 'limit',
          },
        })
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, survey, isAdminRole])

  useEffect(() => {
    if (!survey?.language) return
    if (survey.language === lang) return
    prevLangRef.current = lang
    setLang(survey.language)
    return () => {
      setLang(prevLangRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.language])

  const isPreview = Boolean(params.id) || new URLSearchParams(location.search).has('preview')

  const isAnswered = (q: { id: number; question_type: SurveyQuestionType }, ans: { rating?: number; comment?: string; choice?: string }) => {
    if (q.question_type === 'rating' || q.question_type === 'linear_scale') {
      return ans.rating != null
    }
    if (q.question_type === 'dropdown' || q.question_type === 'multiple_choice' || q.question_type === 'regions') {
      return Boolean(ans.choice?.trim())
    }
    return Boolean(ans.comment?.trim())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!survey) return

    if (isPreview) {
      // In preview mode, don't submit to backend – just close preview
      navigate(-1)
      return
    }

    // Validate all required questions are answered
    const missingAnswers = []
    for (const q of survey.questions) {
      if (q.required !== true) continue
      
      const ans = answers[q.id] || {}
      if (!isAnswered(q, ans)) {
        missingAnswers.push(q.id)
      }
    }
    
    if (missingAnswers.length > 0) {
      const nextMissing: Record<number, boolean> = {}
      for (const id of missingAnswers) nextMissing[id] = true
      setMissingRequired(nextMissing)

      // Scroll to the first missing question card
      const firstId = missingAnswers[0]
      requestAnimationFrame(() => {
        const el = document.getElementById(`q-${firstId}`)
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
      return
    }

    // Clear previous required-errors if everything is valid now
    if (Object.keys(missingRequired).length > 0) {
      setMissingRequired({})
    }

    // Defensive: enforce text length limits (maxlength should prevent this anyway)
    for (const q of survey.questions) {
      if (q.question_type !== 'text' && q.question_type !== 'paragraph') continue
      const ans = answers[q.id] || {}
      const text = (ans.comment || '').toString()
      const limit = q.question_type === 'text' ? 300 : 500
      if (text.length > limit) {
        alert(`Answer is too long. Maximum ${limit} characters allowed.`)
        return
      }
    }

    try {
      const payload = {
        survey: survey.id,
        answers: Object.entries(answers).map(([qid, a]) => ({ question: Number(qid), ...a }))
      }
      console.log('Submitting payload:', payload)
      await submitSurvey(payload)

      // Increment attempt count only for non-admin respondents.
      if (!isAdminRole) {
        const ip = (survey as any)?.client_ip as string | undefined
        let fp = fingerprintRef.current
        if (!fp) {
          try {
            fp = await generateFingerprint(ip)
            fingerprintRef.current = fp
          } catch {
            fp = null
          }
        }

        if (fp) {
          const localKey = `eeu_survey_attempts_${survey.id}_${fp}`
          const localAttempts = Number(localStorage.getItem(localKey) || '0')
          localStorage.setItem(localKey, String(localAttempts + 1))
          try {
            await incrementAttempt(survey.id, fp)
          } catch {
            // ignore
          }
        } else {
          const fallbackKey = `eeu_survey_attempts_fallback_${survey.id}`
          const localAttempts = Number(localStorage.getItem(fallbackKey) || '0')
          localStorage.setItem(fallbackKey, String(localAttempts + 1))
        }
      }

      navigate('/thank-you')
    } catch (error) {
      console.error('Submit error:', error)
      // You could show an error message to the user here
      alert('Failed to submit survey. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-white dark:bg-slate-950 text-gray-600 dark:text-slate-300 text-sm">
        Loading survey...
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-white dark:bg-slate-950 text-gray-700 dark:text-slate-300 text-sm">
        No active survey is available at the moment.
      </div>
    )
  }

  const ratingLabels = [
    'Very Dissatisfied',
    'Dissatisfied',
    'Neutral',
    'Satisfied',
    'Very Satisfied',
  ]

  const getOptions = (options?: string) =>
    (options || '')
      .split('\n')
      .map(o => o.trim())
      .filter(Boolean)

  const allQuestions = (survey.sections && survey.sections.length > 0)
    ? survey.sections.flatMap(s => s.questions || [])
    : survey.questions

  const totalQuestions = allQuestions.length

  const answeredQuestions = allQuestions.reduce((count, q) => {
    const ans = answers[q.id] || {}
    if (q.question_type === 'rating' || q.question_type === 'linear_scale') {
      return ans.rating != null ? count + 1 : count
    }
    if (q.question_type === 'dropdown' || q.question_type === 'multiple_choice' || q.question_type === 'regions') {
      return ans.choice && ans.choice.trim().length > 0 ? count + 1 : count
    }
    // text / paragraph
    return ans.comment && ans.comment.trim().length > 0 ? count + 1 : count
  }, 0)

  const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0

  const renderSections = (survey.sections && survey.sections.length > 0)
    ? survey.sections
    : [{ id: null, title: '', description: '', questions: survey.questions }]

  let questionNumber = 0

  // Paging model: currently a single-page survey, but this can be extended later.
  const totalPages = 1
  const currentPage = 1
  const isLastPage = currentPage >= totalPages

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-[#DADCE0] dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col items-center text-center">
          <img src="/eeu_logo.png" alt="EEU logo" className="w-30 h-20 mb-3" />
          <SafeHtml
            html={survey?.header_title || survey?.title || t('survey.header_title')}
            className="rte-content text-2xl md:text-3xl font-semibold text-gray-900 dark:text-slate-100"
          />
          <SafeHtml
            html={survey?.header_subtitle || survey?.description || t('survey.header_subtitle')}
            className="rte-content mt-1 text-sm md:text-base text-gray-700 dark:text-slate-300"
          />
          {isPreview && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DADCE0] dark:border-slate-700 bg-[#F8F9FA] dark:bg-slate-900 px-3 py-1 text-xs text-[#5F6368] dark:text-slate-300">
              <span></span>
              <span>{t('survey.preview_banner')}</span>
            </div>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="border-b border-[#DADCE0] dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 bg-white dark:bg-slate-950">
          <div className="h-2 rounded-full bg-[#DADCE0] dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: '#006400',
                boxShadow: '0 0 10px rgba(0,100,0,0.6)',
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 bg-white dark:bg-slate-950">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Title block similar to Google Forms card */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#DADCE0] dark:border-slate-700 shadow-sm px-5 py-4">
            <SafeHtml html={survey.title} className="rte-content text-lg font-semibold mb-1 text-gray-900 dark:text-slate-100" />
            {survey.description && <SafeHtml html={survey.description} className="rte-content text-sm text-gray-700 dark:text-slate-300" />}
          </section>

          {/* Sections + Questions */}
          {renderSections.map((sec: any, secIdx: number) => (
            <React.Fragment key={sec.id ?? `sec-${secIdx}`}>
              {(sec.title || sec.description) ? (
                <section className="rounded-xl border shadow-sm px-5 py-4 bg-[rgba(0,100,0,0.05)] border-[rgba(0,100,0,0.18)]">
                  {sec.title ? <SafeHtml html={sec.title} className="rte-content text-base font-semibold text-gray-900 dark:text-slate-100" /> : null}
                  {sec.description ? <SafeHtml html={sec.description} className="rte-content text-sm mt-1 text-gray-700 dark:text-slate-300" /> : null}
                </section>
              ) : null}

              {(sec.questions || []).map((q: any) => (
                <section
                  key={q.id}
                  id={`q-${q.id}`}
                  className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm px-5 py-4 ${missingRequired[q.id] ? 'border-red-500' : 'border-[#DADCE0] dark:border-slate-700'}`}
                >
                  <div className="flex items-start gap-1 mb-3">
                    <p className="text-sm md:text-base font-medium text-[#202124] dark:text-slate-100">
                      {++questionNumber}. {q.text}
                    </p>
                    {q.required ? (
                      <span className="text-xs font-semibold ml-1" style={{ color: '#FF6200' }}>*</span>
                    ) : null}
                  </div>

              {missingRequired[q.id] && q.required && (
                <div className="text-sm text-red-600 mb-2">This question is required.</div>
              )}

              {q.question_type === 'rating' ? (
                <RatingQuestion
                  labels={
                    (q.labels as any) ||
                    ({
                      1: q.scale_min_label || 'Very Dissatisfied',
                      2: 'Dissatisfied',
                      3: 'Neutral',
                      4: 'Satisfied',
                      5: q.scale_max_label || 'Very Satisfied',
                    } as any)
                  }
                  displayStyle={(q.displayStyle as any) || 'stars'}
                  value={answers[q.id]?.rating ?? null}
                  onChange={(value) =>
                    setAnswers(prev => {
                      const next = {
                        ...prev,
                        [q.id]: { ...prev[q.id], rating: value },
                      }
                      const nextAns = next[q.id] || {}
                      if (q.required && missingRequired[q.id] && isAnswered(q, nextAns)) {
                        setMissingRequired(m => {
                          const copy = { ...m }
                          delete copy[q.id]
                          return copy
                        })
                      }
                      return next
                    })
                  }
                  required={q.required}
                />
              ) : q.question_type === 'linear_scale' ? (
                <LinearScaleQuestion
                  labels={
                    (q.labels as any) ||
                    ({
                      1: q.scale_min_label || 'Very Dissatisfied',
                      2: 'Dissatisfied',
                      3: 'Neutral',
                      4: 'Satisfied',
                      5: q.scale_max_label || 'Very Satisfied',
                    } as any)
                  }
                  value={answers[q.id]?.rating ?? null}
                  onChange={(value) =>
                    setAnswers(prev => {
                      const next = {
                        ...prev,
                        [q.id]: { ...prev[q.id], rating: value },
                      }
                      const nextAns = next[q.id] || {}
                      if (q.required && missingRequired[q.id] && isAnswered(q, nextAns)) {
                        setMissingRequired(m => {
                          const copy = { ...m }
                          delete copy[q.id]
                          return copy
                        })
                      }
                      return next
                    })
                  }
                  required={q.required}
                />
              ) : q.question_type === 'regions' ? (
                <RegionDropdownQuestion
                  value={answers[q.id]?.choice ?? ''}
                  onChange={(value) =>
                    setAnswers(prev => {
                      const next = {
                        ...prev,
                        [q.id]: { ...prev[q.id], choice: value },
                      }
                      const nextAns = next[q.id] || {}
                      if (q.required && missingRequired[q.id] && isAnswered(q, nextAns)) {
                        setMissingRequired(m => {
                          const copy = { ...m }
                          delete copy[q.id]
                          return copy
                        })
                      }
                      return next
                    })
                  }
                  required={q.required}
                  placeholder={t('manage.builder_type_regions')}
                />
              ) : q.question_type === 'dropdown' ? (
                <div className="mt-1">
                  <select
                    className="w-full border border-[#DADCE0] dark:border-slate-700 rounded-md px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-1 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100"
                    value={answers[q.id]?.choice ?? ''}
                    onChange={(e) =>
                      setAnswers(prev => {
                        const next = {
                          ...prev,
                          [q.id]: { ...prev[q.id], choice: e.target.value },
                        }
                        const nextAns = next[q.id] || {}
                        if (q.required && missingRequired[q.id] && isAnswered(q, nextAns)) {
                          setMissingRequired(m => {
                            const copy = { ...m }
                            delete copy[q.id]
                            return copy
                          })
                        }
                        return next
                      })
                    }
                    required={q.required}
                  >
                    <option value="" disabled>Select an option</option>
                    {getOptions(q.options).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ) : q.question_type === 'multiple_choice' ? (
                <div className="mt-1 flex flex-col gap-2">
                  {getOptions(q.options).map(opt => {
                    const selected = answers[q.id]?.choice === opt
                    return (
                      <label
                        key={opt}
                        className="flex items-center gap-3 cursor-pointer text-sm md:text-base text-[#3C4043] dark:text-slate-200"
                      >
                        <span
                          className="inline-flex items-center justify-center rounded-full border w-4 h-4"
                          style={{
                            borderColor: selected ? '#006400' : '#5F6368',
                            boxShadow: selected ? '0 0 0 3px rgba(0,100,0,0.15)' : 'none',
                          }}
                        >
                          <span
                            className="rounded-full"
                            style={{
                              width: selected ? 8 : 0,
                              height: selected ? 8 : 0,
                              backgroundColor: '#006400',
                              transition: 'all 0.15s ease-out',
                            }}
                          ></span>
                        </span>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          className="sr-only"
                          value={opt}
                          checked={answers[q.id]?.choice === opt}
                          onChange={() =>
                            setAnswers(prev => {
                              const next = {
                                ...prev,
                                [q.id]: { ...prev[q.id], choice: opt },
                              }
                              const nextAns = next[q.id] || {}
                              if (q.required && missingRequired[q.id] && isAnswered(q, nextAns)) {
                                setMissingRequired(m => {
                                  const copy = { ...m }
                                  delete copy[q.id]
                                  return copy
                                })
                              }
                              return next
                            })
                          }
                          required={q.required}
                        />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <TextQuestion
                  type={q.question_type === 'paragraph' ? 'paragraph' : 'short'}
                  value={answers[q.id]?.comment ?? ''}
                  onChange={(value) =>
                    setAnswers(prev => {
                      const next = {
                        ...prev,
                        [q.id]: { ...prev[q.id], comment: value },
                      }
                      const nextAns = next[q.id] || {}
                      if (q.required && missingRequired[q.id] && isAnswered(q, nextAns)) {
                        setMissingRequired(m => {
                          const copy = { ...m }
                          delete copy[q.id]
                          return copy
                        })
                      }
                      return next
                    })
                  }
                  placeholder="Your comments"
                  error={Boolean(missingRequired[q.id] && q.required)}
                />
              )}
                </section>
              ))}
            </React.Fragment>
          ))}
          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-md border text-sm"
              style={{ borderColor: '#DADCE0', color: '#5F6368' }}
              onClick={() => navigate('/')}
            >
              {t('survey.action_back')}
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-md text-sm font-semibold text-white shadow-sm"
              style={{
                backgroundColor: '#006400',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0a7a0a'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#006400'
              }}
            >
              {isPreview
                ? t('survey.action_close_preview')
                : isLastPage
                ? t('survey.action_submit')
                : t('survey.action_next')}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DADCE0] dark:border-slate-800 bg-[#F8F9FA] dark:bg-slate-950 mt-4">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-[#5F6368] dark:text-slate-400">
          <span>
            {t('survey.footer_page')} {currentPage} {t('survey.footer_of')} {totalPages}
          </span>
          <span>© {new Date().getFullYear()} EEU</span>
        </div>
      </footer>
    </div>
  )
}
