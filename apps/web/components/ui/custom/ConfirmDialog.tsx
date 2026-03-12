"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** If set, user must type this string to confirm */
  confirmPhrase?: string
  onConfirm: () => void | Promise<void>
  destructive?: boolean
  loading?: boolean
}

/**
 * Modal for destructive actions. Optionally requires the user to type a phrase
 * (e.g., "DELETE") to enable the confirm button.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmPhrase,
  onConfirm,
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const canConfirm = !confirmPhrase || inputValue === confirmPhrase

  const handleConfirm = async () => {
    await onConfirm()
    setInputValue("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-zinc-400">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {confirmPhrase && (
          <div className="space-y-2 py-2">
            <Label className="text-zinc-300 text-xs">
              Type{" "}
              <code className="font-mono text-rose-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                {confirmPhrase}
              </code>{" "}
              to confirm
            </Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmPhrase}
              className="font-mono bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-600"
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={cn(
              !destructive && "bg-indigo-500 hover:bg-indigo-600 text-white"
            )}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
