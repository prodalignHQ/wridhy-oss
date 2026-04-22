"use client"

import { useState, useRef } from "react"
import { Database, Download, Upload, AlertTriangle, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStorageMode } from "@/lib/store/storage-mode"
import { exportLocalData, importLocalData } from "@/lib/utils/export"
import { toast } from "sonner"
import Link from "next/link"

export default function DataSettingsPage() {
  const { mode } = useStorageMode()
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    try {
      exportLocalData()
      toast.success("Data exported successfully")
    } catch (error) {
      toast.error("Failed to export data")
      console.error(error)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm("Warning: Importing data will completely overwrite your current local database. This cannot be undone. Do you wish to continue?")) {
      e.target.value = "" // reset
      return
    }

    setIsImporting(true)
    try {
      const result = await importLocalData(file)
      if (result.success) {
        toast.success("Data imported successfully! Reloading...")
        setTimeout(() => {
          window.location.href = '/dashboard' // Hard reload to fresh state
        }, 1500)
      } else {
        toast.error(result.message || "Failed to import data")
      }
    } catch (error) {
      toast.error("An unexpected error occurred during import")
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={
            <Link href="/settings">
                <ArrowLeft className="h-4 w-4" />
            </Link>
        } className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Data & Storage</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage how your data is stored securely.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Database size={24} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-lg">Current Storage Mode</h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'cloud' 
                  ? "Your data is actively syncing with the cloud." 
                  : "Your data is stored locally in this browser. To keep it safe, make sure to export backups regularly."}
              </p>
            </div>
          </div>
          
          <div className="rounded-lg p-4 border border-border bg-muted/30">
             <div className="flex justify-between items-center">
                 <span className="font-medium text-sm">Active Storage Mode</span>
                 <span className="px-3 py-1 bg-secondary rounded-full text-xs font-semibold uppercase tracking-wider">
                     {mode === 'cloud' ? 'Cloud' : 'Browser Local'}
                 </span>
             </div>
          </div>
        </Card>

        {mode !== 'cloud' && (
          <Card className="p-6 border-amber-500/20 bg-amber-500/5">
            <div className="flex gap-3 mb-4">
              <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-amber-500 mb-1">Local Backups</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your data currently lives only in your browser. Clearing your browser data, using incognito mode, or switching browsers will result in data loss. Export regular backups to keep your data safe.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button onClick={handleExport} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                <Download size={16} />
                Export Backup (JSON)
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImport}
                />
                <Button 
                  variant="outline" 
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload size={16} />
                  {isImporting ? 'Importing...' : 'Restore Backup'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
