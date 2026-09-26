import { PDFParse } from 'pdf-parse';
import type { BankParser, ParsedTransaction } from '../base.parser.js';
import { parseIciciPdfLines } from './icici-savings-pdf.lines.js';

/**
 * ICICI Bank Savings Account Statement Parser
 * Format: PDF (Node path via pdf-parse; browser path lives in
 * apps/web/lib/engine/pdf.ts and reuses parseIciciPdfLines)
 */
export const iciciSavingsPdfParser: BankParser = {
  bankId: 'icici_savings_pdf',
  displayName: 'ICICI Bank Savings Account (PDF)',

  async parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const lines = result.text.split('\n');
      return parseIciciPdfLines(lines);
    } catch (e) {
      console.warn('PDF parsing error', e);
      return [];
    }
  },
};
