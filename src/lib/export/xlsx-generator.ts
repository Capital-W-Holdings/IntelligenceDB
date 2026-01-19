import * as XLSX from 'xlsx'
import { ModelWorkbook, ModelSheet, ModelLineItem } from '../model-generator/types'

interface ExportOptions {
  includeProvenance: boolean
  formatNumbers: boolean
  includeFormulas: boolean
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeProvenance: true,
  formatNumbers: true,
  includeFormulas: false,
}

/**
 * Generate Excel workbook from financial model
 */
export function generateXLSX(
  model: ModelWorkbook,
  options: Partial<ExportOptions> = {}
): XLSX.WorkBook {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const workbook = XLSX.utils.book_new()

  // Add cover sheet
  const coverData = generateCoverSheet(model)
  const coverSheet = XLSX.utils.aoa_to_sheet(coverData)
  XLSX.utils.book_append_sheet(workbook, coverSheet, 'Summary')

  // Add financial statement sheets
  if (model.sheets.incomeStatement) {
    const sheet = generateFinancialSheet(model.sheets.incomeStatement, opts)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Income Statement')
  }

  if (model.sheets.balanceSheet) {
    const sheet = generateFinancialSheet(model.sheets.balanceSheet, opts)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Balance Sheet')
  }

  if (model.sheets.cashFlow) {
    const sheet = generateFinancialSheet(model.sheets.cashFlow, opts)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cash Flow')
  }

  if (model.sheets.kpis) {
    const sheet = generateFinancialSheet(model.sheets.kpis, opts)
    XLSX.utils.book_append_sheet(workbook, sheet, 'KPIs')
  }

  // Add provenance sheet if enabled
  if (opts.includeProvenance) {
    const provenanceData = generateProvenanceSheet(model)
    const provenanceSheet = XLSX.utils.aoa_to_sheet(provenanceData)
    XLSX.utils.book_append_sheet(workbook, provenanceSheet, 'Data Sources')
  }

  return workbook
}

/**
 * Generate cover/summary sheet
 */
function generateCoverSheet(model: ModelWorkbook): (string | number)[][] {
  const rows: (string | number)[][] = []

  // Header
  rows.push(['Healthcare Filings Intelligence Database'])
  rows.push(['Financial Model Export'])
  rows.push([])

  // Company info
  rows.push(['Company Information'])
  rows.push(['Name:', model.company.name])
  rows.push(['Ticker:', model.company.ticker || 'N/A'])
  rows.push(['CIK:', model.company.cik])
  rows.push(['Sector:', model.company.sector || 'N/A'])
  rows.push([])

  // Export info
  rows.push(['Export Information'])
  rows.push(['Generated:', model.generatedAt])
  rows.push(['Source Filings:', model.sourceFilings.length])
  rows.push([])

  // Filing list
  rows.push(['Source Filing Accession Numbers:'])
  for (const accession of model.sourceFilings) {
    rows.push([accession])
  }
  rows.push([])

  // Disclaimer
  rows.push(['DISCLAIMER'])
  rows.push([
    'This data is extracted from SEC EDGAR filings. All values should be verified against original filings.',
  ])
  rows.push([
    'Financial data is presented as-filed and may not reflect restatements or corrections.',
  ])

  return rows
}

/**
 * Generate financial statement sheet
 */
function generateFinancialSheet(
  modelSheet: ModelSheet,
  options: ExportOptions
): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = []

  // Title row
  rows.push([modelSheet.name])
  rows.push([])

  // Header row with periods
  const headerRow: (string | null)[] = ['', ...modelSheet.headers]
  if (options.includeProvenance) {
    // Add provenance columns for each period
    for (const header of modelSheet.headers) {
      headerRow.push(`${header} Source`)
    }
  }
  rows.push(headerRow)

  // Data rows by section
  for (const section of modelSheet.sections) {
    // Section header
    rows.push([section.title])

    // Section items
    for (const item of section.items) {
      const row: (string | number | null)[] = [item.label]

      // Add values
      for (let i = 0; i < item.values.length; i++) {
        const value = item.values[i]
        if (value !== null) {
          row.push(formatValue(value, item.unit, options.formatNumbers))
        } else {
          row.push(null)
        }
      }

      // Add provenance if enabled
      if (options.includeProvenance) {
        for (let i = 0; i < item.provenance.length; i++) {
          const prov = item.provenance[i]
          if (prov) {
            row.push(prov.accessionNumber)
          } else {
            row.push(null)
          }
        }
      }

      rows.push(row)
    }

    // Empty row between sections
    rows.push([])
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths
  sheet['!cols'] = [
    { wch: 30 }, // Label column
    ...modelSheet.headers.map(() => ({ wch: 15 })), // Value columns
  ]

  return sheet
}

/**
 * Generate provenance/sources sheet
 */
function generateProvenanceSheet(model: ModelWorkbook): (string | number)[][] {
  const rows: (string | number)[][] = []

  rows.push(['Data Provenance / Source Filings'])
  rows.push([])
  rows.push(['Accession Number', 'Form Type', 'Filing Date', 'SEC URL'])

  // Collect all unique sources
  const sources = new Map<
    string,
    { formType: string; filingDate: string; sourceUrl: string }
  >()

  const collectSources = (sheet?: ModelSheet) => {
    if (!sheet) return
    for (const section of sheet.sections) {
      for (const item of section.items) {
        for (const prov of item.provenance) {
          if (prov && !sources.has(prov.accessionNumber)) {
            sources.set(prov.accessionNumber, {
              formType: prov.formType,
              filingDate: prov.filingDate,
              sourceUrl: prov.sourceUrl,
            })
          }
        }
      }
    }
  }

  collectSources(model.sheets.incomeStatement)
  collectSources(model.sheets.balanceSheet)
  collectSources(model.sheets.cashFlow)
  collectSources(model.sheets.kpis)

  for (const [accession, info] of sources) {
    rows.push([accession, info.formType, info.filingDate, info.sourceUrl])
  }

  rows.push([])
  rows.push(['Note: Click on SEC URLs to view original filings'])

  return rows
}

/**
 * Format value for display
 */
function formatValue(
  value: number,
  unit: string,
  shouldFormat: boolean
): number | string {
  if (!shouldFormat) return value

  switch (unit) {
    case 'USD_billions':
      return (value / 1_000_000_000).toFixed(2)
    case 'USD_millions':
      return (value / 1_000_000).toFixed(1)
    case 'USD_per_share':
      return value.toFixed(2)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'ratio':
      return value.toFixed(2)
    case 'shares':
      return Math.round(value / 1_000_000) // Show in millions
    default:
      return value
  }
}

/**
 * Convert workbook to buffer for download
 */
export function workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/**
 * Get suggested filename for export
 */
export function getSuggestedFilename(model: ModelWorkbook): string {
  const ticker = model.company.ticker || model.company.cik
  const date = new Date().toISOString().split('T')[0]
  return `${ticker}_financial_model_${date}.xlsx`
}
