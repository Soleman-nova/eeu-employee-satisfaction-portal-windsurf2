import React, { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  listSurveys,
  createSurvey,
  deleteSurvey,
  activateSurvey,
  updateSurvey,
  type AdminSurvey,
  type CreateSurveyInput,
  type QuestionType,
  type LinearScaleLabels,
} from '@/api/adminAPI'
import { useI18n } from '@/context/I18nContext'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from '@/components/RichTextEditor'
import { PencilSquareIcon, PowerIcon, TrashIcon } from '@heroicons/react/24/outline'

type NewQuestion = {
  id: string
  backendId?: number
  text: string
  question_type: QuestionType
  required?: boolean
  options?: string
  scale_min_label?: string
  scale_max_label?: string
  labels?: LinearScaleLabels
  displayStyle?: 'stars' | 'emojis' | 'numbers'
  maxChars?: number
}

type NewSection = {
  id: string
  backendId?: number
  title: string
  description?: string
  collapsed?: boolean
  questions: NewQuestion[]
}

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const defaultSection = (): NewSection => ({
  id: `sec-${uid()}`,
  title: 'Untitled Section',
  description: '',
  collapsed: false,
  questions: [],
})

const getMaxCharsForType = (type: QuestionType) => {
  if (type === 'text') return 300
  if (type === 'paragraph') return 500
  return undefined
}

const defaultLinearScaleLabels = {
  1: 'Very Dissatisfied',
  2: 'Dissatisfied',
  3: 'Neutral',
  4: 'Satisfied',
  5: 'Very Satisfied',
}

const defaultRatingLabels: LinearScaleLabels = {
  1: 'Very Dissatisfied',
  2: 'Dissatisfied',
  3: 'Neutral',
  4: 'Satisfied',
  5: 'Very Satisfied',
}

 const stripHtml = (html?: string | null) => {
   const raw = (html ?? '').toString()
   return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
 }

 const normalizeRichText = (html?: string | null) => {
   const raw = (html ?? '').toString()
   const text = stripHtml(raw)
   return text.length === 0 ? '' : raw
 }

 const SortableQuestionCard: React.FC<{
   mode: 'create' | 'edit'
   sectionId: string
   q: NewQuestion
   t: (key: string) => string
   updateQuestion: (mode: 'create' | 'edit', sectionId: string, questionId: string, patch: Partial<NewQuestion>) => void
   removeQuestion: (mode: 'create' | 'edit', sectionId: string, questionId: string) => void
 }> = ({ mode, sectionId, q, t, updateQuestion, removeQuestion }) => {
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
     id: q.id,
     data: { type: 'question', sectionId },
   })
   const style: React.CSSProperties = {
     transform: CSS.Transform.toString(transform),
     transition,
     opacity: isDragging ? 0.6 : 1,
   }

   const isEmpty = q.text.trim().length === 0
   const optionsVisible = q.question_type === 'dropdown' || q.question_type === 'multiple_choice'
   const scaleVisible = q.question_type === 'linear_scale'
   const ratingVisible = q.question_type === 'rating'

   return (
     <div ref={setNodeRef} style={style} className="rounded-xl border border-[#DADCE0] bg-[#F8F9FA] px-4 py-3 flex flex-col gap-2">
       <div className="flex items-start justify-between gap-2">
         <div className="flex items-start gap-2 flex-1">
           <span className="cursor-move select-none px-2 py-1 text-gray-500" {...attributes} {...listeners} title="Drag question">⠿</span>
           <div className="flex-1">
             <input
               value={q.text}
               onChange={e => updateQuestion(mode, sectionId, q.id, { text: e.target.value })}
               placeholder="Question text"
               className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 ${isEmpty ? 'border-red-500' : 'border-[#DADCE0]'}`}
             />
             {isEmpty && <div className="text-xs text-red-600 mt-1">Question text is required</div>}
             <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#5F6368]">
               <select
                 value={q.question_type}
                 onChange={e => updateQuestion(mode, sectionId, q.id, { question_type: e.target.value as any, maxChars: getMaxCharsForType(e.target.value as any) })}
                 className="border border-[#DADCE0] rounded px-2 py-1 text-xs bg-white"
               >
                 <option value="dropdown">{t('manage.builder_type_dropdown')}</option>
                 <option value="multiple_choice">{t('manage.builder_type_multiple_choice')}</option>
                 <option value="regions">{t('manage.builder_type_regions')}</option>
                 <option value="linear_scale">{t('manage.builder_type_linear_scale')}</option>
                 <option value="paragraph">{t('manage.builder_type_paragraph')}</option>
                 <option value="rating">{t('manage.builder_type_rating')}</option>
                 <option value="text">{t('manage.builder_type_text')}</option>
               </select>
               <label className="inline-flex items-center gap-1">
                 <input
                   type="checkbox"
                   checked={q.required ?? true}
                   onChange={e => updateQuestion(mode, sectionId, q.id, { required: e.target.checked })}
                 />
                 <span style={{ color: '#FF6200' }}>{t('manage.builder_required')}</span>
               </label>
             </div>
           </div>
         </div>
         <div className="flex flex-col items-end gap-1 text-xs">
           <button type="button" className="px-2 py-1 rounded border border-red-200 text-red-600" onClick={() => removeQuestion(mode, sectionId, q.id)}>
             {t('manage.remove')}
           </button>
         </div>
       </div>

       {optionsVisible && (
         <div className="mt-2">
           <label className="block text-xs text-gray-600 mb-1">{t('manage.builder_options_label')}</label>
           <textarea
             className="w-full border border-[#DADCE0] rounded px-3 py-2 text-xs focus:outline-none focus:ring-1"
             rows={3}
             value={q.options ?? ''}
             onChange={e => updateQuestion(mode, sectionId, q.id, { options: e.target.value })}
             placeholder={t('manage.builder_options_placeholder')}
           />
         </div>
       )}

       {scaleVisible && (
         <div className="mt-3">
           <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
             {[1, 2, 3, 4, 5].map((n) => (
               <div key={n}>
                 <label className="block text-gray-600 mb-1">Label for {n}</label>
                 <input
                   className="w-full border border-[#DADCE0] rounded px-2 py-1"
                   value={((q as any).labels?.[n] ?? '') as any}
                   onChange={e => {
                     const nextLabels = { ...(((q as any).labels) || { ...defaultLinearScaleLabels }) }
                     nextLabels[n] = e.target.value
                     updateQuestion(mode, sectionId, q.id, {
                       labels: nextLabels as any,
                       scale_min_label: n === 1 ? e.target.value : q.scale_min_label,
                       scale_max_label: n === 5 ? e.target.value : q.scale_max_label,
                     })
                   }}
                   required
                   placeholder={n === 3 ? 'Neutral' : ''}
                 />
               </div>
             ))}
           </div>
         </div>
       )}

       {ratingVisible && (
         <div className="mt-3">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
             <div>
               <label className="block text-gray-600 mb-1">Display as</label>
               <select
                 className="w-full border border-[#DADCE0] rounded px-2 py-1 bg-white"
                 value={q.displayStyle || 'stars'}
                 onChange={(e) => updateQuestion(mode, sectionId, q.id, { displayStyle: e.target.value as any })}
               >
                 <option value="stars">Stars 🌟</option>
                 <option value="emojis">Emojis 😊</option>
                 <option value="numbers">Numbers ①②③④⑤</option>
               </select>
             </div>
           </div>
         </div>
       )}
     </div>
   )
 }

 const SortableSectionCard: React.FC<{
   mode: 'create' | 'edit'
   section: NewSection
   t: (key: string) => string
   updateSectionMeta: (mode: 'create' | 'edit', sectionId: string, patch: Partial<Pick<NewSection, 'title' | 'description' | 'collapsed'>>) => void
   duplicateSection: (mode: 'create' | 'edit', sectionId: string) => void
   deleteSection: (mode: 'create' | 'edit', sectionId: string) => void
   addQuestionToSection: (mode: 'create' | 'edit', sectionId: string, type: QuestionType) => void
   addSection: (mode: 'create' | 'edit') => void
   updateQuestion: (mode: 'create' | 'edit', sectionId: string, questionId: string, patch: Partial<NewQuestion>) => void
   removeQuestion: (mode: 'create' | 'edit', sectionId: string, questionId: string) => void
 }> = ({
   mode,
   section,
   t,
   updateSectionMeta,
   duplicateSection,
   deleteSection,
   addQuestionToSection,
   addSection,
   updateQuestion,
   removeQuestion,
 }) => {
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
     id: section.id,
     data: { type: 'section' },
   })
   const style: React.CSSProperties = {
     transform: CSS.Transform.toString(transform),
     transition,
     opacity: isDragging ? 0.6 : 1,
   }

   const questions = section.questions || []

   const headerLabel = stripHtml(section.title) || 'Untitled Section'

   return (
     <div ref={setNodeRef} style={style} className="rounded-2xl border border-[#DADCE0] bg-white shadow-sm overflow-hidden">
       <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#006400', color: '#fff' }}>
         <div className="flex items-center gap-2 min-w-0">
           <button type="button" className="text-white/90 hover:text-white" {...attributes} {...listeners} title="Drag section">⠿</button>
           <div className="font-semibold truncate">{headerLabel}</div>
         </div>
         <div className="flex items-center gap-2">
           <button
             type="button"
             className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-xs"
             onClick={() => updateSectionMeta(mode, section.id, { collapsed: !section.collapsed })}
           >
             {section.collapsed ? 'Expand' : 'Collapse'}
           </button>
           <button type="button" className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-xs" onClick={() => duplicateSection(mode, section.id)}>Duplicate</button>
           <button type="button" className="px-2 py-1 rounded bg-red-500/80 hover:bg-red-500 text-xs" onClick={() => deleteSection(mode, section.id)}>Delete</button>
         </div>
       </div>

       {!section.collapsed && (
         <div className="p-4 space-y-3">
           <div>
             <div id={`${section.id}-title`}>
               <RichTextEditor
                 value={section.title}
                 onChange={(html) => updateSectionMeta(mode, section.id, { title: html })}
                 placeholder="Section title"
               />
             </div>
             <div className="mt-2">
               <RichTextEditor
                 value={section.description || ''}
                 onChange={(html) => updateSectionMeta(mode, section.id, { description: html })}
                 placeholder="Section description (optional)"
               />
             </div>
           </div>

           <div className="flex items-center justify-between">
             <div className="text-xs text-gray-500">{questions.length} questions</div>
             <div className="flex items-center gap-2">
               <button
                 type="button"
                 className="w-10 h-10 rounded-full flex items-center justify-center shadow border bg-white hover:bg-gray-50"
                 title="Add question"
                 onClick={() => addQuestionToSection(mode, section.id, 'multiple_choice')}
               >
                 +
               </button>
               <div className="flex flex-wrap gap-2 text-xs">
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'rating')} className="px-2 py-1 rounded-full border">★ Rating</button>
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'linear_scale')} className="px-2 py-1 rounded-full border">━┅━ Scale</button>
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'multiple_choice')} className="px-2 py-1 rounded-full border">◉ Choice</button>
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'dropdown')} className="px-2 py-1 rounded-full border">▾ Dropdown</button>
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'regions')} className="px-2 py-1 rounded-full border">⌂ Regions</button>
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'text')} className="px-2 py-1 rounded-full border">T Text</button>
                 <button type="button" onClick={() => addQuestionToSection(mode, section.id, 'paragraph')} className="px-2 py-1 rounded-full border">¶ Paragraph</button>
               </div>
             </div>
           </div>

           <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
             <div className="space-y-3">
               {questions.map((q) => (
                 <SortableQuestionCard
                   key={q.id}
                   mode={mode}
                   sectionId={section.id}
                   q={q}
                   t={t}
                   updateQuestion={updateQuestion}
                   removeQuestion={removeQuestion}
                 />
               ))}
             </div>
           </SortableContext>

           <div className="flex items-center justify-between pt-2 border-t">
             <button type="button" className="px-3 py-1.5 rounded border" onClick={() => addSection(mode)}>Add Section</button>
             <div className="text-xs text-gray-500">Drag questions between sections</div>
           </div>
         </div>
       )}
     </div>
   )
 }

export default function ManageSurveysPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [surveys, setSurveys] = useState<AdminSurvey[]>([])
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [surveyLanguage, setSurveyLanguage] = useState<'en' | 'am'>('en')
  const [makeActive, setMakeActive] = useState(false)
  const [sections, setSections] = useState<NewSection[]>([defaultSection()])
  const [saving, setSaving] = useState(false)

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false)
  const [editSurvey, setEditSurvey] = useState<AdminSurvey | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editHeaderTitle, setEditHeaderTitle] = useState('')
  const [editHeaderSubtitle, setEditHeaderSubtitle] = useState('')
  const [editSurveyLanguage, setEditSurveyLanguage] = useState<'en' | 'am'>('en')
  const [editMakeActive, setEditMakeActive] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [editSections, setEditSections] = useState<NewSection[]>([defaultSection()])
  const [existingQuestionIds, setExistingQuestionIds] = useState<Set<number>>(new Set())
  const [existingSectionIds, setExistingSectionIds] = useState<Set<number>>(new Set())
  const [submitMode, setSubmitMode] = useState<'draft' | 'publish'>('draft')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const editQuestionCount = editSections.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0)
  const editHasEmptyQuestion = editSections.some(s => (s.questions || []).some(q => q.text.trim().length === 0))

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await listSurveys()
      setSurveys(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load surveys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const activeId = useMemo(() => surveys.find(s => s.is_active)?.id ?? null, [surveys])

  const resetModal = () => {
    setTitle('')
    setDescription('')
    setSurveyLanguage('en')
    setMakeActive(false)
    setSections([defaultSection()])
  }

  const addSection = (mode: 'create' | 'edit') => {
    const next = defaultSection()
    if (mode === 'create') {
      setSections(prev => [...prev, next])
    } else {
      setEditSections(prev => [...prev, next])
    }
    requestAnimationFrame(() => {
      const root = document.getElementById(`${next.id}-title`)
      const editor = root?.querySelector('.ql-editor') as HTMLElement | null
      editor?.focus()
    })
  }

  const duplicateSection = (mode: 'create' | 'edit', sectionId: string) => {
    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => {
      const idx = prev.findIndex(s => s.id === sectionId)
      if (idx === -1) return prev
      const src = prev[idx]
      const copy: NewSection = {
        ...src,
        id: `sec-${uid()}`,
        backendId: undefined,
        title: src.title ? `${src.title} (copy)` : 'Untitled Section',
        questions: src.questions.map(q => ({ ...q, id: `q-${uid()}`, backendId: undefined })),
      }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }

  const deleteSection = (mode: 'create' | 'edit', sectionId: string) => {
    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => {
      const sec = prev.find(s => s.id === sectionId)
      if (!sec) return prev
      if ((sec.questions?.length ?? 0) > 0) {
        if (!confirm('Delete this section? All questions inside will be removed.')) return prev
      } else {
        if (!confirm('Delete this section?')) return prev
      }
      const next = prev.filter(s => s.id !== sectionId)
      return next.length > 0 ? next : [defaultSection()]
    })
  }

  const addQuestionToSection = (mode: 'create' | 'edit', sectionId: string, type: QuestionType) => {
    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const q: NewQuestion = {
        id: `q-${uid()}`,
        text: '',
        question_type: type,
        required: true,
        maxChars: getMaxCharsForType(type),
      }
      if (type === 'dropdown' || type === 'multiple_choice') q.options = 'Option 1\nOption 2'
      if (type === 'linear_scale') {
        q.labels = { ...defaultLinearScaleLabels } as any
        q.scale_min_label = defaultLinearScaleLabels[1]
        q.scale_max_label = defaultLinearScaleLabels[5]
      }
      if (type === 'rating') {
        q.labels = { ...defaultRatingLabels }
        q.displayStyle = 'stars'
        q.scale_min_label = defaultRatingLabels[1]
        q.scale_max_label = defaultRatingLabels[5]
      }
      return { ...s, questions: [...(s.questions || []), q] }
    }))
  }

  const updateSectionMeta = (mode: 'create' | 'edit', sectionId: string, patch: Partial<Pick<NewSection, 'title' | 'description' | 'collapsed'>>) => {
    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => prev.map(s => s.id === sectionId ? { ...s, ...patch } : s))
  }

  const updateQuestion = (mode: 'create' | 'edit', sectionId: string, questionId: string, patch: Partial<NewQuestion>) => {
    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        questions: (s.questions || []).map(q => q.id === questionId ? { ...q, ...patch } : q),
      }
    }))
  }

  const removeQuestion = (mode: 'create' | 'edit', sectionId: string, questionId: string) => {
    if (!confirm('Remove this question?')) return
    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return { ...s, questions: (s.questions || []).filter(q => q.id !== questionId) }
    }))
  }

  const onDragEndSections = (mode: 'create' | 'edit') => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const setter = mode === 'create' ? setSections : setEditSections
    setter(prev => {
      const activeType = active.data.current?.type
      const overType = over.data.current?.type

      // Reorder sections
      if (activeType === 'section' && overType === 'section') {
        const oldIndex = prev.findIndex(s => s.id === active.id)
        const newIndex = prev.findIndex(s => s.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex)
      }

      // Move question within/between sections
      if (activeType === 'question') {
        const fromSectionId = active.data.current?.sectionId as string | undefined
        const toSectionId = (overType === 'question'
          ? (over.data.current?.sectionId as string | undefined)
          : (overType === 'section'
            ? (over.id as string)
            : undefined))

        if (!fromSectionId || !toSectionId) return prev
        if (fromSectionId === toSectionId && active.id === over.id) return prev

        const next = prev.map(s => ({ ...s, questions: [...(s.questions || [])] }))
        const fromIdx = next.findIndex(s => s.id === fromSectionId)
        const toIdx = next.findIndex(s => s.id === toSectionId)
        if (fromIdx === -1 || toIdx === -1) return prev

        const qFromList = next[fromIdx].questions
        const qIndex = qFromList.findIndex(q => q.id === active.id)
        if (qIndex === -1) return prev
        const [moved] = qFromList.splice(qIndex, 1)

        const qToList = next[toIdx].questions
        let insertAt = qToList.length
        if (overType === 'question') {
          const overIndex = qToList.findIndex(q => q.id === over.id)
          if (overIndex >= 0) insertAt = overIndex
        }
        qToList.splice(insertAt, 0, moved)
        return next
      }

      return prev
    })
  }

  const onSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedTitle = normalizeRichText(title)
    if (stripHtml(normalizedTitle).length === 0) {
      alert('Survey title is required.')
      return
    }
    setSaving(true)
    try {
      const payload: CreateSurveyInput = {
        title: normalizedTitle,
        description: normalizeRichText(description) || undefined,
        language: surveyLanguage,
        is_active: makeActive,
        sections: sections.map((s, sIdx) => ({
          title: normalizeRichText(s.title || 'Untitled Section') || 'Untitled Section',
          description: normalizeRichText(s.description || '') || undefined,
          order: sIdx,
          questions: (s.questions || [])
            .filter(q => q.text.trim().length > 0)
            .map((q, idx) => ({
              text: q.text.trim(),
              question_type: q.question_type,
              order: idx,
              required: q.required ?? true,
              options: q.options ?? '',
              scale_min_label: q.scale_min_label ?? '',
              scale_max_label: q.scale_max_label ?? '',
              maxChars: getMaxCharsForType(q.question_type),
              labels: (q.question_type === 'linear_scale' || q.question_type === 'rating') ? q.labels : undefined,
              displayStyle: q.question_type === 'rating' ? q.displayStyle || 'stars' : undefined,
            })),
        })),
      }
      await createSurvey(payload)
      setShowModal(false)
      resetModal()
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to create survey')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this survey? This cannot be undone.')) return
    await deleteSurvey(id)
    await refresh()
  }

  const onActivate = async (id: number) => {
    await activateSurvey(id)
    await refresh()
  }

  const onOpenEdit = (s: AdminSurvey) => {
    setEditSurvey(s)
    setEditTitle(s.title)
    setEditDescription(s.description || '')
    setEditHeaderTitle((s as any).header_title || '')
    setEditHeaderSubtitle((s as any).header_subtitle || '')
    setEditSurveyLanguage((s as any).language || 'en')
    setEditMakeActive(!!s.is_active)
    const secs = (s.sections && s.sections.length > 0)
      ? s.sections
      : [{ id: null, title: 'Untitled Section', description: '', questions: s.questions }]

    const mapped: NewSection[] = secs
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((sec, sIdx) => ({
        id: `sec-${sec.id ?? uid()}`,
        backendId: (sec.id ?? undefined) as any,
        title: sec.title || 'Untitled Section',
        description: sec.description || '',
        collapsed: false,
        questions: (sec.questions || [])
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(q => ({
            id: `q-${q.id}`,
            backendId: q.id,
            text: q.text,
            question_type: q.question_type,
            required: q.required ?? true,
            options: q.options ?? '',
            scale_min_label: q.scale_min_label ?? '',
            scale_max_label: q.scale_max_label ?? '',
            labels: (q as any).labels || {
              1: q.scale_min_label || defaultLinearScaleLabels[1],
              2: defaultLinearScaleLabels[2],
              3: defaultLinearScaleLabels[3],
              4: defaultLinearScaleLabels[4],
              5: q.scale_max_label || defaultLinearScaleLabels[5],
            },
            displayStyle: (q as any).displayStyle || ((q.question_type === 'rating') ? 'stars' : undefined),
            maxChars: (q as any).maxChars ?? getMaxCharsForType(q.question_type),
          })),
      }))

    setEditSections(mapped.length > 0 ? mapped : [defaultSection()])
    setExistingQuestionIds(new Set(s.questions.map(q => q.id)))
    setExistingSectionIds(new Set((secs || []).map(sec => (sec.id as any)).filter(Boolean)))
    setEditOpen(true)
  }

  const onUpdateSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSurvey) return
    const normalizedEditTitle = normalizeRichText(editTitle)
    if (stripHtml(normalizedEditTitle).length === 0) {
      alert('Survey title is required.')
      return
    }
    setUpdating(true)
    try {
      await updateSurvey(editSurvey.id, {
        title: normalizedEditTitle,
        description: normalizeRichText(editDescription) || undefined,
        header_title: normalizeRichText(editHeaderTitle) || undefined,
        header_subtitle: normalizeRichText(editHeaderSubtitle) || undefined,
        language: editSurveyLanguage,
        is_active: submitMode === 'publish' ? true : editMakeActive,
        sections: editSections.map((s, sIdx) => ({
          id: s.backendId,
          title: normalizeRichText(s.title || 'Untitled Section') || 'Untitled Section',
          description: normalizeRichText(s.description || '') || undefined,
          order: sIdx,
          questions: (s.questions || [])
            .filter(q => q.text.trim().length > 0)
            .map((q, idx) => {
              const base = {
                text: q.text.trim(),
                question_type: q.question_type,
                order: idx,
                required: q.required ?? true,
                options: q.options ?? '',
                scale_min_label: q.scale_min_label ?? '',
                scale_max_label: q.scale_max_label ?? '',
                maxChars: getMaxCharsForType(q.question_type),
                labels: (q.question_type === 'linear_scale' || q.question_type === 'rating') ? q.labels : undefined,
                displayStyle: q.question_type === 'rating' ? q.displayStyle || 'stars' : undefined,
              }
              return q.backendId && existingQuestionIds.has(q.backendId)
                ? { id: q.backendId, ...base }
                : base
            }),
        })),
      })
      setEditOpen(false)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to update survey')
    } finally {
      setUpdating(false)
    }
  }
  // Legacy edit helpers removed (sections now own questions)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="px-3 py-1.5 rounded border">← Back</button>
          <h2 className="text-2xl font-semibold">{t('manage.title')}</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-eeuBlue text-white px-4 py-2 rounded"
        >
          {t('manage.new_survey')}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded">
          <table className="min-w-full w-full text-sm table-fixed">
            <thead className="bg-eeuGray text-gray-700">
              <tr>
                <th className="text-left p-3 w-[55%]">{t('manage.title_label')}</th>
                <th className="text-left p-3 w-[20%]">{t('manage.created')}</th>
                <th className="text-left p-3 w-[10%]">{t('manage.active')}</th>
                <th className="text-right p-3 w-[15%] whitespace-nowrap">{t('manage.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium truncate" title={stripHtml(s.title)}>{stripHtml(s.title)}</div>
                    {s.description && (
                      <div className="text-gray-600 truncate" title={stripHtml(s.description)}>
                        {stripHtml(s.description)}
                      </div>
                    )}
                    <div className="text-gray-600">{s.questions.length} questions</div>
                  </td>
                  <td className="p-3 text-gray-600">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    {s.is_active ? (
                      <span className="inline-block px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded">{t('manage.active')}</span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">{t('manage.inactive')}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button onClick={() => onOpenEdit(s)} className="px-3 py-1 rounded border inline-flex items-center gap-2">
                        <PencilSquareIcon className="h-4 w-4" />
                        <span>{t('manage.edit')}</span>
                      </button>
                      {!s.is_active && (
                        <button onClick={() => onActivate(s.id)} className="px-3 py-1 rounded bg-eeuLightBlue text-white inline-flex items-center gap-2">
                          <PowerIcon className="h-4 w-4" />
                          <span>{t('manage.activate')}</span>
                        </button>
                      )}
                      <button onClick={() => onDelete(s.id)} className="px-3 py-1 rounded bg-red-600 text-white inline-flex items-center gap-2">
                        <TrashIcon className="h-4 w-4" />
                        <span>{t('manage.delete')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {surveys.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-600">{t('manage.no_surveys')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow p-6">
            <h3 className="text-lg font-semibold mb-4">{t('manage.create_title')}</h3>
            <form onSubmit={onSaveSurvey} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('manage.title_label')}</label>
                <RichTextEditor value={title} onChange={setTitle} placeholder={t('manage.title_label')} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('manage.description_label')}</label>
                <RichTextEditor value={description} onChange={setDescription} placeholder={t('manage.description_label')} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Survey Language</label>
                <select
                  className="w-full border border-[#DADCE0] rounded px-3 py-2 text-sm bg-white"
                  value={surveyLanguage}
                  onChange={(e) => setSurveyLanguage(e.target.value as any)}
                >
                  <option value="en">English</option>
                  <option value="am">Amharic</option>
                </select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Sections</div>
                  <button type="button" className="px-3 py-1.5 rounded border" onClick={() => addSection('create')}>Add Section</button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndSections('create')}>
                  <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
                      {sections.map(sec => (
                        <SortableSectionCard
                          key={sec.id}
                          mode="create"
                          section={sec}
                          t={t}
                          updateSectionMeta={updateSectionMeta}
                          duplicateSection={duplicateSection}
                          deleteSection={deleteSection}
                          addQuestionToSection={addQuestionToSection}
                          addSection={addSection}
                          updateQuestion={updateQuestion}
                          removeQuestion={removeQuestion}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetModal() }} className="px-4 py-2 rounded border">{t('manage.cancel')}</button>
                <button disabled={saving} className="px-4 py-2 rounded bg-eeuBlue text-white">{saving ? '...' : t('manage.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && editSurvey && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 overflow-auto p-4 md:p-6">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow p-6 overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{t('manage.edit')}</h3>
                <p className="text-sm text-gray-600">{t('manage.builder_edit_subtitle')} {stripHtml(editSurvey.title)}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/survey/preview/${editSurvey.id}`)}
                className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1"
                style={{ backgroundColor: '#FF6200', color: '#ffffff' }}
              >
                <span>👁</span>
                <span>{t('manage.builder_preview')}</span>
              </button>
            </div>
            <form onSubmit={onUpdateSurvey} className="space-y-4 flex-1 overflow-auto pr-2">
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('manage.title_label')}</label>
                <RichTextEditor value={editTitle} onChange={setEditTitle} placeholder={t('manage.title_label')} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('manage.description_label')}</label>
                <RichTextEditor value={editDescription} onChange={setEditDescription} placeholder={t('manage.description_label')} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Survey Language</label>
                <select
                  className="w-full border border-[#DADCE0] rounded px-3 py-2 text-sm bg-white"
                  value={editSurveyLanguage}
                  onChange={(e) => setEditSurveyLanguage(e.target.value as any)}
                >
                  <option value="en">English</option>
                  <option value="am">Amharic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Survey Header Title</label>
                <RichTextEditor value={editHeaderTitle} onChange={setEditHeaderTitle} placeholder="Survey Header Title" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Survey Header Subtitle</label>
                <RichTextEditor value={editHeaderSubtitle} onChange={setEditHeaderSubtitle} placeholder="Survey Header Subtitle" />
              </div>
              <div className="flex items-center gap-2">
                <input id="editactive" type="checkbox" checked={editMakeActive} onChange={e => setEditMakeActive(e.target.checked)} />
                <label htmlFor="editactive" className="text-sm">{t('manage.set_active')}</label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-700">Sections</label>
                  <button type="button" className="px-3 py-1.5 rounded border" onClick={() => addSection('edit')}>Add Section</button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndSections('edit')}>
                  <SortableContext items={editSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4 max-h-[55vh] overflow-auto pr-1">
                      {editSections.map(sec => (
                        <SortableSectionCard
                          key={sec.id}
                          mode="edit"
                          section={sec}
                          t={t}
                          updateSectionMeta={updateSectionMeta}
                          duplicateSection={duplicateSection}
                          deleteSection={deleteSection}
                          addQuestionToSection={addQuestionToSection}
                          addSection={addSection}
                          updateQuestion={updateQuestion}
                          removeQuestion={removeQuestion}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#DADCE0] mt-2">
                <div className="text-xs text-gray-600">
                  {editQuestionCount} {editQuestionCount === 1 ? t('manage.builder_question_count_single') : t('manage.builder_question_count')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="px-4 py-2 rounded border text-sm"
                  >
                    {t('manage.cancel')}
                  </button>
                  <button
                    type="submit"
                    onClick={() => setSubmitMode('draft')}
                    disabled={updating || editHasEmptyQuestion}
                    className="px-4 py-2 rounded bg-gray-200 text-sm text-gray-800 disabled:opacity-60"
                  >
                    {updating && submitMode === 'draft' ? '...' : t('manage.builder_save_draft')}
                  </button>
                  <button
                    type="submit"
                    onClick={() => setSubmitMode('publish')}
                    disabled={updating || editHasEmptyQuestion}
                    className="px-4 py-2 rounded text-sm text-white disabled:opacity-60"
                    style={{ backgroundColor: '#006400' }}
                  >
                    {updating && submitMode === 'publish' ? '...' : t('manage.builder_publish')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
