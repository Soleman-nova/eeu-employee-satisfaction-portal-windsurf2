import React, { useMemo } from 'react'
import RegionsEn from '@/data/Regions-en.json'
import RegionsAm from '@/data/Regions-am.json'
import { useI18n } from '@/context/I18nContext'

type RegionOption = {
  value: string
  title: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
}

export default function RegionDropdownQuestion({
  value,
  onChange,
  required,
  placeholder = 'Select a region',
}: Props) {
  const { lang } = useI18n()

  const options = useMemo(() => {
    const data = (lang === 'am' ? RegionsAm : RegionsEn) as unknown as RegionOption[]
    return data
  }, [lang])

  return (
    <div className="mt-1">
      <select
        className="w-full border border-[#DADCE0] rounded-md px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-1 bg-white"
        style={{ borderColor: '#DADCE0', boxShadow: 'none' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.title}
          </option>
        ))}
      </select>
    </div>
  )
}
