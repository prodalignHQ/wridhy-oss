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
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {confirmPhrase && (
          <div className="space-y-2 py-2">
            <Label className="text-muted-foreground text-xs">
              Type{" "}
              <code className="font-mono text-rose-400 bg-muted px-1.5 py-0.5 rounded">
                {confirmPhrase}
              </code>{" "}
              to confirm
            </Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmPhrase}
              className="font-mono bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-muted-foreground hover:text-muted-foreground hover:bg-muted"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={cn(
              !destructive && "bg-primary hover:bg-primary text-white"
            )}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
