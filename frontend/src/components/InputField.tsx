import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string }

export default function InputField({ label, id, className = '', ...rest }: Props) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  return (
    <label className="block text-sm">
      {label && <span className="block mb-1 text-gray-700">{label}</span>}
      <input id={inputId} className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-brand ${className}`} {...rest} />
    </label>
  )
}
