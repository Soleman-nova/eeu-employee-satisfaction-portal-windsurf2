import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }

export default function Button({ variant = 'primary', className = '', ...rest }: Props) {
  const styles = variant === 'primary'
    ? 'bg-brand text-white hover:bg-brand-dark'
    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
  return <button className={`px-4 py-2 rounded transition ${styles} ${className}`} {...rest} />
}
