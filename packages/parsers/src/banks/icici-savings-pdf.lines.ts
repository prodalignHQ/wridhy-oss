import type { ParsedTransaction } from '../base.parser.js';

// ─── Pure line-based ICICI PDF transaction extractor ─────────────────────────
// Isomorphic: no Node/PDF dependencies. Both the server parser (pdf-parse)
// and the browser parser (pdfjs-dist) feed extracted text lines here.

const dateRegex = /^(\d{2}-\d{2}-\d{4})\s*(.*)$/;
const txnDataRegex = /(.*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;

const parseAmount = (str: string) => parseFloat(str.replace(/,/g, ''));

function processTransaction(
  linesToProcess: string[],
  transactions: ParsedTransaction[],
  currentBalance: { value: number | null }
) {
  if (linesToProcess.length === 0) return;

  const joined = linesToProcess.join(' ').trim();

  // Handle opening balance lines (e.g. 01-02-2026 B/F 3,51,271.42)
  if (joined.includes('B/F')) {
    const match = joined.match(/([\d,]+\.\d{2})$/);
    if (match) {
      currentBalance.value = parseAmount(match[1]!);
    }
    return;
  }

  const dateMatch = joined.match(dateRegex);
  if (!dateMatch) return;

  const valueDateStr = dateMatch[1]!;
  const remainingText = dateMatch[2]!.trim();

  const dataMatch = remainingText.match(txnDataRegex);
  if (!dataMatch) return;

  const description = dataMatch[1]!.trim();
  const amount = parseAmount(dataMatch[2]!);
  const balance = parseAmount(dataMatch[3]!);

  // Determine transaction type (debit/credit) using balance reconciliation
  let type: 'debit' | 'credit' = 'debit';
  if (currentBalance.value !== null) {
    const isCredit = Math.abs((currentBalance.value + amount) - balance) < 0.05;
    const isDebit = Math.abs((currentBalance.value - amount) - balance) < 0.05;

    if (isCredit) {
      type = 'credit';
    } else if (isDebit) {
      type = 'debit';
    }
  }

  const [day, month, year] = valueDateStr.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  if (isNaN(date.getTime())) return;

  transactions.push({
    date,
    description,
    amount,
    type,
    balance,
  });

  currentBalance.value = balance;
}

export function parseIciciPdfLines(lines: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  let isReadingTransactions = false;
  let currentTransactionLines: string[] = [];
  const currentBalance = { value: null as number | null };

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of transactions
    if (trimmed.includes('DATE MODE PARTICULARS DEPOSITS WITHDRAWALS BALANCE') || trimmed.includes('Account Statement')) {
      isReadingTransactions = true;
      continue;
    }

    if (!isReadingTransactions) continue;

    // Skip header/footer and non-transaction lines
    const isHeaderFooter =
      trimmed.startsWith('Total:') ||
      trimmed.startsWith('Statement of Transactions') ||
      trimmed.startsWith('--') ||
      trimmed.startsWith('Page ') ||
      trimmed.includes('Summary of TDS') ||
      trimmed.includes('Account Related Other Information') ||
      trimmed.length === 0;

    if (isHeaderFooter) {
      if (currentTransactionLines.length > 0) {
        processTransaction(currentTransactionLines, transactions, currentBalance);
        currentTransactionLines = [];
      }
      // Stop reading if we hit footer sections
      if (trimmed.startsWith('Total:') || trimmed.includes('Summary of TDS') || trimmed.includes('Account Related Other Information')) {
        isReadingTransactions = false;
      }
      continue;
    }

    // Transactions start with a date "DD-MM-YYYY"
    if (/^\d{2}-\d{2}-\d{4}/.test(trimmed)) {
      if (currentTransactionLines.length > 0) {
        processTransaction(currentTransactionLines, transactions, currentBalance);
      }
      currentTransactionLines = [trimmed];
    } else if (currentTransactionLines.length > 0) {
      // Append multi-line descriptions
      currentTransactionLines.push(trimmed);
    }
  }

  // Process last transaction
  if (currentTransactionLines.length > 0) {
    processTransaction(currentTransactionLines, transactions, currentBalance);
  }

  return transactions;
}
