import axiosClient from './axiosClient'

export type SurveyQuestionType = 'rating' | 'text' | 'regions' | 'dropdown' | 'multiple_choice' | 'linear_scale' | 'paragraph'

export type LinearScaleLabels = {
  1: string
  2: string
  3: string
  4: string
  5: string
}

export type ActiveSurvey = {
  id: number
  title: string
  description?: string
  header_title?: string
  header_subtitle?: string
  language?: 'en' | 'am'
  has_responded?: boolean
  client_ip?: string
  admin_bypass?: boolean
  sections?: Array<{
    id: number | null
    title: string
    description?: string
    order?: number
    questions: Array<{
      id: number
      text: string
      question_type: SurveyQuestionType
      required?: boolean
      options?: string
      scale_min_label?: string
      scale_max_label?: string
      labels?: LinearScaleLabels
      displayStyle?: 'stars' | 'emojis' | 'numbers'
      maxChars?: number
    }>
  }>
  questions: Array<{
    id: number
    text: string
    question_type: SurveyQuestionType
    required?: boolean
    options?: string
    scale_min_label?: string
    scale_max_label?: string
    labels?: LinearScaleLabels
    displayStyle?: 'stars' | 'emojis' | 'numbers'
    maxChars?: number
  }>
}

export async function getActiveSurvey(): Promise<ActiveSurvey | null> {
  const res = await axiosClient.get('/api/survey/active/')
  return res.data || null
}

export type SubmitSurveyPayload = {
  survey: number
  answers: Array<{
    question: number
    rating?: number
    comment?: string
    choice?: string
  }>
}

export async function submitSurvey(payload: SubmitSurveyPayload): Promise<{ ok: boolean }> {
  const res = await axiosClient.post('/api/survey/submit/', payload)
  return res.data
}

export type CheckAttemptsResponse = {
  allowed: boolean
  unlimited?: boolean
  fallback?: boolean
}

export async function checkAttempts(surveyId: number, fingerprint: string): Promise<CheckAttemptsResponse> {
  const res = await axiosClient.post('/api/check-attempts/', { survey_id: surveyId, fingerprint })
  return res.data
}

export async function incrementAttempt(surveyId: number, fingerprint: string): Promise<{ ok: boolean; ignored?: boolean; fallback?: boolean }> {
  const res = await axiosClient.post('/api/increment-attempt/', { survey_id: surveyId, fingerprint })
  return res.data
}
