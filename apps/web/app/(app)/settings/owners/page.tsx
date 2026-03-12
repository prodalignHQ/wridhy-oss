'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Lock, Users } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
  type: 'person' | 'shared' | 'household'
  color: string
  isDefault: boolean
}

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
}

const ownerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['person', 'shared', 'household']),
})

type OwnerFormValues = z.infer<typeof ownerSchema>

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null)

  const { register, handleSubmit, watch, formState: { errors }, setValue, reset } = useForm<z.infer<typeof ownerSchema>>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      name: '',
      type: 'person',
    }
  })

  // Watch form value for controlled select
  const watchedType = watch('type')

  // Reset form when dialog opens
  useEffect(() => {
    if (isAddOpen) {
      reset({ name: '', type: 'person' })
    }
  }, [isAddOpen, reset])

  useEffect(() => {
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      const data = await apiClient.fetch<Owner[]>('/v1/owners')
      setOwners(data)
    } catch (err: any) {
      toast.error('Failed to load owners')
    } finally {
      setLoading(false)
    }
  }

  const onSubmitAdd = async (values: OwnerFormValues) => {
    try {
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
      await apiClient.fetch(`/v1/owners/${ownerToDelete.id}`, { method: 'DELETE' })
      toast.success('Member removed')
      setOwners(owners.filter(o => o.id !== ownerToDelete.id))
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove owner')
    } finally {
      setOwnerToDelete(null)
    }
  }

  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-50">Household Members</h2>
          <p className="text-sm text-zinc-400 mt-1">Manage people and shared accounts to split transactions with.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Add Person
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">Loading members...</div>
      ) : owners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-xl">
          <Users size={40} className="text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">No other members</h3>
          <p className="text-sm text-zinc-500 max-w-sm mb-6">
            Add roommates or family members to split transactions with them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {owners.map((owner) => (
            <Card key={owner.id} className="bg-zinc-900 border-zinc-800 rounded-xl p-4 flex items-center justify-between group">
              <div className="flex items-center space-x-4 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${colorMap[owner.color] || colorMap['indigo']} shrink-0`}>
                  {owner.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="truncate pr-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-zinc-50 truncate">{owner.name}</h3>
                    {owner.isDefault && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="flex items-center"><Lock className="w-3 h-3 text-zinc-500 shrink-0" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                            <p>This is you (cannot be deleted)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-400 text-[10px] mt-1 hover:bg-zinc-800/50">
                    {formatType(owner.type)}
                  </Badge>
                </div>
              </div>
              
              {!owner.isDefault && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => setOwnerToDelete(owner)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Owner Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Add Household Member</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add someone you split expenses with.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitAdd)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Priya" className="bg-zinc-950 border-zinc-700 focus-visible:ring-indigo-500" {...register('name')} />
              {errors.name && <p className="text-rose-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select 
                value={watchedType} 
                onValueChange={(val) => setValue('type', val as any)}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-700 focus:ring-indigo-500">
                  <SelectValue>
                    {watchedType === 'person' && 'Person'}
                    {watchedType === 'shared' && 'Shared Group'}
                    {watchedType === 'household' && 'Household Pot'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="shared">Shared Group</SelectItem>
                  <SelectItem value="household">Household Pot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Add Member</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!ownerToDelete} onOpenChange={() => setOwnerToDelete(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {ownerToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will remove them from your household. Any transactions previously assigned to them will be reassigned to you (Self).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white border-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} className="bg-rose-500 hover:bg-rose-600 text-white">
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
