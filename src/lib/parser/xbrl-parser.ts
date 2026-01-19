import { SECCompanyFacts, SECFactUnit } from '../sec/types'

// Standard GAAP tag mappings - handles taxonomy variations
const TAG_MAPPINGS: Record<string, string> = {
  // Revenue
  Revenues: 'revenue',
  RevenueFromContractWithCustomerExcludingAssessedTax: 'revenue',
  SalesRevenueNet: 'revenue',
  SalesRevenueGoodsNet: 'revenue',
  RevenueFromContractWithCustomerIncludingAssessedTax: 'revenue',
  TotalRevenuesAndOtherIncome: 'revenue',

  // Cost of Revenue
  CostOfRevenue: 'cost_of_revenue',
  CostOfGoodsAndServicesSold: 'cost_of_revenue',
  CostOfGoodsSold: 'cost_of_revenue',

  // Gross Profit
  GrossProfit: 'gross_profit',

  // Operating Expenses
  OperatingExpenses: 'operating_expenses',
  CostsAndExpenses: 'total_costs_and_expenses',

  // R&D
  ResearchAndDevelopmentExpense: 'r_and_d_expense',
  ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost: 'r_and_d_expense',

  // SG&A
  SellingGeneralAndAdministrativeExpense: 'sg_and_a_expense',
  GeneralAndAdministrativeExpense: 'g_and_a_expense',
  SellingAndMarketingExpense: 'selling_expense',

  // Operating Income
  OperatingIncomeLoss: 'operating_income',
  IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest: 'pretax_income',

  // Net Income
  NetIncomeLoss: 'net_income',
  ProfitLoss: 'net_income',
  NetIncomeLossAvailableToCommonStockholdersBasic: 'net_income_common',
  NetIncomeLossAttributableToParent: 'net_income',

  // EPS
  EarningsPerShareBasic: 'eps_basic',
  EarningsPerShareDiluted: 'eps_diluted',

  // Cash & Equivalents
  CashAndCashEquivalentsAtCarryingValue: 'cash_and_equivalents',
  Cash: 'cash',
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents: 'cash_and_equivalents',

  // Marketable Securities
  MarketableSecuritiesCurrent: 'marketable_securities_current',
  AvailableForSaleSecuritiesCurrent: 'marketable_securities_current',
  ShortTermInvestments: 'short_term_investments',

  // Receivables
  AccountsReceivableNetCurrent: 'accounts_receivable',
  AccountsReceivableNet: 'accounts_receivable',

  // Inventory
  InventoryNet: 'inventory',

  // Current Assets
  AssetsCurrent: 'current_assets',

  // PPE
  PropertyPlantAndEquipmentNet: 'ppe_net',

  // Goodwill & Intangibles
  Goodwill: 'goodwill',
  IntangibleAssetsNetExcludingGoodwill: 'intangible_assets',

  // Total Assets
  Assets: 'total_assets',

  // Accounts Payable
  AccountsPayableCurrent: 'accounts_payable',

  // Current Liabilities
  LiabilitiesCurrent: 'current_liabilities',

  // Debt
  LongTermDebt: 'long_term_debt',
  LongTermDebtNoncurrent: 'long_term_debt',
  DebtCurrent: 'short_term_debt',
  LongTermDebtCurrent: 'current_portion_long_term_debt',

  // Total Liabilities
  Liabilities: 'total_liabilities',

  // Equity
  StockholdersEquity: 'stockholders_equity',
  StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest: 'total_equity',

  // Cash Flow
  NetCashProvidedByUsedInOperatingActivities: 'operating_cash_flow',
  NetCashProvidedByUsedInInvestingActivities: 'investing_cash_flow',
  NetCashProvidedByUsedInFinancingActivities: 'financing_cash_flow',

  // Shares
  CommonStockSharesOutstanding: 'shares_outstanding',
  WeightedAverageNumberOfSharesOutstandingBasic: 'weighted_avg_shares_basic',
  WeightedAverageNumberOfDilutedSharesOutstanding: 'weighted_avg_shares_diluted',

  // Healthcare-specific metrics
  PremiumsEarnedNet: 'premiums_earned', // Insurance/Payers
  BenefitsLossesAndExpenses: 'benefits_expense', // Insurance/Payers
}

export interface NormalizedFact {
  standardLabel: string
  originalTag: string
  taxonomy: string
  value: number
  unit: string
  periodType: 'instant' | 'duration'
  periodEnd: Date
  periodStart?: Date
  fiscalYear?: number
  fiscalPeriod?: string
  form?: string
  accessionNumber?: string
  segment?: Record<string, string>
}

export interface FinancialPeriod {
  periodEnd: Date
  periodStart?: Date
  fiscalYear: number
  fiscalPeriod: string
  form: string
  accessionNumber: string
}

export interface FinancialDataset {
  periods: FinancialPeriod[]
  facts: Map<string, Map<string, NormalizedFact>> // standardLabel -> periodKey -> fact
  rawFacts: NormalizedFact[]
}

/**
 * Parse SEC XBRL company facts into normalized facts
 */
export function parseXBRLFacts(companyFacts: SECCompanyFacts): NormalizedFact[] {
  const normalized: NormalizedFact[] = []

  const taxonomies = ['us-gaap', 'dei']

  for (const taxonomy of taxonomies) {
    const taxData = companyFacts.facts[taxonomy]
    if (!taxData) continue

    for (const [tag, data] of Object.entries(taxData)) {
      const standardLabel = TAG_MAPPINGS[tag]
      if (!standardLabel) continue

      // Process each unit type
      for (const [unitType, units] of Object.entries(data.units || {})) {
        for (const fact of units) {
          // Skip if value is null/undefined
          if (fact.val === null || fact.val === undefined) continue

          const normalizedFact: NormalizedFact = {
            standardLabel,
            originalTag: `${taxonomy}:${tag}`,
            taxonomy,
            value: fact.val,
            unit: unitType,
            periodType: fact.start ? 'duration' : 'instant',
            periodEnd: new Date(fact.end),
            periodStart: fact.start ? new Date(fact.start) : undefined,
            fiscalYear: fact.fy,
            fiscalPeriod: fact.fp,
            form: fact.form,
            accessionNumber: fact.accn,
          }

          // Handle segment data if present
          if (fact.segment) {
            normalizedFact.segment = {
              dimension: fact.segment.dimension,
              value: fact.segment.value,
            }
          }

          normalized.push(normalizedFact)
        }
      }
    }
  }

  return normalized
}

/**
 * Organize facts into a structured dataset by period
 */
export function organizeByPeriod(facts: NormalizedFact[]): FinancialDataset {
  const factMap: Map<string, Map<string, NormalizedFact>> = new Map()
  const periodMap: Map<string, FinancialPeriod> = new Map()

  for (const fact of facts) {
    // Skip segment-specific facts for the main dataset
    if (fact.segment) continue

    // Create period key
    const periodKey = `${fact.fiscalYear}-${fact.fiscalPeriod}`

    // Track period info
    if (!periodMap.has(periodKey) && fact.form && fact.accessionNumber) {
      periodMap.set(periodKey, {
        periodEnd: fact.periodEnd,
        periodStart: fact.periodStart,
        fiscalYear: fact.fiscalYear || 0,
        fiscalPeriod: fact.fiscalPeriod || '',
        form: fact.form,
        accessionNumber: fact.accessionNumber,
      })
    }

    // Add fact to map
    if (!factMap.has(fact.standardLabel)) {
      factMap.set(fact.standardLabel, new Map())
    }

    const periodFacts = factMap.get(fact.standardLabel)!

    // For duplicate facts in same period, prefer the one from the annual report
    const existing = periodFacts.get(periodKey)
    if (!existing || (fact.form === '10-K' && existing.form !== '10-K')) {
      periodFacts.set(periodKey, fact)
    }
  }

  // Sort periods by date
  const periods = Array.from(periodMap.values()).sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime())

  return {
    periods,
    facts: factMap,
    rawFacts: facts,
  }
}

/**
 * Get latest value for a metric
 */
export function getLatestValue(dataset: FinancialDataset, metric: string): NormalizedFact | null {
  const metricFacts = dataset.facts.get(metric)
  if (!metricFacts || metricFacts.size === 0) return null

  // Get most recent period
  let latest: NormalizedFact | null = null
  for (const fact of metricFacts.values()) {
    if (!latest || fact.periodEnd > latest.periodEnd) {
      latest = fact
    }
  }

  return latest
}

/**
 * Get annual values for a metric (10-K only)
 */
export function getAnnualValues(dataset: FinancialDataset, metric: string): NormalizedFact[] {
  const metricFacts = dataset.facts.get(metric)
  if (!metricFacts) return []

  return Array.from(metricFacts.values())
    .filter((f) => f.fiscalPeriod === 'FY' || f.form === '10-K')
    .sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime())
}

/**
 * Build a time series for a metric
 */
export function buildTimeSeries(
  dataset: FinancialDataset,
  metric: string,
  periods: number = 5
): {
  period: string
  value: number
  periodEnd: Date
  accessionNumber?: string
}[] {
  const annualValues = getAnnualValues(dataset, metric)

  return annualValues.slice(-periods).map((fact) => ({
    period: `FY${fact.fiscalYear}`,
    value: fact.value,
    periodEnd: fact.periodEnd,
    accessionNumber: fact.accessionNumber,
  }))
}

/**
 * Calculate common financial ratios
 */
export function calculateRatios(dataset: FinancialDataset): Record<string, number | null> {
  const getLatest = (metric: string) => getLatestValue(dataset, metric)?.value

  const revenue = getLatest('revenue')
  const grossProfit = getLatest('gross_profit')
  const operatingIncome = getLatest('operating_income')
  const netIncome = getLatest('net_income')
  const rAndD = getLatest('r_and_d_expense')
  const totalAssets = getLatest('total_assets')
  const totalLiabilities = getLatest('total_liabilities')
  const equity = getLatest('stockholders_equity')
  const currentAssets = getLatest('current_assets')
  const currentLiabilities = getLatest('current_liabilities')
  const cash = getLatest('cash_and_equivalents')
  const longTermDebt = getLatest('long_term_debt')

  return {
    grossMargin: revenue && grossProfit ? grossProfit / revenue : null,
    operatingMargin: revenue && operatingIncome ? operatingIncome / revenue : null,
    netMargin: revenue && netIncome ? netIncome / revenue : null,
    rAndDIntensity: revenue && rAndD ? rAndD / revenue : null,
    returnOnAssets: totalAssets && netIncome ? netIncome / totalAssets : null,
    returnOnEquity: equity && netIncome ? netIncome / equity : null,
    currentRatio: currentLiabilities && currentAssets ? currentAssets / currentLiabilities : null,
    debtToEquity: equity && longTermDebt ? longTermDebt / equity : null,
    debtToAssets: totalAssets && longTermDebt ? longTermDebt / totalAssets : null,
    cashToAssets: totalAssets && cash ? cash / totalAssets : null,
  }
}

/**
 * Generate provenance info for extracted facts
 */
export function generateProvenance(fact: NormalizedFact): {
  accessionNumber: string | undefined
  formType: string | undefined
  xbrlTag: string
  periodEnd: string
  value: number
  unit: string
} {
  return {
    accessionNumber: fact.accessionNumber,
    formType: fact.form,
    xbrlTag: fact.originalTag,
    periodEnd: fact.periodEnd.toISOString().split('T')[0],
    value: fact.value,
    unit: fact.unit,
  }
}
