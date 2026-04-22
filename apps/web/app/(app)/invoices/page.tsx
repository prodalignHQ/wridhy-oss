'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  ChevronRight,
  Loader2,
  Calendar,
  CreditCard,
  History,
  LayoutDashboard,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useStorageMode } from '@/lib/store/storage-mode'
import { cn } from '@/lib/utils'

// Import components for editing
import { CategoryPicker } from '@/components/transactions/category-picker'
import { SplitOwnerModal } from '@/components/transactions/split-owner-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Statement {
  id: string
  statementId: string
  accountId: string
  statementMonth: string
  accountName: string
  accountType: string
}

interface InvoiceSummary {
  id: string
  name: string
  status: 'draft' | 'generated'
  invoiceMonth: string
  generatedAt: string | null
  createdAt: string
  updatedAt: string
  statements: Statement[]
}

interface OwnerSummary {
  ownerId: string | null
  name: string
  color: string | null
  total: number
}

interface CategoryTotal {
  categoryId: string | null
  category: string
  total: number
}

interface OwnerCategoryBreakdown extends OwnerSummary {
  categories: CategoryTotal[]
}

interface InvoiceAnalysis {
  ownerTotals: OwnerSummary[]
  ownerCategoryTotals: OwnerCategoryBreakdown[]
}

interface InvoiceTransaction {
  id: string
  date: string
  description: string
  amount: string
  type: 'debit' | 'credit'
  categoryId: string | null
  category: { id: string | null; name: string; color: string | null } | null
  owners: { ownerId: string | null; name: string; color: string | null; amount: string; percentage: string }[]
  transactionOwners?: any[] // Support both API shapes
}

interface InvoiceDetail extends InvoiceSummary {
  transactions: InvoiceTransaction[]
  analysis: InvoiceAnalysis | null
}

interface AvailableStatement {
  id: string
  bankId: string
  accountId: string
  statementMonth: string
  account: { accountName: string; accountType: string; bankName: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(typeof value === 'string' ? parseFloat(value) : value)

const formatMonth = (monthStr: string) => {
  try {
    return format(parseISO(monthStr), 'MMMM yyyy')
  } catch {
    return monthStr
  }
}

// ─── Components ────────────────────────────────────────────────────────────

function AnalysisCard({ analysis }: { analysis: InvoiceAnalysis }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {analysis.ownerCategoryTotals.map((owner) => (
        <Card key={owner.ownerId || owner.name} className="overflow-hidden border-border bg-card">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: owner.color || '#6366f1' }}
                />
                <CardTitle className="text-base">{owner.name}</CardTitle>
              </div>
              <span className="text-lg font-bold text-foreground">
                {formatINR(owner.total)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {owner.categories.map((cat) => (
                <div key={cat.categoryId || cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{cat.category}</span>
                    <span className="font-medium text-foreground/90">
                      {formatINR(cat.total)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-indigo-500/60"
                      style={{ width: `${(cat.total / owner.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TransactionsTable({ 
  transactions, 
  onCategoryUpdate, 
  onSplitClick,
  isDraft
}: { 
  transactions: InvoiceTransaction[],
  onCategoryUpdate: (id: string, categoryId: string | null) => void,
  onSplitClick: (txn: InvoiceTransaction) => void,
  isDraft: boolean
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Splits</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-muted/20 transition-colors h-12">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {format(parseISO(txn.date), 'dd MMM')}
                </td>
                <td className="px-4 py-3 text-foreground/90 max-w-xs truncate" title={txn.description}>
                  {txn.description}
                </td>
                <td className="px-4 py-3">
                  {isDraft ? (
                    <CategoryPicker
                      categoryId={txn.categoryId}
                      category={txn.category as any}
                      onUpdate={(catId) => onCategoryUpdate(txn.id, catId)}
                    />
                  ) : (
                    txn.category ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: txn.category.color || '#ccc' }}
                        />
                        <span className="text-xs text-foreground/80">{txn.category.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">Uncategorized</span>
                    )
                  )}
                </td>
                <td className="px-4 py-3">
                  <div 
                    className={cn("flex -space-x-2", isDraft && "cursor-pointer hover:opacity-80")}
                    onClick={() => isDraft && onSplitClick(txn)}
                  >
                    {txn.owners.map((owner, i) => (
                      <div
                        key={i}
                        className="h-6 w-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: owner.color || '#6366f1' }}
                        title={`${owner.name}: ${formatINR(owner.amount)} (${owner.percentage}%)`}
                      >
                        {owner.name.substring(0, 1).toUpperCase()}
                      </div>
                    ))}
                    {txn.owners.length === 0 && isDraft && (
                      <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground">
                        +
                      </div>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-foreground/90">
                  <span className={txn.type === 'debit' ? 'text-rose-400' : 'text-emerald-400'}>
                    {txn.type === 'debit' ? '−' : '+'}{formatINR(txn.amount)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { adapter } = useStorageMode()
  const searchParams = useSearchParams()
  const filterMonth = searchParams.get('month') // YYYY-MM

  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Creation/Edit Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [availableStatements, setAvailableStatements] = useState<AvailableStatement[]>([])
  const [loadingStatements, setLoadingStatements] = useState(false)
  
  // Transaction Editing State
  const [owners, setOwners] = useState<any[]>([])
  const [splitTarget, setSplitTarget] = useState<any | null>(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formMonth, setFormMonth] = useState(filterMonth || format(new Date(), 'yyyy-MM'))
  const [selectedStatementIds, setSelectedStatementIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsEditSaving] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adapter.getInvoices()
      setInvoices(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [adapter])

  useEffect(() => {
    fetchInvoices()
    adapter.getOwners().then(setOwners).catch(console.error)
  }, [fetchInvoices, adapter])

  const handleSelectInvoice = async (id: string) => {
    setLoadingDetail(true)
    try {
      const data = await adapter.getInvoiceDetail(id)
      setSelectedInvoice(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load invoice details')
    } finally {
      setLoadingDetail(false)
    }
  }

  const loadStatementsForMonth = useCallback(async (month: string) => {
    setLoadingStatements(true)
    try {
      const data = await adapter.getStatements()
      const filtered = (data as any[]).filter(
        (s) => s.statementMonth.startsWith(month)
      )
      setAvailableStatements(filtered as any)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load statements')
    } finally {
      setLoadingStatements(false)
    }
  }, [adapter])

  // Auto-open create if month is provided but no invoices exist for it
  useEffect(() => {
    if (filterMonth && !loading && invoices.length === 0) {
      setFormMonth(filterMonth)
      setIsCreateOpen(true)
    }
  }, [filterMonth, loading, invoices.length])

  useEffect(() => {
    if (isCreateOpen || isEditOpen) {
      loadStatementsForMonth(formMonth)
    }
  }, [isCreateOpen, isEditOpen, formMonth, loadStatementsForMonth])

  const handleCreate = async () => {
    if (!formName || selectedStatementIds.size === 0) {
      toast.error('Please provide a name and select at least one statement')
      return
    }

    setIsEditSaving(true)
    try {
      await adapter.createInvoice({
        name: formName,
        invoiceMonth: formMonth + '-01',
        statementIds: Array.from(selectedStatementIds),
      })
      toast.success('Invoice draft created')
      setIsCreateOpen(false)
      setFormName('')
      setSelectedStatementIds(new Set())
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice')
    } finally {
      setIsEditSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedInvoice) return
    setIsEditSaving(true)
    try {
      await adapter.updateInvoice(selectedInvoice.id, {
        name: formName,
        statementIds: Array.from(selectedStatementIds),
      })
      toast.success('Invoice updated')
      setIsEditOpen(false)
      handleSelectInvoice(selectedInvoice.id)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice')
    } finally {
      setIsEditSaving(false)
    }
  }

  const handleGenerate = async (id: string) => {
    setIsGenerating(true)
    try {
      await adapter.generateInvoice(id)
      toast.success('Invoice generated successfully')
      handleSelectInvoice(id)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invoice')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return
    try {
      await adapter.deleteInvoice(id)
      toast.success('Invoice deleted')
      if (selectedInvoice?.id === id) setSelectedInvoice(null)
      fetchInvoices()
    } catch (err) {
      toast.error('Failed to delete invoice')
    }
  }

  const toggleStatement = (id: string) => {
    const next = new Set(selectedStatementIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStatementIds(next)
  }

  const openEdit = () => {
    if (!selectedInvoice) return
    setFormName(selectedInvoice.name)
    setFormMonth(selectedInvoice.invoiceMonth.slice(0, 7))
    setSelectedStatementIds(new Set(selectedInvoice.statements.map((s) => s.statementId)))
    setIsEditOpen(true)
  }

  // --- Editing Handlers ---
  
  const handleCategoryUpdate = async (txnId: string, categoryId: string | null) => {
    try {
      await adapter.updateTransactionCategory(txnId, categoryId)
      // Refresh details to show update
      if (selectedInvoice) handleSelectInvoice(selectedInvoice.id)
    } catch {
      toast.error('Failed to update category')
    }
  }

  const handleOwnerSave = async (ownerIds: string[]) => {
    if (!splitTarget) return
    try {
      await adapter.updateTransactionOwners(splitTarget.id, ownerIds)
      toast.success('Owners updated')
      setSplitTarget(null)
      // Refresh details to show update
      if (selectedInvoice) handleSelectInvoice(selectedInvoice.id)
    } catch {
      toast.error('Failed to update owners')
    }
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Summarize monthly spending and split across household members
          </p>
        </div>
        <Button
          onClick={() => {
            setFormName(`Invoice ${format(new Date(), 'MMM yyyy')}`)
            setIsCreateOpen(true)
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
        >
          <Plus size={16} />
          Create Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left: Sidebar / List */}
        <Card className="lg:col-span-4 border-border bg-card flex flex-col overflow-hidden">
          <CardHeader className="py-4 px-4 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                History
              </CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                {invoices.length} Total
              </Badge>
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 p-6 text-center text-muted-foreground">
                <History className="mb-4 opacity-20" size={48} />
                <p className="text-sm font-medium">No invoices yet</p>
                <p className="text-xs mt-1">Start by creating your first invoice summary</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => handleSelectInvoice(inv.id)}
                    className={cn(
                      'w-full text-left p-4 hover:bg-muted/30 transition-colors group relative outline-none',
                      selectedInvoice?.id === inv.id && 'bg-primary/5'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-foreground/90 group-hover:text-primary transition-colors truncate pr-2">
                        {inv.name}
                      </span>
                      <Badge
                        variant={inv.status === 'generated' ? 'default' : 'secondary'}
                        className={cn(
                          'text-[10px] px-1.5 h-4 uppercase font-bold shrink-0',
                          inv.status === 'generated' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20'
                        )}
                      >
                        {inv.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar size={12} />
                      {formatMonth(inv.invoiceMonth)}
                      <Separator orientation="vertical" className="h-3 mx-1" />
                      <CreditCard size={12} />
                      {inv.statements.length} statements
                    </div>
                    {selectedInvoice?.id === inv.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Right: Detail View */}
        <div className="lg:col-span-8 h-full min-h-0">
          {!selectedInvoice ? (
            <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-muted/5 p-12 text-center">
              <Receipt size={64} className="text-muted-foreground opacity-10 mb-6" />
              <h3 className="text-lg font-medium text-foreground/60">No Invoice Selected</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-2">
                Select an invoice from the history or create a new one to see detailed analysis.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="h-full flex items-center justify-center border border-border rounded-xl bg-card">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-1">
              {/* Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-foreground">{selectedInvoice.name}</h2>
                    <Badge variant="outline" className="bg-muted/50 border-border text-muted-foreground font-mono">
                      {selectedInvoice.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created on {format(parseISO(selectedInvoice.createdAt), 'PP')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedInvoice.status === 'draft' ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 px-3 border-border gap-2" onClick={openEdit}>
                        <Sparkles size={14} /> Edit Configuration
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-500/20"
                        onClick={() => handleGenerate(selectedInvoice.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Generate Invoice
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9 px-3 border-border text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 gap-2" onClick={() => handleDelete(selectedInvoice.id)}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Info (if draft) */}
              {selectedInvoice.status === 'draft' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-4">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                    <History size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-500">Draft Status</h4>
                    <p className="text-xs text-amber-700/80 dark:text-amber-200/60 mt-1 leading-relaxed">
                      This invoice is currently showing <strong>live data</strong> from your transactions. Generate the invoice to capture a permanent snapshot and see a complete summary of splits.
                    </p>
                  </div>
                </div>
              )}

              {/* Content Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted p-1 rounded-lg">
                  <TabsTrigger value="overview" className="flex-1 rounded-md py-1.5 text-xs font-semibold data-[state=active]:bg-card shadow-sm">
                    Analysis
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="flex-1 rounded-md py-1.5 text-xs font-semibold data-[state=active]:bg-card shadow-sm">
                    Transactions ({selectedInvoice.transactions.length})
                  </TabsTrigger>
                  <TabsTrigger value="configuration" className="flex-1 rounded-md py-1.5 text-xs font-semibold data-[state=active]:bg-card shadow-sm">
                    Configuration
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                  {selectedInvoice.analysis ? (
                    <AnalysisCard analysis={selectedInvoice.analysis} />
                  ) : (
                    <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground bg-muted/5">
                      <LayoutDashboard className="mb-4 opacity-10" size={48} />
                      <p className="text-sm font-medium">Analysis is only available for generated invoices.</p>
                      <p className="text-xs mt-2 max-w-xs">
                        Generate this invoice to see category breakdowns and total splits per person.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transactions" className="mt-6">
                  <TransactionsTable 
                    transactions={selectedInvoice.transactions} 
                    isDraft={selectedInvoice.status === 'draft'}
                    onCategoryUpdate={handleCategoryUpdate}
                    onSplitClick={(txn) => setSplitTarget(txn)}
                  />
                </TabsContent>

                <TabsContent value="configuration" className="mt-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Card className="bg-muted/10 border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">General Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Invoice Name</p>
                          <p className="text-sm font-medium">{selectedInvoice.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Invoice Month</p>
                          <p className="text-sm font-medium">{formatMonth(selectedInvoice.invoiceMonth)}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/10 border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Sources</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Statements included</p>
                        <div className="space-y-2">
                          {selectedInvoice.statements.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border">
                              <FileText size={14} className="text-indigo-500" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{s.accountName}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{s.accountType}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Creation/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setIsEditOpen(false)
        }
      }}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>{isCreateOpen ? 'Create Invoice Draft' : 'Edit Configuration'}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Group bank statements for a given month to summarize spending and splits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. April 2026 Household"
                className="bg-muted border-border focus-visible:ring-indigo-500"
              />
            </div>

            {/* Month Selector (only for Create) */}
            {isCreateOpen && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">For Month</label>
                <Input
                  type="month"
                  value={formMonth}
                  onChange={(e) => setFormMonth(e.target.value)}
                  className="bg-muted border-border w-full"
                />
              </div>
            )}

            {/* Statement Picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Statements ({selectedStatementIds.size})
                </label>
                {loadingStatements && <Loader2 size={12} className="animate-spin" />}
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {availableStatements.length === 0 && !loadingStatements ? (
                  <div className="p-8 text-center border-2 border-dashed border-border rounded-xl">
                    <p className="text-xs text-muted-foreground">No statements found for this month.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Upload statements first to include them here.</p>
                  </div>
                ) : (
                  availableStatements.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => toggleStatement(s.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                        selectedStatementIds.has(s.id)
                          ? 'border-indigo-500/50 bg-indigo-500/5'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <Checkbox checked={selectedStatementIds.has(s.id)} onCheckedChange={() => toggleStatement(s.id)} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground/90">{s.account?.accountName || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                          {s.account?.bankName || 'Unknown'} · {s.account?.accountType || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false) }}>Cancel</Button>
            <Button
              onClick={isCreateOpen ? handleCreate : handleUpdate}
              disabled={isSaving || selectedStatementIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-24 shadow-lg shadow-indigo-500/20"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : (isCreateOpen ? 'Create Draft' : 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Owner Modal */}
      <SplitOwnerModal
        open={!!splitTarget}
        onClose={() => setSplitTarget(null)}
        transaction={splitTarget ? {
          ...splitTarget,
          transactionOwners: (splitTarget.owners || splitTarget.transactionOwners || []).map((o: any) => ({
             ...o,
             owner: owners.find(ow => ow.id === o.ownerId)
          }))
        } : null}
        owners={owners}
        onSave={handleOwnerSave}
      />
    </div>
  )
}
