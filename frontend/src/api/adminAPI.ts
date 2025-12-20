import axiosClient from './axiosClient'

// Roles used across the admin portal
export type AdminRole = 'super_admin' | 'survey_designer' | 'viewer'

export type AdminUser = {
  id: number
  username: string
  full_name?: string
  role: AdminRole
}

export type AdminLoginResponse = {
  access: string
  refresh?: string
  user: AdminUser
}

// Example expected login response shape from the backend:
// {
//   "access": "<jwt>",
//   "refresh": "<jwt>",
//   "user": {
//     "id": 1,
//     "username": "tsegaye",
//     "full_name": "Tsegaye A.",
//     "role": "super_admin"
//   }
// }
export async function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  const res = await axiosClient.post('/api/admin/login/', { username, password })
  return res.data
}

export async function fetchDashboard() {
  const res = await axiosClient.get('/api/admin/dashboard/')
  return res.data
}

export type DashboardQuery = {
  region?: string
}

export async function fetchDashboardWithParams(params?: DashboardQuery) {
  const res = await axiosClient.get('/api/admin/dashboard/', { params })
  return res.data
}

export async function changePassword(current_password: string, new_password: string): Promise<{ detail: string }> {
  const res = await axiosClient.post('/api/admin/change-password/', { current_password, new_password })
  return res.data
}

// Admin user management
export type AdminUserListResponse = {
  results: AdminUser[]
}

export type CreateAdminUserInput = {
  username: string
  password: string
  role: AdminRole
}

export type UpdateAdminUserInput = {
  username?: string
  role?: AdminRole
}

export async function listAdminUsers(): Promise<AdminUserListResponse> {
  const res = await axiosClient.get('/api/admin/users/')
  return res.data
}

export async function createAdminUser(payload: CreateAdminUserInput): Promise<AdminUser> {
  const res = await axiosClient.post('/api/admin/users/', payload)
  return res.data
}

export async function updateAdminUser(id: number, payload: UpdateAdminUserInput): Promise<AdminUser> {
  const res = await axiosClient.patch(`/api/admin/users/${id}/`, payload)
  return res.data
}

export async function deleteAdminUser(id: number): Promise<void> {
  await axiosClient.delete(`/api/admin/users/${id}/`)
}

export async function resetAdminUserPassword(id: number, new_password: string): Promise<{ detail: string }> {
  const res = await axiosClient.post(`/api/admin/users/${id}/reset-password/`, { new_password })
  return res.data
}

// Types
export type QuestionType = 'rating' | 'text' | 'regions' | 'dropdown' | 'multiple_choice' | 'linear_scale' | 'paragraph'

export type LinearScaleLabels = {
  1: string
  2: string
  3: string
  4: string
  5: string
}

export type AdminSurveyQuestion = {
  id: number
  text: string
  question_type: QuestionType
  order?: number
  required?: boolean
  options?: string
  scale_min_label?: string
  scale_max_label?: string
  labels?: LinearScaleLabels
  displayStyle?: 'stars' | 'emojis' | 'numbers'
  maxChars?: number
}

export type AdminSurveySection = {
  id: number | null
  title: string
  description?: string
  order?: number
  questions: AdminSurveyQuestion[]
}

export type AdminSurvey = {
  id: number
  title: string
  description?: string
  header_title?: string
  header_subtitle?: string
  is_active: boolean
  created_at: string
  sections?: AdminSurveySection[]
  questions: AdminSurveyQuestion[]
}

export type CreateSurveyInput = {
  title: string
  description?: string
  header_title?: string
  header_subtitle?: string
  is_active?: boolean
  sections?: Array<{
    id?: number
    title: string
    description?: string
    order?: number
    questions?: Array<{
      id?: number
      text: string
      question_type: QuestionType
      order?: number
      required?: boolean
      options?: string
      scale_min_label?: string
      scale_max_label?: string
      labels?: LinearScaleLabels
      displayStyle?: 'stars' | 'emojis' | 'numbers'
      maxChars?: number
    }>
  }>
  questions?: Array<{
    id?: number
    text: string
    question_type: QuestionType
    order?: number
    required?: boolean
    options?: string
    scale_min_label?: string
    scale_max_label?: string
    labels?: LinearScaleLabels
    displayStyle?: 'stars' | 'emojis' | 'numbers'
    maxChars?: number
  }>
}

export async function listSurveys(): Promise<AdminSurvey[]> {
  const res = await axiosClient.get('/api/admin/surveys/')
  return res.data
}

export async function createSurvey(payload: CreateSurveyInput): Promise<AdminSurvey> {
  const res = await axiosClient.post('/api/admin/surveys/', payload)
  return res.data
}

export async function updateSurvey(id: number, payload: Partial<CreateSurveyInput>): Promise<AdminSurvey> {
  const res = await axiosClient.patch(`/api/admin/surveys/${id}/`, payload)
  return res.data
}

export async function deleteSurvey(id: number): Promise<void> {
  await axiosClient.delete(`/api/admin/surveys/${id}/`)
}

export async function activateSurvey(id: number): Promise<{ ok: boolean }> {
  const res = await axiosClient.post(`/api/admin/surveys/${id}/activate/`)
  return res.data
}

// Responses
export type AdminAnswer = {
  question_id: number
  question: string
  type: QuestionType
  rating?: number | null
  comment?: string
  choice?: string
}

export type AdminResponseItem = {
  id: number
  submitted_at: string
  survey: { id: number; title: string }
  answers: AdminAnswer[]
}

export type ResponsesQuery = {
  survey?: number
  from?: string
  to?: string
  question?: number
  rating_min?: number
  rating_max?: number
  page?: number
  page_size?: number
}

export async function listResponses(params: ResponsesQuery): Promise<{ count: number; page: number; page_size: number; results: AdminResponseItem[] }>{
  const res = await axiosClient.get('/api/admin/responses/', { params })
  return res.data
}

export async function exportResponsesExcel(params: ResponsesQuery): Promise<Blob> {
  const res = await axiosClient.get('/api/admin/responses/export.xlsx', { params, responseType: 'blob' })
  return res.data
}

export async function exportResponsesPdf(params: ResponsesQuery): Promise<Blob> {
  const res = await axiosClient.get('/api/admin/responses/export.pdf', { params, responseType: 'blob' })
  return res.data
}
