import React from 'react'

type Props = {
  value: number | null
  onChange: (v: number) => void
}

export default function RatingScale({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-full border flex items-center justify-center ${value === n ? 'bg-brand text-white' : 'bg-white hover:bg-gray-100'}`}>
          {n}
        </button>
      ))}
    </div>
  )
}
