'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'

interface InlineInputProps {
  initialValue: number | string
  onSave: (value: number) => void
  className?: string
  placeholder?: string
}

export function InlineInput({ initialValue, onSave, className, placeholder }: InlineInputProps) {
  const [val, setVal] = useState<string>(String(initialValue ?? ''))

  useEffect(() => {
    setVal(String(initialValue ?? ''))
  }, [initialValue])

  const handleBlurOrEnter = () => {
    const numeric = parseFloat(val) || 0
    if (numeric !== parseFloat(String(initialValue ?? 0))) {
      onSave(numeric)
    }
  }

  return (
    <Input
      type="number"
      step="any"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlurOrEnter}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}
