import { localDb } from '../store/local-db'

export function exportLocalData() {
  if (typeof window === 'undefined') return

  const data = Object.keys(localStorage).reduce((acc: any, key) => {
    if (key.startsWith('momoney_')) {
      const val = localStorage.getItem(key)
      if (val) {
        acc[key.replace('momoney_', '')] = JSON.parse(val)
      }
    }
    return acc
  }, {})

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `momoney_backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importLocalData(file: File): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const data = JSON.parse(text)

        // Clear existing data and initialize base values
        localDb.clearAll()

        // Important schema keys to validate
        const schemaKeys = [
          'accounts',
          'statements',
          'transactions',
          'categories',
          'rules',
          'owners',
          'assets',
          'liabilities',
          'nw_snapshots'
        ]

        Object.keys(data).forEach((key) => {
          if (schemaKeys.includes(key)) {
            localStorage.setItem(`momoney_${key}`, JSON.stringify(data[key]))
          }
        })

        resolve({ success: true })
      } catch (error) {
        console.error('Failed to parse backup file', error)
        resolve({ success: false, message: 'Invalid backup file format' })
      }
    }
    reader.readAsText(file)
  })
}
