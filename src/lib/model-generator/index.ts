import { SECCompanyFacts } from '../sec/types'
import { parseXBRLFacts, organizeByPeriod, FinancialDataset } from '../parser/xbrl-parser'
import { ModelWorkbook, ModelCompanyInfo } from './types'
import { buildIncomeStatement } from './income-statement'
import { buildBalanceSheet } from './balance-sheet'
import { buildCashFlowStatement } from './cash-flow'
import { buildKPISheet } from './kpi-sheet'

export interface ModelGeneratorOptions {
  periods?: number
  includeKPIs?: boolean
  includeBalanceSheet?: boolean
  includeCashFlow?: boolean
}

const DEFAULT_OPTIONS: ModelGeneratorOptions = {
  periods: 5,
  includeKPIs: true,
  includeBalanceSheet: true,
  includeCashFlow: true,
}

/**
 * Generate complete financial model workbook from SEC company facts
 */
export function generateFinancialModel(
  companyFacts: SECCompanyFacts,
  companyInfo: ModelCompanyInfo,
  options: ModelGeneratorOptions = {}
): ModelWorkbook {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Parse XBRL facts into normalized format
  const normalizedFacts = parseXBRLFacts(companyFacts)
  const dataset = organizeByPeriod(normalizedFacts)

  // Collect all source filings
  const sourceFilings = new Set<string>()
  for (const fact of normalizedFacts) {
    if (fact.accessionNumber) {
      sourceFilings.add(fact.accessionNumber)
    }
  }

  // Build model sheets
  const workbook: ModelWorkbook = {
    company: companyInfo,
    generatedAt: new Date().toISOString(),
    sourceFilings: Array.from(sourceFilings),
    sheets: {},
  }

  // Always include income statement
  workbook.sheets.incomeStatement = buildIncomeStatement(
    dataset,
    companyInfo.cik,
    opts.periods
  )

  // Optional sheets
  if (opts.includeBalanceSheet) {
    workbook.sheets.balanceSheet = buildBalanceSheet(
      dataset,
      companyInfo.cik,
      opts.periods
    )
  }

  if (opts.includeCashFlow) {
    workbook.sheets.cashFlow = buildCashFlowStatement(
      dataset,
      companyInfo.cik,
      opts.periods
    )
  }

  if (opts.includeKPIs) {
    workbook.sheets.kpis = buildKPISheet(
      dataset,
      companyInfo.cik,
      companyInfo.sector || 'Unknown',
      opts.periods
    )
  }

  return workbook
}

/**
 * Generate model from pre-parsed dataset
 */
export function generateModelFromDataset(
  dataset: FinancialDataset,
  companyInfo: ModelCompanyInfo,
  options: ModelGeneratorOptions = {}
): ModelWorkbook {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Collect all source filings
  const sourceFilings = new Set<string>()
  for (const fact of dataset.rawFacts) {
    if (fact.accessionNumber) {
      sourceFilings.add(fact.accessionNumber)
    }
  }

  const workbook: ModelWorkbook = {
    company: companyInfo,
    generatedAt: new Date().toISOString(),
    sourceFilings: Array.from(sourceFilings),
    sheets: {},
  }

  workbook.sheets.incomeStatement = buildIncomeStatement(
    dataset,
    companyInfo.cik,
    opts.periods
  )

  if (opts.includeBalanceSheet) {
    workbook.sheets.balanceSheet = buildBalanceSheet(
      dataset,
      companyInfo.cik,
      opts.periods
    )
  }

  if (opts.includeCashFlow) {
    workbook.sheets.cashFlow = buildCashFlowStatement(
      dataset,
      companyInfo.cik,
      opts.periods
    )
  }

  if (opts.includeKPIs) {
    workbook.sheets.kpis = buildKPISheet(
      dataset,
      companyInfo.cik,
      companyInfo.sector || 'Unknown',
      opts.periods
    )
  }

  return workbook
}

// Re-export types and functions for convenience
export type { ModelWorkbook, ModelSheet, ModelLineItem, ModelCompanyInfo } from './types'
export { generateXLSX, workbookToBuffer, getSuggestedFilename } from '../export/xlsx-generator'
