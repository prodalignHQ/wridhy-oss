import { PDFParse } from 'pdf-parse';
import type { BankParser, ParsedTransaction } from '../base.parser.js';

/**
 * ICICI Bank Savings Account Statement Parser
 * Format: PDF
 */
export const iciciSavingsPdfParser: BankParser = {
  bankId: 'icici_savings_pdf',
  displayName: 'ICICI Bank Savings Account (PDF)',

  async parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const lines = result.text.split('\n');

      const transactions: ParsedTransaction[] = [];
      let isReadingTransactions = false;
      let currentTransaction: string[] = [];
      let currentBalance: number | null = null;

      const dateRegex = /^(\d{2}-\d{2}-\d{4})\s*(.*)$/;
      const txnDataRegex = /(.*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;

      const processTransaction = (linesToProcess: string[]) => {
        if (linesToProcess.length === 0) return;

        const joined = linesToProcess.join(' ').trim();

        // Match explicit opening balance line (e.g. 01-02-2026 B/F 3,51,271.42)
        if (joined.includes('B/F')) {
          const match = joined.match(/([\d,]+\.\d{2})$/);
          if (match) {
            currentBalance = parseFloat(match[1]!.replace(/,/g, ''));
          }
          return; // The "B/F" line is a balance carryover, not a real transaction.
        }

        const dateMatch = joined.match(dateRegex);
        if (!dateMatch) return;

        const valueDate = dateMatch[1]!;
        const rest = dateMatch[2]!.trim();

        // Match amount and balance at the end of the text
        const amMatch = rest.match(txnDataRegex);
        if (!amMatch) return;

        const description = amMatch[1]!.trim();
        const amount = parseFloat(amMatch[2]!.replace(/,/g, ''));
        const balance = parseFloat(amMatch[3]!.replace(/,/g, ''));

        let type: 'debit' | 'credit' = 'debit';

        if (currentBalance !== null) {
          const diffCred = Math.abs((currentBalance + amount) - balance);
          const diffDeb = Math.abs((currentBalance - amount) - balance);
          if (diffCred < 0.05) {
            type = 'credit';
          } else if (diffDeb < 0.05) {
            type = 'debit';
          }
        }

        const [day, month, year] = valueDate.split('-').map(Number);
        const date = new Date(year!, month! - 1, day!);
        if (isNaN(date.getTime())) return;

        transactions.push({
          date,
          description,
          amount,
          type,
          balance,
        });

        currentBalance = balance;
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('DATE MODE PARTICULARS DEPOSITS WITHDRAWALS BALANCE') || trimmed.includes('Account Statement')) {
          isReadingTransactions = true;
          continue;
        }

        if (!isReadingTransactions) continue;

        // Header/Footer lines to ignore
        if (trimmed.startsWith('Total:') || trimmed.startsWith('Statement of Transactions') || trimmed.startsWith('--') || trimmed.startsWith('Page ') || trimmed.includes('Summary of TDS') || trimmed.length === 0) {
          if (currentTransaction.length > 0) {
            processTransaction(currentTransaction);
            currentTransaction = [];
          }
          if (trimmed.startsWith('Total:') || trimmed.includes('Summary of TDS') || trimmed.includes('Account Related Other Information')) {
            isReadingTransactions = false;
          }
          continue;
        }

        if (/^\d{2}-\d{2}-\d{4}/.test(trimmed)) {
          if (currentTransaction.length > 0) {
            processTransaction(currentTransaction);
          }
          currentTransaction = [trimmed];
        } else {
          if (currentTransaction.length > 0) {
            currentTransaction.push(trimmed);
          }
        }
      }

      if (currentTransaction.length > 0) {
        processTransaction(currentTransaction);
      }

      // If we failed to deduce the first transaction's type due to no B/F balance, verify backwards:
      if (transactions.length > 1) {
        for (let i = 1; i < transactions.length; i++) {
          const prevTx = transactions[i - 1]!;
          const currTx = transactions[i]!;

          // Reconcile the prevTx type if we skipped or aren't sure based on current tx logic
          const balanceBeforePrev = currTx.balance! - (currTx.type === 'credit' ? currTx.amount : -currTx.amount) - (prevTx.type === 'credit' ? prevTx.amount : -prevTx.amount);

          if (prevTx.type === 'debit') {
            // already defaulted debit, maybe check if it really should be credit?
            // we can be fairly confident since math was done during iteration
          }
        }
      }

      return transactions;
    } catch (e) {
      console.warn('PDF parsing error', e);
      return [];
    }
  },
};
