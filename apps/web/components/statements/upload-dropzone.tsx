'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
  accept?: string
}

export function UploadDropzone({ onFileSelect, selectedFile, onClear, accept }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleClick = () => inputRef.current?.click()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  if (selectedFile) {
    return (
      <div className="border-2 border-border rounded-xl p-6 flex items-center gap-4 bg-card/50">
        <div className="w-12 h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <FileText size={22} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/90 truncate">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button
          onClick={onClear}
          className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground/90 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200',
        isDragOver
          ? 'border-indigo-500 bg-indigo-500/5 scale-[1.01]'
          : 'border-border hover:border-border bg-card/30 hover:bg-card/50'
      )}
    >
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors',
          isDragOver ? 'bg-indigo-500/20' : 'bg-muted'
        )}
      >
        <UploadCloud
          size={32}
          className={cn('transition-colors', isDragOver ? 'text-indigo-400' : 'text-muted-foreground')}
        />
      </div>
      <p className="text-base font-semibold text-foreground/90 mb-1">
        {isDragOver ? 'Release to upload' : 'Drop your bank statement here'}
      </p>
      <p className="text-sm text-muted-foreground">Supports CSV and Excel from ICICI Bank</p>
      <p className="text-xs text-muted-foreground/70 mt-3">or click to browse</p>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept ?? '.csv,.xls,.xlsx'}
        onChange={handleInputChange}
      />
    </div>
  )
}
