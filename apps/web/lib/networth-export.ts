import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { resolveAssetTag, ASSET_TAG_LABELS } from '@momoney/utils'

export interface NetWorthExportOptions {
  data: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    assets: any[]
    liabilities: any[]
  }
  owners: Array<{
    id: string
    name: string
    color: string
    isDefault: boolean
  }>
  selectedOwnerIds: string[]
  isAllSelected: boolean
  snapshots?: Array<{
    id: string
    snapshotDate: string
    totalAssets: string
    totalLiabilities: string
    netWorth: string
    ownerId?: string | null
  }>
  title?: string
  statementDate?: Date
}

/**
 * Formats a number in Indian number system with Rs. prefix for clean PDF rendering.
 * Uses ASCII '-' for negative numbers to avoid PDF WinAnsi glyph encoding bugs.
 */
export function formatPdfCurrency(num: number): string {
  const isNegative = num < 0
  const absVal = Math.abs(num)
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(absVal)
  return `${isNegative ? '-Rs. ' : 'Rs. '}${formatted}`
}

/**
 * Formats a number in Indian number system without currency prefix
 */
export function formatIndianNumber(num: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Formats gain / return with clear + / - sign and percentage without unicode issues
 */
export function formatPdfGain(gain: number, inv: number): string {
  if (!inv || inv <= 0) return '-'
  const isNeg = gain < 0
  const gainPct = (gain / inv) * 100
  const formatted = formatIndianNumber(Math.abs(gain))
  const sign = isNeg ? '-' : '+'
  return `${sign}Rs. ${formatted} (${sign}${Math.abs(gainPct).toFixed(1)}%)`
}

function getOwnerName(ownerId: string | null | undefined, owners: NetWorthExportOptions['owners']): string {
  if (!ownerId) return 'Self'
  const owner = owners.find(o => o.id === ownerId)
  return owner ? `${owner.name}${owner.isDefault ? ' (Self)' : ''}` : 'Self'
}

function getScopeLabel(options: NetWorthExportOptions): string {
  const { owners, selectedOwnerIds, isAllSelected } = options
  if (isAllSelected || selectedOwnerIds.length === 0 || (owners.length > 0 && selectedOwnerIds.length === owners.length)) {
    return 'All Household (Aggregated)'
  }
  if (selectedOwnerIds.length === 1) {
    const owner = owners.find(o => o.id === selectedOwnerIds[0])
    return owner ? `${owner.name}${owner.isDefault ? ' (Self)' : ''}` : 'Individual'
  }
  const names = owners
    .filter(o => selectedOwnerIds.includes(o.id))
    .map(o => o.name)
    .join(', ')
  return `Selected Members (${names})`
}

/**
 * Generates and downloads a rich, multi-page Net Worth PDF Statement
 */
export async function exportNetWorthPdf(options: NetWorthExportOptions) {
  const { data, owners, snapshots = [], statementDate = new Date() } = options
  const isMultiMember = options.selectedOwnerIds.length !== 1 && owners.length > 1
  const scopeLabel = getScopeLabel(options)
  const dateStr = format(statementDate, 'dd MMM yyyy')
  const timestampStr = format(new Date(), 'dd MMM yyyy, h:mm a')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36 // 0.5 in margins
  const contentWidth = pageWidth - margin * 2

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  // Top Accent Bar
  doc.setFillColor(99, 102, 241) // Indigo-500
  doc.rect(0, 0, pageWidth, 4, 'F')

  // Header Banner Background
  doc.setFillColor(15, 23, 42) // Slate-900
  doc.roundedRect(margin, 24, contentWidth, 68, 6, 6, 'F')

  // Brand Badge
  doc.setFillColor(99, 102, 241) // Indigo
  doc.roundedRect(margin + 14, 38, 70, 18, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('MOMONEY', margin + 49, 50, { align: 'center' })

  // Document Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('NET WORTH STATEMENT', margin + 92, 51)

  // Scope Pill & Subtitle
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184) // Slate-400
  doc.text(`Scope: ${scopeLabel}`, margin + 14, 75)
  doc.text(`Statement Date: ${dateStr}`, pageWidth - margin - 14, 51, { align: 'right' })
  doc.text(`Generated: ${timestampStr}`, pageWidth - margin - 14, 75, { align: 'right' })

  // ─── Stat Cards (3 across) ────────────────────────────────────────────────
  const cardY = 104
  const cardGap = 12
  const cardWidth = (contentWidth - cardGap * 2) / 3
  const cardHeight = 64

  // Card 1: Total Assets
  doc.setFillColor(248, 250, 252) // Slate-50
  doc.setDrawColor(226, 232, 240) // Slate-200
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 5, 5, 'FD')
  doc.setFillColor(16, 185, 129) // Emerald dot
  doc.circle(margin + 14, cardY + 18, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139) // Slate-500
  doc.text('TOTAL ASSETS', margin + 22, cardY + 21)
  doc.setFontSize(13)
  doc.setTextColor(5, 150, 105) // Emerald-600
  doc.text(formatPdfCurrency(data.totalAssets), margin + 14, cardY + 45)

  // Card 2: Total Liabilities
  const card2X = margin + cardWidth + cardGap
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 5, 5, 'FD')
  doc.setFillColor(244, 63, 94) // Rose dot
  doc.circle(card2X + 14, cardY + 18, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('TOTAL LIABILITIES', card2X + 22, cardY + 21)
  doc.setFontSize(13)
  doc.setTextColor(225, 29, 72) // Rose-600
  doc.text(formatPdfCurrency(data.totalLiabilities), card2X + 14, cardY + 45)

  // Card 3: Net Worth
  const card3X = margin + (cardWidth + cardGap) * 2
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 5, 5, 'FD')
  doc.setFillColor(99, 102, 241) // Indigo dot
  doc.circle(card3X + 14, cardY + 18, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('NET WORTH', card3X + 22, cardY + 21)
  doc.setFontSize(13)
  doc.setTextColor(data.netWorth >= 0 ? 15 : 225, data.netWorth >= 0 ? 23 : 29, data.netWorth >= 0 ? 42 : 72) // Slate-900 or Rose
  doc.text(formatPdfCurrency(data.netWorth), card3X + 14, cardY + 45)

  // ─── Asset Allocation Split (Equity, Debt, Cash, Mixed) ────────────────────
  let equityTotal = 0
  let debtTotal = 0
  let cashTotal = 0
  let mixedTotal = 0

  for (const asset of data.assets) {
    const val = parseFloat(asset.value || '0')
    const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
    if (tag === 'equity') equityTotal += val
    else if (tag === 'debt') debtTotal += val
    else if (tag === 'cash') cashTotal += val
    else if (tag === 'mixed') mixedTotal += val
  }

  const safeTotalAssets = data.totalAssets > 0 ? data.totalAssets : 1
  const eqPct = (equityTotal / safeTotalAssets) * 100
  const debtPct = (debtTotal / safeTotalAssets) * 100
  const cashPct = (cashTotal / safeTotalAssets) * 100
  const mixedPct = (mixedTotal / safeTotalAssets) * 100

  const allocY = 184
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, allocY, contentWidth, 72, 5, 5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text('Asset Allocation Split', margin + 14, allocY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `${eqPct.toFixed(0)}% Equity  |  ${debtPct.toFixed(0)}% Debt  |  ${cashPct.toFixed(0)}% Cash${mixedTotal > 0 ? `  |  ${mixedPct.toFixed(0)}% Mixed` : ''}`,
    pageWidth - margin - 14,
    allocY + 18,
    { align: 'right' }
  )

  // Allocation Bar
  const barX = margin + 14
  const barY = allocY + 28
  const barWidth = contentWidth - 28
  const barHeight = 10

  // Background bar
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(barX, barY, barWidth, barHeight, 3, 3, 'F')

  let currentBarX = barX
  const drawSegment = (pct: number, r: number, g: number, b: number) => {
    const w = (pct / 100) * barWidth
    if (w > 0) {
      doc.setFillColor(r, g, b)
      doc.rect(currentBarX, barY, w, barHeight, 'F')
      currentBarX += w
    }
  }

  drawSegment(eqPct, 99, 102, 241) // Indigo
  drawSegment(debtPct, 245, 158, 11) // Amber
  drawSegment(cashPct, 16, 185, 129) // Emerald
  drawSegment(mixedPct, 168, 85, 247) // Purple

  // Allocation Legend Chips
  const legendY = allocY + 54
  const splits = [
    { label: 'Equity', val: equityTotal, pct: eqPct, color: [99, 102, 241] },
    { label: 'Debt', val: debtTotal, pct: debtPct, color: [245, 158, 11] },
    { label: 'Cash', val: cashTotal, pct: cashPct, color: [16, 185, 129] },
    ...(mixedTotal > 0 ? [{ label: 'Mixed', val: mixedTotal, pct: mixedPct, color: [168, 85, 247] }] : []),
  ]

  let chipX = margin + 14
  splits.forEach(s => {
    doc.setFillColor(s.color[0], s.color[1], s.color[2])
    doc.circle(chipX + 3, legendY - 3, 3, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text(`${s.label}: ${formatPdfCurrency(s.val)} (${s.pct.toFixed(1)}%)`, chipX + 9, legendY)
    chipX += doc.getTextWidth(`${s.label}: ${formatPdfCurrency(s.val)} (${s.pct.toFixed(1)}%)`) + 16
  })

  // ─── Portfolio Breakdown Table by Category ─────────────────────────────────
  const mfAssets = data.assets.filter(a => a.type === 'mutual_fund')
  const stockAssets = data.assets.filter(a => a.type === 'stock')
  const depositAssets = data.assets.filter(a => ['fixed_deposit', 'recurring_deposit', 'ppf'].includes(a.type))
  const savingsAssets = data.assets.filter(a => a.type === 'savings_account')
  const genericAssets = data.assets.filter(a => ['real_estate', 'crypto', 'cash', 'other'].includes(a.type))

  const mfTotal = mfAssets.reduce((s, a) => s + parseFloat(a.value || '0'), 0)
  const stockTotal = stockAssets.reduce((s, a) => s + parseFloat(a.value || '0'), 0)
  const depositTotal = depositAssets.reduce((s, a) => s + parseFloat(a.value || '0'), 0)
  const savingsTotal = savingsAssets.reduce((s, a) => s + parseFloat(a.value || '0'), 0)
  const genericTotal = genericAssets.reduce((s, a) => s + parseFloat(a.value || '0'), 0)

  const categoryRows = [
    ['Mutual Funds', `${mfAssets.length} scheme${mfAssets.length === 1 ? '' : 's'}`, formatPdfCurrency(mfTotal), `${((mfTotal / safeTotalAssets) * 100).toFixed(1)}%`],
    ['Stocks & Direct Equities', `${stockAssets.length} stock${stockAssets.length === 1 ? '' : 's'}`, formatPdfCurrency(stockTotal), `${((stockTotal / safeTotalAssets) * 100).toFixed(1)}%`],
    ['Fixed Deposits & PPF', `${depositAssets.length} deposit${depositAssets.length === 1 ? '' : 's'}`, formatPdfCurrency(depositTotal), `${((depositTotal / safeTotalAssets) * 100).toFixed(1)}%`],
    ['Savings Accounts', `${savingsAssets.length} account${savingsAssets.length === 1 ? '' : 's'}`, formatPdfCurrency(savingsTotal), `${((savingsTotal / safeTotalAssets) * 100).toFixed(1)}%`],
    ['Real Estate & Other Assets', `${genericAssets.length} item${genericAssets.length === 1 ? '' : 's'}`, formatPdfCurrency(genericTotal), `${((genericTotal / safeTotalAssets) * 100).toFixed(1)}%`],
    ['Total Assets', `${data.assets.length} items`, formatPdfCurrency(data.totalAssets), '100.0%'],
    ['Total Liabilities', `${data.liabilities.length} account${data.liabilities.length === 1 ? '' : 's'}`, formatPdfCurrency(data.totalLiabilities), '-'],
    ['Net Worth', '', formatPdfCurrency(data.netWorth), '-'],
  ]

  autoTable(doc, {
    startY: 270,
    margin: { left: margin, right: margin },
    head: [['Asset / Liability Category', 'Holdings', 'Value (INR)', '% Portfolio']],
    body: categoryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 180 },
      1: { cellWidth: 100 },
      2: { halign: 'right', fontStyle: 'bold', cellWidth: 130 },
      3: { halign: 'right', cellWidth: 80 },
    },
    didParseCell: (hookData) => {
      // Highlight Total Assets, Liabilities, and Net Worth rows
      if (hookData.section === 'body') {
        const rowIndex = hookData.row.index
        if (rowIndex === 5) {
          // Total Assets row
          hookData.cell.styles.fillColor = [240, 253, 244] // Emerald-50
          hookData.cell.styles.fontStyle = 'bold'
          if (hookData.column.index === 2) hookData.cell.styles.textColor = [5, 150, 105]
        } else if (rowIndex === 6) {
          // Total Liabilities row
          hookData.cell.styles.fillColor = [255, 241, 242] // Rose-50
          hookData.cell.styles.fontStyle = 'bold'
          if (hookData.column.index === 2) hookData.cell.styles.textColor = [225, 29, 72]
        } else if (rowIndex === 7) {
          // Net Worth row
          hookData.cell.styles.fillColor = [238, 242, 255] // Indigo-50
          hookData.cell.styles.fontStyle = 'bold'
          if (hookData.column.index === 2) hookData.cell.styles.textColor = [67, 56, 202]
        }
      }
    },
  })

  // ─── Recent Snapshot History (if any) ──────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY || 450
  if (snapshots.length > 0 && finalY < pageHeight - 140) {
    const historyData = [...snapshots].reverse().slice(0, 5).map((snap) => {
      const d = format(new Date(snap.snapshotDate), 'dd MMM yyyy')
      const assetsVal = formatPdfCurrency(parseFloat(snap.totalAssets || '0'))
      const liabVal = formatPdfCurrency(parseFloat(snap.totalLiabilities || '0'))
      const nwVal = formatPdfCurrency(parseFloat(snap.netWorth || '0'))
      const ownerLabel = snap.ownerId ? getOwnerName(snap.ownerId, owners) : 'Household'
      return isMultiMember ? [d, ownerLabel, assetsVal, liabVal, nwVal] : [d, assetsVal, liabVal, nwVal]
    })

    const histHead = isMultiMember ? ['Snapshot Date', 'Member', 'Assets', 'Liabilities', 'Net Worth'] : ['Snapshot Date', 'Assets', 'Liabilities', 'Net Worth']

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    doc.text('Recent Snapshot Trajectory', margin, finalY + 18)

    autoTable(doc, {
      startY: finalY + 24,
      margin: { left: margin, right: margin },
      head: [histHead],
      body: historyData,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        textColor: [51, 65, 85],
      },
      columnStyles: isMultiMember
        ? { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }
        : { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSEQUENT PAGES: DETAILED INVESTMENTS & LIABILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  const drawSubsequentHeader = () => {
    doc.setFillColor(99, 102, 241)
    doc.rect(0, 0, pageWidth, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('MOMONEY NET WORTH STATEMENT', margin, 24)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`${scopeLabel} | As of ${dateStr}`, pageWidth - margin, 24, { align: 'right' })

    doc.setDrawColor(226, 232, 240)
    doc.line(margin, 28, pageWidth - margin, 28)
  }

  // Add Page 2
  doc.addPage()
  drawSubsequentHeader()

  let currentY = 40

  // ─── 1. Mutual Funds Details ───────────────────────────────────────────────
  if (mfAssets.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`1. Mutual Funds (${mfAssets.length})`, margin, currentY)
    doc.setFontSize(8.5)
    doc.setTextColor(5, 150, 105)
    doc.text(`Subtotal: ${formatPdfCurrency(mfTotal)}`, pageWidth - margin, currentY, { align: 'right' })

    const mfHead = isMultiMember
      ? ['Fund Name', 'Member', 'Category / Folio', 'Tag', 'Invested', 'Present Value', 'Gain / Loss']
      : ['Fund Name', 'Category / Folio', 'Tag', 'Invested', 'Present Value', 'Gain / Loss']

    const mfRows = mfAssets.map((asset) => {
      const inv = asset.metadata?.investedAmount || 0
      const pres = parseFloat(asset.value || '0')
      const gain = pres - inv
      const gainStr = formatPdfGain(gain, inv)
      const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
      const tagLabel = ASSET_TAG_LABELS[tag] || 'Equity'
      const catFolio = [asset.metadata?.category, asset.metadata?.folioNumber ? `Folio: ${asset.metadata.folioNumber}` : null]
        .filter(Boolean)
        .join(' | ') || '-'

      return isMultiMember
        ? [asset.name, getOwnerName(asset.ownerId, owners), catFolio, tagLabel, inv > 0 ? formatPdfCurrency(inv) : '-', formatPdfCurrency(pres), gainStr]
        : [asset.name, catFolio, tagLabel, inv > 0 ? formatPdfCurrency(inv) : '-', formatPdfCurrency(pres), gainStr]
    })

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: margin, right: margin },
      head: [mfHead],
      body: mfRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      columnStyles: isMultiMember
        ? { 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } }
        : { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' } },
      didDrawPage: () => drawSubsequentHeader(),
    })

    currentY = (doc as any).lastAutoTable.finalY + 18
  }

  // ─── 2. Direct Stocks & Equities ───────────────────────────────────────────
  if (stockAssets.length > 0) {
    if (currentY > pageHeight - 120) {
      doc.addPage()
      drawSubsequentHeader()
      currentY = 40
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`2. Stocks & Direct Equities (${stockAssets.length})`, margin, currentY)
    doc.setFontSize(8.5)
    doc.setTextColor(5, 150, 105)
    doc.text(`Subtotal: ${formatPdfCurrency(stockTotal)}`, pageWidth - margin, currentY, { align: 'right' })

    const stockHead = isMultiMember
      ? ['Stock Name', 'Member', 'Qty', 'Avg Price', 'LTP', 'Invested', 'Present Value', 'Gain / Loss']
      : ['Stock Name', 'Qty', 'Avg Price', 'LTP', 'Invested', 'Present Value', 'Gain / Loss']

    const stockRows = stockAssets.map((asset) => {
      const qty = asset.metadata?.quantity || 0
      const avgPrice = asset.metadata?.averageBuyPrice || 0
      const ltp = asset.metadata?.ltp || 0
      const inv = asset.metadata?.investedAmount || (qty && avgPrice ? qty * avgPrice : 0)
      const pres = parseFloat(asset.value || '0')
      const gain = pres - inv
      const gainStr = formatPdfGain(gain, inv)

      return isMultiMember
        ? [
            asset.name,
            getOwnerName(asset.ownerId, owners),
            qty ? formatIndianNumber(qty) : '-',
            avgPrice ? formatPdfCurrency(avgPrice) : '-',
            ltp ? formatPdfCurrency(ltp) : '-',
            inv > 0 ? formatPdfCurrency(inv) : '-',
            formatPdfCurrency(pres),
            gainStr,
          ]
        : [
            asset.name,
            qty ? formatIndianNumber(qty) : '-',
            avgPrice ? formatPdfCurrency(avgPrice) : '-',
            ltp ? formatPdfCurrency(ltp) : '-',
            inv > 0 ? formatPdfCurrency(inv) : '-',
            formatPdfCurrency(pres),
            gainStr,
          ]
    })

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: margin, right: margin },
      head: [stockHead],
      body: stockRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      columnStyles: isMultiMember
        ? { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' }, 7: { halign: 'right' } }
        : { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } },
      didDrawPage: () => drawSubsequentHeader(),
    })

    currentY = (doc as any).lastAutoTable.finalY + 18
  }

  // ─── 3. Fixed Deposits, RD & PPF ──────────────────────────────────────────
  if (depositAssets.length > 0) {
    if (currentY > pageHeight - 120) {
      doc.addPage()
      drawSubsequentHeader()
      currentY = 40
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`3. Fixed Deposits & PPF (${depositAssets.length})`, margin, currentY)
    doc.setFontSize(8.5)
    doc.setTextColor(5, 150, 105)
    doc.text(`Subtotal: ${formatPdfCurrency(depositTotal)}`, pageWidth - margin, currentY, { align: 'right' })

    const depHead = isMultiMember
      ? ['Deposit Name / Type', 'Member', 'Account #', 'Rate', 'Invested', 'Maturity Date', 'Maturity Amt', 'Present Value']
      : ['Deposit Name / Type', 'Account #', 'Rate', 'Invested', 'Maturity Date', 'Maturity Amt', 'Present Value']

    const depRows = depositAssets.map((asset) => {
      const typeLabel = asset.type === 'ppf' ? 'PPF' : asset.type === 'recurring_deposit' ? 'RD' : 'FD'
      const inv = asset.metadata?.investedAmount || 0
      const pres = parseFloat(asset.value || '0')
      const rate = asset.metadata?.interestRate ? `${asset.metadata.interestRate}%` : '-'
      const matDate = asset.metadata?.maturityDate ? format(new Date(asset.metadata.maturityDate), 'dd MMM yyyy') : '-'
      const matAmt = asset.metadata?.maturityAmount ? formatPdfCurrency(asset.metadata.maturityAmount) : '-'
      const acc = asset.metadata?.accountNumber || '-'

      return isMultiMember
        ? [`${asset.name} (${typeLabel})`, getOwnerName(asset.ownerId, owners), acc, rate, inv > 0 ? formatPdfCurrency(inv) : '-', matDate, matAmt, formatPdfCurrency(pres)]
        : [`${asset.name} (${typeLabel})`, acc, rate, inv > 0 ? formatPdfCurrency(inv) : '-', matDate, matAmt, formatPdfCurrency(pres)]
    })

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: margin, right: margin },
      head: [depHead],
      body: depRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      columnStyles: isMultiMember
        ? { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } }
        : { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
      didDrawPage: () => drawSubsequentHeader(),
    })

    currentY = (doc as any).lastAutoTable.finalY + 18
  }

  // ─── 4. Savings Accounts ──────────────────────────────────────────────────
  if (savingsAssets.length > 0) {
    if (currentY > pageHeight - 120) {
      doc.addPage()
      drawSubsequentHeader()
      currentY = 40
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`4. Savings Bank Accounts (${savingsAssets.length})`, margin, currentY)
    doc.setFontSize(8.5)
    doc.setTextColor(5, 150, 105)
    doc.text(`Subtotal: ${formatPdfCurrency(savingsTotal)}`, pageWidth - margin, currentY, { align: 'right' })

    const savHead = isMultiMember ? ['Bank / Account Name', 'Member', 'Account #', 'Balance (INR)'] : ['Bank / Account Name', 'Account #', 'Balance (INR)']

    const savRows = savingsAssets.map((asset) => {
      const pres = parseFloat(asset.value || '0')
      const acc = asset.metadata?.accountNumber || '-'
      return isMultiMember
        ? [asset.name, getOwnerName(asset.ownerId, owners), acc, formatPdfCurrency(pres)]
        : [asset.name, acc, formatPdfCurrency(pres)]
    })

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: margin, right: margin },
      head: [savHead],
      body: savRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      columnStyles: isMultiMember ? { 3: { halign: 'right', fontStyle: 'bold' } } : { 2: { halign: 'right', fontStyle: 'bold' } },
      didDrawPage: () => drawSubsequentHeader(),
    })

    currentY = (doc as any).lastAutoTable.finalY + 18
  }

  // ─── 5. Real Estate & Other Assets ────────────────────────────────────────
  if (genericAssets.length > 0) {
    if (currentY > pageHeight - 120) {
      doc.addPage()
      drawSubsequentHeader()
      currentY = 40
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`5. Real Estate & Other Assets (${genericAssets.length})`, margin, currentY)
    doc.setFontSize(8.5)
    doc.setTextColor(5, 150, 105)
    doc.text(`Subtotal: ${formatPdfCurrency(genericTotal)}`, pageWidth - margin, currentY, { align: 'right' })

    const genHead = isMultiMember ? ['Asset Name', 'Category', 'Member', 'Comments', 'Valuation (INR)'] : ['Asset Name', 'Category', 'Comments', 'Valuation (INR)']

    const genRows = genericAssets.map((asset) => {
      const pres = parseFloat(asset.value || '0')
      const cat = asset.type.replace('_', ' ').toUpperCase()
      const comm = asset.metadata?.comments || '-'
      return isMultiMember
        ? [asset.name, cat, getOwnerName(asset.ownerId, owners), comm, formatPdfCurrency(pres)]
        : [asset.name, cat, comm, formatPdfCurrency(pres)]
    })

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: margin, right: margin },
      head: [genHead],
      body: genRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      columnStyles: isMultiMember ? { 4: { halign: 'right', fontStyle: 'bold' } } : { 3: { halign: 'right', fontStyle: 'bold' } },
      didDrawPage: () => drawSubsequentHeader(),
    })

    currentY = (doc as any).lastAutoTable.finalY + 18
  }

  // ─── 6. Liabilities & Outstanding Loans ────────────────────────────────────
  if (data.liabilities.length > 0) {
    if (currentY > pageHeight - 120) {
      doc.addPage()
      drawSubsequentHeader()
      currentY = 40
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`6. Liabilities & Loans (${data.liabilities.length})`, margin, currentY)
    doc.setFontSize(8.5)
    doc.setTextColor(225, 29, 72)
    doc.text(`Subtotal: ${formatPdfCurrency(data.totalLiabilities)}`, pageWidth - margin, currentY, { align: 'right' })

    const liabHead = isMultiMember
      ? ['Liability / Loan Name', 'Type', 'Member', 'Interest Rate', 'Monthly EMI', 'Outstanding Amount']
      : ['Liability / Loan Name', 'Type', 'Interest Rate', 'Monthly EMI', 'Outstanding Amount']

    const liabRows = data.liabilities.map((liab) => {
      const amt = parseFloat(liab.outstandingAmount || '0')
      const typeLabel = (liab.type || '').replace('_', ' ').toUpperCase()
      const rate = liab.interestRate ? `${liab.interestRate}%` : '-'
      const emi = liab.monthlyPayment ? formatPdfCurrency(parseFloat(liab.monthlyPayment)) : '-'
      return isMultiMember
        ? [liab.name, typeLabel, getOwnerName(liab.ownerId, owners), rate, emi, formatPdfCurrency(amt)]
        : [liab.name, typeLabel, rate, emi, formatPdfCurrency(amt)]
    })

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: margin, right: margin },
      head: [liabHead],
      body: liabRows,
      theme: 'striped',
      headStyles: {
        fillColor: [159, 18, 57], // Rose-900
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      columnStyles: isMultiMember
        ? { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
        : { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      didDrawPage: () => drawSubsequentHeader(),
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER ON ALL PAGES
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184) // Slate-400

    doc.setDrawColor(226, 232, 240)
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)

    doc.text('Generated by MoMoney | Confidential Personal Financial Statement', margin, pageHeight - 12)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' })
  }

  // Save PDF
  const filename = `Net_Worth_Statement_${format(statementDate, 'yyyy-MM-dd')}.pdf`
  doc.save(filename)
}

/**
 * Generates and downloads a clean, structured Net Worth CSV export
 */
export function exportNetWorthCsv(options: NetWorthExportOptions) {
  const { data, owners, statementDate = new Date() } = options
  const isMultiMember = options.selectedOwnerIds.length !== 1 && owners.length > 1
  const scopeLabel = getScopeLabel(options)
  const dateStr = format(statementDate, 'yyyy-MM-dd')

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""'
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return `"${str}"`
  }

  const rows: string[][] = []

  // 1. Report Header Section
  rows.push(['MOMONEY - NET WORTH STATEMENT'])
  rows.push(['Scope', scopeLabel])
  rows.push(['Statement Date', format(statementDate, 'dd MMM yyyy')])
  rows.push(['Generated At', format(new Date(), 'dd MMM yyyy, h:mm a')])
  rows.push([])
  rows.push(['EXECUTIVE SUMMARY'])
  rows.push(['Total Assets (INR)', String(data.totalAssets)])
  rows.push(['Total Liabilities (INR)', String(data.totalLiabilities)])
  rows.push(['Net Worth (INR)', String(data.netWorth)])
  rows.push([])

  // 2. Asset Allocation Section
  let equityTotal = 0
  let debtTotal = 0
  let cashTotal = 0
  let mixedTotal = 0

  for (const asset of data.assets) {
    const val = parseFloat(asset.value || '0')
    const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
    if (tag === 'equity') equityTotal += val
    else if (tag === 'debt') debtTotal += val
    else if (tag === 'cash') cashTotal += val
    else if (tag === 'mixed') mixedTotal += val
  }

  const safeTotalAssets = data.totalAssets > 0 ? data.totalAssets : 1

  rows.push(['ASSET ALLOCATION BREAKDOWN'])
  rows.push(['Class', 'Total Value (INR)', 'Share of Assets (%)'])
  rows.push(['Equity', String(equityTotal), ((equityTotal / safeTotalAssets) * 100).toFixed(2)])
  rows.push(['Debt', String(debtTotal), ((debtTotal / safeTotalAssets) * 100).toFixed(2)])
  rows.push(['Cash', String(cashTotal), ((cashTotal / safeTotalAssets) * 100).toFixed(2)])
  if (mixedTotal > 0) {
    rows.push(['Mixed / Hybrid', String(mixedTotal), ((mixedTotal / safeTotalAssets) * 100).toFixed(2)])
  }
  rows.push([])

  // 3. Itemized Assets List
  rows.push(['ITEMIZED ASSETS'])
  const assetHeaders = [
    'Asset Category',
    'Asset Name',
    ...(isMultiMember ? ['Owner / Member'] : []),
    'Asset Tag',
    'Invested Amount (INR)',
    'Present Value (INR)',
    'Gain / Loss (INR)',
    'Gain / Loss (%)',
    'Quantity',
    'Avg Buy Price (INR)',
    'Current LTP (INR)',
    'Folio / Account Number',
    'Interest Rate (%)',
    'Maturity Date',
    'Maturity Amount (INR)',
    'Comments / Notes',
    'Valuation Date',
  ]
  rows.push(assetHeaders)

  for (const asset of data.assets) {
    const inv = asset.metadata?.investedAmount || 0
    const pres = parseFloat(asset.value || '0')
    const gain = inv > 0 ? pres - inv : ''
    const gainPct = inv > 0 ? ((pres - inv) / inv) * 100 : ''
    const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
    const tagLabel = ASSET_TAG_LABELS[tag] || 'Equity'

    const catName =
      asset.type === 'mutual_fund'
        ? 'Mutual Fund'
        : asset.type === 'stock'
        ? 'Stock / Equity'
        : ['fixed_deposit', 'recurring_deposit', 'ppf'].includes(asset.type)
        ? 'Deposit / PPF'
        : asset.type === 'savings_account'
        ? 'Savings Bank'
        : asset.type.replace('_', ' ')

    const row = [
      catName,
      asset.name,
      ...(isMultiMember ? [getOwnerName(asset.ownerId, owners)] : []),
      tagLabel,
      inv > 0 ? String(inv) : '',
      String(pres),
      gain !== '' ? String(gain) : '',
      gainPct !== '' ? Number(gainPct).toFixed(2) : '',
      asset.metadata?.quantity !== undefined ? String(asset.metadata.quantity) : '',
      asset.metadata?.averageBuyPrice !== undefined ? String(asset.metadata.averageBuyPrice) : '',
      asset.metadata?.ltp !== undefined ? String(asset.metadata.ltp) : '',
      asset.metadata?.folioNumber || asset.metadata?.accountNumber || '',
      asset.metadata?.interestRate !== undefined ? String(asset.metadata.interestRate) : '',
      asset.metadata?.maturityDate ? format(new Date(asset.metadata.maturityDate), 'yyyy-MM-dd') : '',
      asset.metadata?.maturityAmount !== undefined ? String(asset.metadata.maturityAmount) : '',
      asset.metadata?.comments || '',
      asset.valuationDate ? format(new Date(asset.valuationDate), 'yyyy-MM-dd') : '',
    ]
    rows.push(row)
  }
  rows.push([])

  // 4. Itemized Liabilities List
  rows.push(['ITEMIZED LIABILITIES'])
  const liabHeaders = [
    'Liability Name',
    'Liability Type',
    ...(isMultiMember ? ['Owner / Member'] : []),
    'Outstanding Amount (INR)',
    'Interest Rate (%)',
    'Monthly Payment / EMI (INR)',
  ]
  rows.push(liabHeaders)

  for (const liab of data.liabilities) {
    const amt = parseFloat(liab.outstandingAmount || '0')
    const row = [
      liab.name,
      (liab.type || '').replace('_', ' ').toUpperCase(),
      ...(isMultiMember ? [getOwnerName(liab.ownerId, owners)] : []),
      String(amt),
      liab.interestRate !== undefined && liab.interestRate !== null ? String(liab.interestRate) : '',
      liab.monthlyPayment !== undefined && liab.monthlyPayment !== null ? String(liab.monthlyPayment) : '',
    ]
    rows.push(row)
  }

  // Generate CSV Content & Trigger Download
  const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `Net_Worth_Statement_${dateStr}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
