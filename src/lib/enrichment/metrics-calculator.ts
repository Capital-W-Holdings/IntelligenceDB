import { FinancialDataset, getLatestValue, getAnnualValues } from '../parser/xbrl-parser'

export interface HealthcareKPIs {
  // Biotech/Pharma
  cashRunwayMonths?: number
  cashBurnRateQuarterly?: number
  rAndDIntensity?: number
  rAndDGrowthRate?: number

  // Pharma/Commercial
  grossMargin?: number
  revenueGrowthRate?: number
  operatingMargin?: number

  // Payers
  medicalLossRatio?: number
  administrativeExpenseRatio?: number
  combinedRatio?: number

  // Providers
  revenuePerEmployee?: number

  // MedDevice
  bookToBill?: number

  // Common
  debtToEquity?: number
  currentRatio?: number
  cashToDebt?: number
  interestCoverage?: number

  // Valuation-related (if market data available)
  priceToSales?: number
  priceToEarnings?: number
  enterpriseValueToRevenue?: number
}

export interface KPIResult {
  metric: string
  value: number
  unit: string
  period: string
  category: string
  description: string
  sourceAccession?: string
  calculationMethod: string
}

/**
 * Calculate healthcare-specific KPIs based on company sector
 */
export function calculateHealthcareKPIs(
  dataset: FinancialDataset,
  sector: string
): KPIResult[] {
  const results: KPIResult[] = []

  const getLatest = (metric: string) => getLatestValue(dataset, metric)

  // Get key financials
  const revenue = getLatest('revenue')
  const grossProfit = getLatest('gross_profit')
  const operatingIncome = getLatest('operating_income')
  const netIncome = getLatest('net_income')
  const rAndD = getLatest('r_and_d_expense')
  const sgAndA = getLatest('sg_and_a_expense')
  const totalAssets = getLatest('total_assets')
  const totalLiabilities = getLatest('total_liabilities')
  const equity = getLatest('stockholders_equity')
  const currentAssets = getLatest('current_assets')
  const currentLiabilities = getLatest('current_liabilities')
  const cash = getLatest('cash_and_equivalents')
  const longTermDebt = getLatest('long_term_debt')
  const operatingCashFlow = getLatest('operating_cash_flow')

  // Determine fiscal period
  const period = revenue?.fiscalYear ? `FY${revenue.fiscalYear}` : 'Latest'

  // === Common Metrics ===

  // Revenue Growth
  const revenueHistory = getAnnualValues(dataset, 'revenue')
  if (revenueHistory.length >= 2) {
    const current = revenueHistory[revenueHistory.length - 1]
    const prior = revenueHistory[revenueHistory.length - 2]
    if (prior.value > 0) {
      const growthRate = (current.value - prior.value) / prior.value
      results.push({
        metric: 'revenue_growth_yoy',
        value: growthRate * 100,
        unit: 'percent',
        period,
        category: 'growth',
        description: 'Year-over-year revenue growth rate',
        sourceAccession: current.accessionNumber,
        calculationMethod: '(Current Revenue - Prior Revenue) / Prior Revenue',
      })
    }
  }

  // Gross Margin
  if (revenue && grossProfit && revenue.value > 0) {
    results.push({
      metric: 'gross_margin',
      value: (grossProfit.value / revenue.value) * 100,
      unit: 'percent',
      period,
      category: 'profitability',
      description: 'Gross profit as percentage of revenue',
      sourceAccession: revenue.accessionNumber,
      calculationMethod: 'Gross Profit / Revenue',
    })
  }

  // Operating Margin
  if (revenue && operatingIncome && revenue.value > 0) {
    results.push({
      metric: 'operating_margin',
      value: (operatingIncome.value / revenue.value) * 100,
      unit: 'percent',
      period,
      category: 'profitability',
      description: 'Operating income as percentage of revenue',
      sourceAccession: revenue.accessionNumber,
      calculationMethod: 'Operating Income / Revenue',
    })
  }

  // Net Margin
  if (revenue && netIncome && revenue.value > 0) {
    results.push({
      metric: 'net_margin',
      value: (netIncome.value / revenue.value) * 100,
      unit: 'percent',
      period,
      category: 'profitability',
      description: 'Net income as percentage of revenue',
      sourceAccession: revenue.accessionNumber,
      calculationMethod: 'Net Income / Revenue',
    })
  }

  // Current Ratio
  if (currentAssets && currentLiabilities && currentLiabilities.value > 0) {
    results.push({
      metric: 'current_ratio',
      value: currentAssets.value / currentLiabilities.value,
      unit: 'ratio',
      period,
      category: 'liquidity',
      description: 'Current assets divided by current liabilities',
      sourceAccession: currentAssets.accessionNumber,
      calculationMethod: 'Current Assets / Current Liabilities',
    })
  }

  // Debt to Equity
  if (longTermDebt && equity && equity.value > 0) {
    results.push({
      metric: 'debt_to_equity',
      value: longTermDebt.value / equity.value,
      unit: 'ratio',
      period,
      category: 'leverage',
      description: 'Long-term debt divided by stockholders equity',
      sourceAccession: equity.accessionNumber,
      calculationMethod: 'Long-term Debt / Stockholders Equity',
    })
  }

  // === Biotech/Pharma Specific ===
  if (sector === 'Biotech/Pharma' || sector === 'Biotech' || sector === 'Pharma') {
    // R&D Intensity
    if (revenue && rAndD) {
      if (revenue.value > 0) {
        results.push({
          metric: 'r_and_d_intensity',
          value: (rAndD.value / revenue.value) * 100,
          unit: 'percent',
          period,
          category: 'biotech',
          description: 'R&D expense as percentage of revenue',
          sourceAccession: rAndD.accessionNumber,
          calculationMethod: 'R&D Expense / Revenue',
        })
      }
    }

    // Cash Runway (for pre-revenue or cash-burning biotechs)
    if (cash && operatingCashFlow && operatingCashFlow.value < 0) {
      // Quarterly burn rate (assuming annual cash flow)
      const quarterlyBurn = Math.abs(operatingCashFlow.value) / 4
      const runwayMonths = (cash.value / quarterlyBurn) * 3

      results.push({
        metric: 'cash_runway_months',
        value: runwayMonths,
        unit: 'months',
        period,
        category: 'biotech',
        description: 'Estimated months of cash runway at current burn rate',
        sourceAccession: cash.accessionNumber,
        calculationMethod: 'Cash / (Quarterly Operating Cash Burn)',
      })

      results.push({
        metric: 'quarterly_cash_burn',
        value: quarterlyBurn / 1_000_000, // Convert to millions
        unit: 'USD_millions',
        period,
        category: 'biotech',
        description: 'Estimated quarterly cash burn rate',
        sourceAccession: operatingCashFlow.accessionNumber,
        calculationMethod: 'Annual Operating Cash Outflow / 4',
      })
    }

    // R&D Growth Rate
    const rAndDHistory = getAnnualValues(dataset, 'r_and_d_expense')
    if (rAndDHistory.length >= 2) {
      const current = rAndDHistory[rAndDHistory.length - 1]
      const prior = rAndDHistory[rAndDHistory.length - 2]
      if (prior.value > 0) {
        const growthRate = (current.value - prior.value) / prior.value
        results.push({
          metric: 'r_and_d_growth_yoy',
          value: growthRate * 100,
          unit: 'percent',
          period,
          category: 'biotech',
          description: 'Year-over-year R&D expense growth',
          sourceAccession: current.accessionNumber,
          calculationMethod: '(Current R&D - Prior R&D) / Prior R&D',
        })
      }
    }
  }

  // === Payer Specific ===
  if (sector === 'Payer') {
    const premiums = getLatest('premiums_earned')
    const benefitsExpense = getLatest('benefits_expense')

    if (premiums && benefitsExpense && premiums.value > 0) {
      // Medical Loss Ratio
      results.push({
        metric: 'medical_loss_ratio',
        value: (benefitsExpense.value / premiums.value) * 100,
        unit: 'percent',
        period,
        category: 'payer',
        description: 'Medical costs as percentage of premiums (MLR)',
        sourceAccession: premiums.accessionNumber,
        calculationMethod: 'Benefits Expense / Premiums Earned',
      })

      // Admin Expense Ratio (if SG&A available)
      if (sgAndA) {
        results.push({
          metric: 'admin_expense_ratio',
          value: (sgAndA.value / premiums.value) * 100,
          unit: 'percent',
          period,
          category: 'payer',
          description: 'Administrative expenses as percentage of premiums',
          sourceAccession: sgAndA.accessionNumber,
          calculationMethod: 'SG&A / Premiums Earned',
        })

        // Combined Ratio
        results.push({
          metric: 'combined_ratio',
          value: ((benefitsExpense.value + sgAndA.value) / premiums.value) * 100,
          unit: 'percent',
          period,
          category: 'payer',
          description: 'Total of MLR and admin expense ratio',
          sourceAccession: premiums.accessionNumber,
          calculationMethod: '(Benefits + SG&A) / Premiums',
        })
      }
    }
  }

  // === Provider Specific ===
  if (sector === 'Provider') {
    // Revenue per bed / Revenue growth are common metrics
    // These often require supplemental disclosures not in standard XBRL
  }

  // === MedDevice Specific ===
  if (sector === 'MedDevice') {
    // Similar to pharma metrics
    // R&D Intensity
    if (revenue && rAndD && revenue.value > 0) {
      results.push({
        metric: 'r_and_d_intensity',
        value: (rAndD.value / revenue.value) * 100,
        unit: 'percent',
        period,
        category: 'meddevice',
        description: 'R&D expense as percentage of revenue',
        sourceAccession: rAndD.accessionNumber,
        calculationMethod: 'R&D Expense / Revenue',
      })
    }
  }

  return results
}

/**
 * Summarize KPIs into categories
 */
export function summarizeKPIs(kpis: KPIResult[]): Record<string, KPIResult[]> {
  const grouped: Record<string, KPIResult[]> = {}

  for (const kpi of kpis) {
    if (!grouped[kpi.category]) {
      grouped[kpi.category] = []
    }
    grouped[kpi.category].push(kpi)
  }

  return grouped
}

/**
 * Format KPI value for display
 */
export function formatKPIValue(kpi: KPIResult): string {
  const value = kpi.value

  switch (kpi.unit) {
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'ratio':
      return value.toFixed(2)
    case 'months':
      return `${value.toFixed(1)} months`
    case 'USD_millions':
      return `$${value.toFixed(1)}M`
    case 'USD_billions':
      return `$${value.toFixed(2)}B`
    default:
      return value.toLocaleString()
  }
}
