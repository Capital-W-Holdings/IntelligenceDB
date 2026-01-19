/**
 * Earnings Quality & Manipulation Detection Scores
 *
 * Implements industry-standard financial analysis scores:
 * - Beneish M-Score: Probability of earnings manipulation
 * - Altman Z-Score: Bankruptcy risk assessment
 * - Accruals Quality: Earnings sustainability
 */

export interface FinancialInputs {
  // Current period
  revenue: number
  costOfRevenue: number
  grossProfit: number
  netIncome: number
  operatingIncome: number
  totalAssets: number
  currentAssets: number
  currentLiabilities: number
  totalLiabilities: number
  longTermDebt: number
  shareholdersEquity: number
  cash: number
  receivables: number
  inventory: number
  ppenet: number // Property Plant & Equipment Net
  depreciation: number
  sgaExpense: number
  operatingCashFlow: number
  retainedEarnings: number
  workingCapital: number
  ebit: number // Earnings before interest and taxes
  marketCap?: number // For Z-Score variant

  // Prior period (for comparison ratios)
  priorRevenue?: number
  priorGrossProfit?: number
  priorTotalAssets?: number
  priorReceivables?: number
  priorInventory?: number
  priorCurrentAssets?: number
  priorCurrentLiabilities?: number
  priorPPENet?: number
  priorDepreciation?: number
  priorSGAExpense?: number
  priorLongTermDebt?: number
}

export interface BeneishMScoreResult {
  mScore: number
  probability: number // Probability of manipulation
  interpretation: 'high_risk' | 'moderate_risk' | 'low_risk'
  components: {
    dsri: number  // Days Sales in Receivables Index
    gmi: number   // Gross Margin Index
    aqi: number   // Asset Quality Index
    sgi: number   // Sales Growth Index
    depi: number  // Depreciation Index
    sgai: number  // SG&A Index
    lvgi: number  // Leverage Index
    tata: number  // Total Accruals to Total Assets
  }
  flags: string[]
}

export interface AltmanZScoreResult {
  zScore: number
  interpretation: 'safe' | 'gray_zone' | 'distress'
  probability: number // Probability of bankruptcy
  components: {
    x1: number // Working Capital / Total Assets
    x2: number // Retained Earnings / Total Assets
    x3: number // EBIT / Total Assets
    x4: number // Market Value of Equity / Total Liabilities (or Book Value)
    x5: number // Sales / Total Assets
  }
  flags: string[]
}

export interface AccrualsQualityResult {
  totalAccruals: number
  accrualsRatio: number // Accruals / Average Total Assets
  interpretation: 'high_quality' | 'moderate_quality' | 'low_quality'
  cashConversion: number // Operating Cash Flow / Net Income
  flags: string[]
}

/**
 * Calculate Beneish M-Score
 *
 * M-Score > -1.78 indicates high probability of manipulation
 * M-Score < -2.22 indicates low probability
 *
 * Formula: M = -4.84 + 0.92*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI +
 *          0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI
 */
export function calculateBeneishMScore(inputs: FinancialInputs): BeneishMScoreResult | null {
  const flags: string[] = []

  // Need prior period data for most calculations
  if (!inputs.priorRevenue || !inputs.priorTotalAssets) {
    return null
  }

  // Guard against division by zero
  const safeDiv = (num: number, den: number) => den !== 0 ? num / den : 0

  // 1. DSRI - Days Sales in Receivables Index
  // (Receivables/Sales)_t / (Receivables/Sales)_t-1
  const receivablesSalesT = safeDiv(inputs.receivables, inputs.revenue)
  const receivablesSalesT1 = safeDiv(inputs.priorReceivables || 0, inputs.priorRevenue)
  const dsri = safeDiv(receivablesSalesT, receivablesSalesT1) || 1
  if (dsri > 1.5) flags.push('High DSRI: Receivables growing faster than sales')

  // 2. GMI - Gross Margin Index
  // Gross Margin_t-1 / Gross Margin_t
  const gmT = safeDiv(inputs.grossProfit, inputs.revenue)
  const gmT1 = safeDiv(inputs.priorGrossProfit || 0, inputs.priorRevenue)
  const gmi = safeDiv(gmT1, gmT) || 1
  if (gmi > 1.2) flags.push('High GMI: Deteriorating gross margins')

  // 3. AQI - Asset Quality Index
  // [1 - (Current Assets + PP&E) / Total Assets]_t / [same]_t-1
  const hardAssetsT = inputs.currentAssets + inputs.ppenet
  const hardAssetsT1 = (inputs.priorCurrentAssets || 0) + (inputs.priorPPENet || 0)
  const aqiT = 1 - safeDiv(hardAssetsT, inputs.totalAssets)
  const aqiT1 = 1 - safeDiv(hardAssetsT1, inputs.priorTotalAssets)
  const aqi = safeDiv(aqiT, aqiT1) || 1
  if (aqi > 1.3) flags.push('High AQI: Increasing asset capitalization')

  // 4. SGI - Sales Growth Index
  const sgi = safeDiv(inputs.revenue, inputs.priorRevenue) || 1
  if (sgi > 1.5) flags.push('High SGI: Very rapid sales growth')

  // 5. DEPI - Depreciation Index
  // [Depreciation / (Depreciation + PP&E)]_t-1 / [same]_t
  const depRateT = safeDiv(inputs.depreciation, inputs.depreciation + inputs.ppenet)
  const depRateT1 = safeDiv(inputs.priorDepreciation || 0, (inputs.priorDepreciation || 0) + (inputs.priorPPENet || 0))
  const depi = safeDiv(depRateT1, depRateT) || 1
  if (depi > 1.2) flags.push('High DEPI: Slowing depreciation')

  // 6. SGAI - SG&A Index
  // (SG&A/Sales)_t / (SG&A/Sales)_t-1
  const sgaRatioT = safeDiv(inputs.sgaExpense, inputs.revenue)
  const sgaRatioT1 = safeDiv(inputs.priorSGAExpense || 0, inputs.priorRevenue)
  const sgai = safeDiv(sgaRatioT, sgaRatioT1) || 1

  // 7. LVGI - Leverage Index
  // [(Long-term Debt + Current Liabilities) / Total Assets]_t / [same]_t-1
  const leverageT = safeDiv(inputs.longTermDebt + inputs.currentLiabilities, inputs.totalAssets)
  const leverageT1 = safeDiv((inputs.priorLongTermDebt || 0) + (inputs.priorCurrentLiabilities || 0), inputs.priorTotalAssets)
  const lvgi = safeDiv(leverageT, leverageT1) || 1
  if (lvgi > 1.3) flags.push('High LVGI: Rapidly increasing leverage')

  // 8. TATA - Total Accruals to Total Assets
  // (Net Income - Operating Cash Flow) / Total Assets
  const totalAccruals = inputs.netIncome - inputs.operatingCashFlow
  const tata = safeDiv(totalAccruals, inputs.totalAssets)
  if (tata > 0.05) flags.push('High TATA: Large accruals relative to assets')

  // Calculate M-Score
  const mScore = -4.84 +
    0.92 * dsri +
    0.528 * gmi +
    0.404 * aqi +
    0.892 * sgi +
    0.115 * depi -
    0.172 * sgai +
    4.679 * tata -
    0.327 * lvgi

  // Determine interpretation
  let interpretation: 'high_risk' | 'moderate_risk' | 'low_risk'
  let probability: number

  if (mScore > -1.78) {
    interpretation = 'high_risk'
    probability = 0.76 // ~76% of manipulators have M > -1.78
  } else if (mScore > -2.22) {
    interpretation = 'moderate_risk'
    probability = 0.35
  } else {
    interpretation = 'low_risk'
    probability = 0.12
  }

  return {
    mScore: Math.round(mScore * 100) / 100,
    probability,
    interpretation,
    components: {
      dsri: Math.round(dsri * 100) / 100,
      gmi: Math.round(gmi * 100) / 100,
      aqi: Math.round(aqi * 100) / 100,
      sgi: Math.round(sgi * 100) / 100,
      depi: Math.round(depi * 100) / 100,
      sgai: Math.round(sgai * 100) / 100,
      lvgi: Math.round(lvgi * 100) / 100,
      tata: Math.round(tata * 1000) / 1000,
    },
    flags,
  }
}

/**
 * Calculate Altman Z-Score
 *
 * Original formula for public manufacturing companies:
 * Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
 *
 * Z > 2.99: Safe zone
 * 1.81 < Z < 2.99: Gray zone
 * Z < 1.81: Distress zone
 *
 * For non-manufacturing, use Z'' score (excludes X5)
 */
export function calculateAltmanZScore(
  inputs: FinancialInputs,
  useMarketCap: boolean = true
): AltmanZScoreResult {
  const flags: string[] = []
  const safeDiv = (num: number, den: number) => den !== 0 ? num / den : 0

  // X1: Working Capital / Total Assets
  const x1 = safeDiv(inputs.workingCapital, inputs.totalAssets)
  if (x1 < 0) flags.push('Negative working capital')

  // X2: Retained Earnings / Total Assets
  const x2 = safeDiv(inputs.retainedEarnings, inputs.totalAssets)
  if (x2 < 0) flags.push('Negative retained earnings')

  // X3: EBIT / Total Assets
  const x3 = safeDiv(inputs.ebit, inputs.totalAssets)
  if (x3 < 0) flags.push('Negative EBIT')

  // X4: Market Value of Equity / Total Liabilities
  // Use market cap if available, otherwise book value
  const equityValue = useMarketCap && inputs.marketCap ? inputs.marketCap : inputs.shareholdersEquity
  const x4 = safeDiv(equityValue, inputs.totalLiabilities)
  if (x4 < 0.5) flags.push('Low equity to debt coverage')

  // X5: Sales / Total Assets
  const x5 = safeDiv(inputs.revenue, inputs.totalAssets)

  // Calculate Z-Score
  const zScore = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5

  // Determine interpretation
  let interpretation: 'safe' | 'gray_zone' | 'distress'
  let probability: number

  if (zScore > 2.99) {
    interpretation = 'safe'
    probability = 0.05 // ~5% chance of bankruptcy
  } else if (zScore > 1.81) {
    interpretation = 'gray_zone'
    probability = 0.35
  } else {
    interpretation = 'distress'
    probability = 0.80 // ~80% of companies in this zone face bankruptcy
    flags.push('Company is in financial distress zone')
  }

  return {
    zScore: Math.round(zScore * 100) / 100,
    interpretation,
    probability,
    components: {
      x1: Math.round(x1 * 1000) / 1000,
      x2: Math.round(x2 * 1000) / 1000,
      x3: Math.round(x3 * 1000) / 1000,
      x4: Math.round(x4 * 1000) / 1000,
      x5: Math.round(x5 * 1000) / 1000,
    },
    flags,
  }
}

/**
 * Calculate Accruals Quality
 *
 * High-quality earnings are backed by cash flow.
 * Companies with large accruals relative to cash flow may have less sustainable earnings.
 */
export function calculateAccrualsQuality(inputs: FinancialInputs): AccrualsQualityResult {
  const flags: string[] = []

  // Total Accruals = Net Income - Operating Cash Flow
  const totalAccruals = inputs.netIncome - inputs.operatingCashFlow

  // Accruals Ratio = Total Accruals / Average Total Assets
  // Using current total assets as proxy if prior not available
  const avgAssets = inputs.priorTotalAssets
    ? (inputs.totalAssets + inputs.priorTotalAssets) / 2
    : inputs.totalAssets
  const accrualsRatio = avgAssets !== 0 ? totalAccruals / avgAssets : 0

  // Cash Conversion = Operating Cash Flow / Net Income
  // > 1 means cash flow exceeds reported earnings (good)
  // < 1 means earnings exceed cash flow (potentially concerning)
  const cashConversion = inputs.netIncome !== 0
    ? inputs.operatingCashFlow / inputs.netIncome
    : 0

  // Interpretation
  let interpretation: 'high_quality' | 'moderate_quality' | 'low_quality'

  if (cashConversion >= 1 && accrualsRatio < 0.05) {
    interpretation = 'high_quality'
  } else if (cashConversion >= 0.7 && accrualsRatio < 0.10) {
    interpretation = 'moderate_quality'
  } else {
    interpretation = 'low_quality'
    flags.push('Low cash conversion of earnings')
  }

  // Additional flags
  if (accrualsRatio > 0.10) {
    flags.push('High accruals ratio indicates potential earnings management')
  }
  if (cashConversion < 0) {
    flags.push('Operating cash flow is negative while net income is positive')
  }
  if (totalAccruals > 0 && totalAccruals > inputs.netIncome * 0.5) {
    flags.push('More than 50% of earnings are non-cash accruals')
  }

  return {
    totalAccruals,
    accrualsRatio: Math.round(accrualsRatio * 1000) / 1000,
    interpretation,
    cashConversion: Math.round(cashConversion * 100) / 100,
    flags,
  }
}

/**
 * Calculate Cash Runway for Biotech/Pre-revenue Companies
 */
export interface CashRunwayResult {
  runwayMonths: number
  interpretation: 'critical' | 'concerning' | 'adequate' | 'strong'
  quarterlyBurnRate: number
  cashPosition: number
  dilutionRisk: 'high' | 'medium' | 'low'
  flags: string[]
}

export function calculateCashRunway(
  cash: number,
  operatingCashFlow: number, // Should be negative for burning companies
  quarterlyGrowthRate?: number // Optional: how fast is burn accelerating?
): CashRunwayResult {
  const flags: string[] = []

  // Quarterly burn rate (convert annual OCF to quarterly)
  // If OCF is positive, company is not burning cash
  const quarterlyBurnRate = operatingCashFlow < 0
    ? Math.abs(operatingCashFlow) / 4
    : 0

  // Calculate runway
  let runwayMonths: number
  if (quarterlyBurnRate === 0) {
    runwayMonths = 999 // Cash flow positive
  } else {
    // Basic runway
    runwayMonths = (cash / quarterlyBurnRate) * 3 // Convert quarters to months

    // Adjust for burn rate growth if provided
    if (quarterlyGrowthRate && quarterlyGrowthRate > 0) {
      // If burn is accelerating, reduce runway estimate
      runwayMonths = runwayMonths * (1 - quarterlyGrowthRate * 0.5)
      flags.push(`Burn rate accelerating ${(quarterlyGrowthRate * 100).toFixed(0)}% YoY`)
    }
  }

  // Interpretation
  let interpretation: 'critical' | 'concerning' | 'adequate' | 'strong'
  let dilutionRisk: 'high' | 'medium' | 'low'

  if (runwayMonths < 6) {
    interpretation = 'critical'
    dilutionRisk = 'high'
    flags.push('Immediate financing needed - expect equity raise or strategic transaction')
  } else if (runwayMonths < 12) {
    interpretation = 'concerning'
    dilutionRisk = 'high'
    flags.push('Financing likely within next 12 months')
  } else if (runwayMonths < 24) {
    interpretation = 'adequate'
    dilutionRisk = 'medium'
    flags.push('Sufficient runway but monitor cash burn')
  } else {
    interpretation = 'strong'
    dilutionRisk = 'low'
  }

  return {
    runwayMonths: Math.round(runwayMonths),
    interpretation,
    quarterlyBurnRate: Math.round(quarterlyBurnRate),
    cashPosition: cash,
    dilutionRisk,
    flags,
  }
}

/**
 * Piotroski F-Score
 * Measures financial strength (0-9, higher is better)
 */
export interface PiotroskiFScoreResult {
  score: number
  interpretation: 'strong' | 'moderate' | 'weak'
  components: {
    profitability: number // 0-4
    leverage: number // 0-3
    efficiency: number // 0-2
  }
  details: {
    positiveNetIncome: boolean
    positiveROA: boolean
    positiveCashFlow: boolean
    cashFlowExceedsIncome: boolean
    lowerLeverage: boolean
    higherCurrentRatio: boolean
    noNewShares: boolean
    higherGrossMargin: boolean
    higherAssetTurnover: boolean
  }
}

export function calculatePiotroskiFScore(
  inputs: FinancialInputs
): PiotroskiFScoreResult | null {
  if (!inputs.priorTotalAssets || !inputs.priorCurrentLiabilities) {
    return null
  }

  // Profitability signals (4 points)
  const positiveNetIncome = inputs.netIncome > 0
  const roa = inputs.netIncome / inputs.totalAssets
  const positiveROA = roa > 0
  const positiveCashFlow = inputs.operatingCashFlow > 0
  const cashFlowExceedsIncome = inputs.operatingCashFlow > inputs.netIncome

  // Leverage signals (3 points)
  const currentLeverage = inputs.longTermDebt / inputs.totalAssets
  const priorLeverage = (inputs.priorLongTermDebt || 0) / inputs.priorTotalAssets
  const lowerLeverage = currentLeverage < priorLeverage

  const currentRatio = inputs.currentAssets / inputs.currentLiabilities
  const priorCurrentRatio = (inputs.priorCurrentAssets || 0) / inputs.priorCurrentLiabilities
  const higherCurrentRatio = currentRatio > priorCurrentRatio

  // Assume no new shares issued (would need share count data to verify)
  const noNewShares = true

  // Efficiency signals (2 points)
  const currentGM = inputs.grossProfit / inputs.revenue
  const priorGM = (inputs.priorGrossProfit || 0) / (inputs.priorRevenue || 1)
  const higherGrossMargin = currentGM > priorGM

  const currentTurnover = inputs.revenue / inputs.totalAssets
  const priorTurnover = (inputs.priorRevenue || 0) / inputs.priorTotalAssets
  const higherAssetTurnover = currentTurnover > priorTurnover

  // Calculate scores
  const profitability =
    (positiveNetIncome ? 1 : 0) +
    (positiveROA ? 1 : 0) +
    (positiveCashFlow ? 1 : 0) +
    (cashFlowExceedsIncome ? 1 : 0)

  const leverage =
    (lowerLeverage ? 1 : 0) +
    (higherCurrentRatio ? 1 : 0) +
    (noNewShares ? 1 : 0)

  const efficiency =
    (higherGrossMargin ? 1 : 0) +
    (higherAssetTurnover ? 1 : 0)

  const score = profitability + leverage + efficiency

  let interpretation: 'strong' | 'moderate' | 'weak'
  if (score >= 7) {
    interpretation = 'strong'
  } else if (score >= 4) {
    interpretation = 'moderate'
  } else {
    interpretation = 'weak'
  }

  return {
    score,
    interpretation,
    components: {
      profitability,
      leverage,
      efficiency,
    },
    details: {
      positiveNetIncome,
      positiveROA,
      positiveCashFlow,
      cashFlowExceedsIncome,
      lowerLeverage,
      higherCurrentRatio,
      noNewShares,
      higherGrossMargin,
      higherAssetTurnover,
    },
  }
}
