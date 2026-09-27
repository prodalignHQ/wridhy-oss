'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Lock, Users, Pencil } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const colorMap: Record<string, string> = {
  indigo: 'bg-primary/20 text-primary border-primary/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
}

const ownerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  notes: z.string().max(40, 'Notes must be 40 characters or less').optional(),
})

type OwnerFormValues = z.infer<typeof ownerSchema>

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null)
  const [ownerToEdit, setOwnerToEdit] = useState<Owner | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<z.infer<typeof ownerSchema>>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      name: '',
      notes: '',
    }
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (isAddOpen) {
      reset({ name: '', notes: '' })
    }
  }, [isAddOpen, reset])

  useEffect(() => {
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { loadReferenceMerged } = await import('@/lib/engine/reference')
        const merged = await loadReferenceMerged('owners', () => apiClient.fetch<Owner[]>('/v1/owners'))
        setOwners(merged as Owner[])
        return
      }
      const data = await apiClient.fetch<Owner[]>('/v1/owners')
      setOwners(data)
    } catch (err: any) {
      toast.error('Failed to load owners')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEdit = (owner: Owner) => {
    setOwnerToEdit(owner)
    setEditName(owner.name)
    setEditError(null)
  }

  const onSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerToEdit) return

    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('Name is required')
      return
    }

    setIsSavingEdit(true)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { updateReferenceRow } = await import('@/lib/engine/reference')
        const ok = await updateReferenceRow('owners', { ...ownerToEdit, name: trimmed })
        if (!ok) throw new Error('Could not save on this device')
        setOwners((prev) => prev.map((o) => (o.id === ownerToEdit.id ? { ...o, name: trimmed } : o)))
        toast.success('Name updated successfully')
        setOwnerToEdit(null)
        return
      }
      const updated = await apiClient.fetch<Owner>(`/v1/owners/${ownerToEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      })
      setOwners((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      toast.success('Name updated successfully')
      setOwnerToEdit(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update name')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const onSubmitAdd = async (values: OwnerFormValues) => {
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { createReferenceRow } = await import('@/lib/engine/reference')
        const palette = ['indigo', 'emerald', 'rose', 'amber', 'sky', 'violet']
        const id = crypto.randomUUID()
        const ok = await createReferenceRow('owners', {
          id,
          name: values.name.trim(),
          notes: values.notes?.trim() || null,
          color: palette[Math.floor(Math.random() * palette.length)],
          isDefault: false,
        })
        if (!ok) throw new Error('Could not save on this device')
        toast.success('Household member added')
        setIsAddOpen(false)
        reset()
        fetchOwners()
        return
      }
      await apiClient.fetch('/v1/owners', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      toast.success('Household member added')
      setIsAddOpen(false)
      reset()
      fetchOwners()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add owner')
    }
  }

  const onDeleteConfirm = async () => {
    if (!ownerToDelete) return
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const target = owners.find((o) => o.id === ownerToDelete.id)
        if (target?.isDefault) {
          toast.error('Cannot delete default owner')
          return
        }
        const selfOwner = owners.find((o) => o.isDefault)
        const [{ deleteReferenceRow }, { reassignOwnersInCache }] = await Promise.all([
          import('@/lib/engine/reference'),
          import('@/lib/engine/opfs-db'),
        ])
        if (selfOwner) {
          await reassignOwnersInCache(ownerToDelete.id, selfOwner.id)
        }
        const ok = await deleteReferenceRow('owners', ownerToDelete.id)
        if (!ok) throw new Error('Could not delete on this device')
        toast.success('Member removed')
        setOwners(owners.filter(o => o.id !== ownerToDelete.id))
        return
      }
      await apiClient.fetch(`/v1/owners/${ownerToDelete.id}`, { method: 'DELETE' })
      toast.success('Member removed')
      setOwners(owners.filter(o => o.id !== ownerToDelete.id))
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove owner')
    } finally {
      setOwnerToDelete(null)
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Household Members</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage people and shared accounts to split transactions with.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground font-medium animate-pulse">Loading members...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {owners.map((owner) => (
            <Card key={owner.id} className="relative group bg-card border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 aspect-square sm:aspect-auto sm:min-h-[200px]">
              {/* Action: Delete (Top-Right) */}
              {!owner.isDefault && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    setOwnerToDelete(owner);
                  }}
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {/* Action: Lock & Edit (Top-Right for Default User) */}
              {owner.isDefault && (
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0"
                    onClick={(e) => {
                      e.preventDefault()
                      handleOpenEdit(owner)
                    }}
                    title="Change name"
                    aria-label="Change name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="h-8 w-8 flex items-center justify-center text-muted-foreground/40 cursor-default">
                        <Lock size={14} />
                      </TooltipTrigger>
                      <TooltipContent side="top">This is you (Default)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {/* Avatar Section */}
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg border-2 mb-4 shrink-0 transition-transform group-hover:scale-110 shadow-sm",
                colorMap[owner.color] || colorMap['indigo']
              )}>
                {getInitials(owner.name)}
              </div>

              {/* Name & Details */}
              <div className="w-full">
                {owner.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(owner)}
                    className="group/name inline-flex items-center justify-center gap-1.5 max-w-full px-2 py-0.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                    title="Click to change name"
                  >
                    <h3 className="font-semibold text-foreground text-base tracking-tight truncate group-hover/name:text-primary transition-colors">
                      {owner.name}
                    </h3>
                    <Pencil className="h-3 w-3 text-muted-foreground/70 group-hover/name:text-primary transition-colors shrink-0" />
                  </button>
                ) : (
                  <h3 className="font-semibold text-foreground text-base tracking-tight truncate">{owner.name}</h3>
                )}
                {owner.notes && (
                  <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2 leading-relaxed px-1">
                    {owner.notes}
                  </p>
                )}
                {!owner.notes && <p className="text-[10px] text-muted-foreground mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-blue">Member</p>}
              </div>
            </Card>
          ))}

          {/* Special Add Person Card */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 aspect-square sm:aspect-auto sm:min-h-[200px] text-center hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted border-2 border-muted-foreground/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
              <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Add Person</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Split Expenses</p>
            </div>
            {/* Background Accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      )}

      {/* Add Owner Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add Household Member</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add someone you split expenses with.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitAdd)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Priya" className="bg-background border-border focus-visible:ring-primary" {...register('name')} />
              {errors.name && <p className="text-rose-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input 
                id="notes" 
                placeholder="Short note (max 40 chars)" 
                className="bg-background border-border focus-visible:ring-primary" 
                {...register('notes')} 
              />
              {errors.notes && <p className="text-rose-400 text-xs">{errors.notes.message}</p>}
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary text-white">Add Member</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Name Modal (Default Owner) */}
      <Dialog
        open={!!ownerToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setOwnerToEdit(null)
            setEditError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Change Name</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update your display name.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmitEdit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  if (editError) setEditError(null)
                }}
                placeholder="e.g. Rohan"
                className="bg-background border-border focus-visible:ring-primary"
                autoFocus
              />
              {editError && <p className="text-rose-400 text-xs">{editError}</p>}
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOwnerToEdit(null)}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit}
                className="bg-primary hover:bg-primary text-white"
              >
                {isSavingEdit ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!ownerToDelete} onOpenChange={() => setOwnerToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {ownerToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove them from your household. Any transactions previously assigned to them will be reassigned to you ({owners.find(o => o.isDefault)?.name || 'Self'}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-secondary hover:text-white border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} className="bg-rose-500 hover:bg-rose-600 text-white">
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
