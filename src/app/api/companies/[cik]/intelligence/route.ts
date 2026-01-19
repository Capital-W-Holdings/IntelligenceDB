import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import {
  calculateBeneishMScore,
  calculateAltmanZScore,
  calculateAccrualsQuality,
  calculateCashRunway,
  calculatePiotroskiFScore,
  FinancialInputs,
} from '@/lib/intelligence/earnings-quality'

interface XBRLFactData {
  tag: string
  value: string
  periodEnd: Date | null
  periodType: string
}

// Map XBRL facts to financial inputs
function mapXBRLToFinancials(
  facts: XBRLFactData[],
  fiscalYear: number
): Partial<FinancialInputs> & { priorYear?: Partial<FinancialInputs> } {
  const result: Partial<FinancialInputs> = {}
  const priorYear: Partial<FinancialInputs> = {}

  // Helper to find fact by tag and year
  const findFact = (tags: string[], year: number): number | undefined => {
    for (const tag of tags) {
      const fact = facts.find(f => {
        const tagLower = f.tag.toLowerCase()
        const matchesTag = tagLower === tag.toLowerCase() || tagLower.includes(tag.toLowerCase())
        const factYear = f.periodEnd?.getFullYear()
        return matchesTag && factYear === year
      })
      if (fact) {
        const value = parseFloat(fact.value)
        if (!isNaN(value)) return value
      }
    }
    return undefined
  }

  // Current year mappings
  result.revenue = findFact(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], fiscalYear)
  result.costOfRevenue = findFact(['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'], fiscalYear)
  result.grossProfit = findFact(['GrossProfit'], fiscalYear)
  result.netIncome = findFact(['NetIncomeLoss', 'ProfitLoss'], fiscalYear)
  result.operatingIncome = findFact(['OperatingIncomeLoss'], fiscalYear)
  result.totalAssets = findFact(['Assets'], fiscalYear)
  result.currentAssets = findFact(['AssetsCurrent'], fiscalYear)
  result.currentLiabilities = findFact(['LiabilitiesCurrent'], fiscalYear)
  result.totalLiabilities = findFact(['Liabilities'], fiscalYear)
  result.longTermDebt = findFact(['LongTermDebt', 'LongTermDebtNoncurrent'], fiscalYear)
  result.shareholdersEquity = findFact(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], fiscalYear)
  result.cash = findFact(['CashAndCashEquivalentsAtCarryingValue', 'Cash'], fiscalYear)
  result.receivables = findFact(['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'], fiscalYear)
  result.inventory = findFact(['InventoryNet'], fiscalYear)
  result.ppenet = findFact(['PropertyPlantAndEquipmentNet'], fiscalYear)
  result.depreciation = findFact(['DepreciationDepletionAndAmortization', 'Depreciation'], fiscalYear)
  result.sgaExpense = findFact(['SellingGeneralAndAdministrativeExpense', 'GeneralAndAdministrativeExpense'], fiscalYear)
  result.operatingCashFlow = findFact(['NetCashProvidedByUsedInOperatingActivities'], fiscalYear)
  result.retainedEarnings = findFact(['RetainedEarningsAccumulatedDeficit'], fiscalYear)

  // Calculate derived fields
  if (result.currentAssets !== undefined && result.currentLiabilities !== undefined) {
    result.workingCapital = result.currentAssets - result.currentLiabilities
  }
  if (result.operatingIncome !== undefined) {
    result.ebit = result.operatingIncome // Approximation
  }
  if (result.revenue !== undefined && result.costOfRevenue !== undefined && result.grossProfit === undefined) {
    result.grossProfit = result.revenue - result.costOfRevenue
  }

  // Prior year mappings
  const priorFiscalYear = fiscalYear - 1
  priorYear.revenue = findFact(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], priorFiscalYear)
  priorYear.grossProfit = findFact(['GrossProfit'], priorFiscalYear)
  priorYear.totalAssets = findFact(['Assets'], priorFiscalYear)
  priorYear.receivables = findFact(['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'], priorFiscalYear)
  priorYear.inventory = findFact(['InventoryNet'], priorFiscalYear)
  priorYear.currentAssets = findFact(['AssetsCurrent'], priorFiscalYear)
  priorYear.currentLiabilities = findFact(['LiabilitiesCurrent'], priorFiscalYear)
  priorYear.ppenet = findFact(['PropertyPlantAndEquipmentNet'], priorFiscalYear)
  priorYear.depreciation = findFact(['DepreciationDepletionAndAmortization', 'Depreciation'], priorFiscalYear)
  priorYear.sgaExpense = findFact(['SellingGeneralAndAdministrativeExpense'], priorFiscalYear)
  priorYear.longTermDebt = findFact(['LongTermDebt', 'LongTermDebtNoncurrent'], priorFiscalYear)

  return {
    ...result,
    priorRevenue: priorYear.revenue,
    priorGrossProfit: priorYear.grossProfit,
    priorTotalAssets: priorYear.totalAssets,
    priorReceivables: priorYear.receivables,
    priorInventory: priorYear.inventory,
    priorCurrentAssets: priorYear.currentAssets,
    priorCurrentLiabilities: priorYear.currentLiabilities,
    priorPPENet: priorYear.ppenet,
    priorDepreciation: priorYear.depreciation,
    priorSGAExpense: priorYear.sgaExpense,
    priorLongTermDebt: priorYear.longTermDebt,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params

    // Get company
    const company = await prisma.company.findUnique({
      where: { cik },
      select: {
        id: true,
        cik: true,
        name: true,
        ticker: true,
        sector: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Try to get XBRL facts from SEC API
    const secClient = new SECClient()
    const companyFacts = await secClient.getCompanyFacts(cik)

    if (!companyFacts) {
      return NextResponse.json({
        company,
        error: 'No XBRL data available for this company',
        scores: null,
      })
    }

    // Extract facts from SEC data
    const facts: XBRLFactData[] = []
    const currentYear = new Date().getFullYear()

    // Process us-gaap facts
    if (companyFacts.facts?.['us-gaap']) {
      for (const [tag, data] of Object.entries(companyFacts.facts['us-gaap'])) {
        const tagData = data as { units?: Record<string, Array<{ val: number; end?: string; form?: string }>> }
        if (tagData.units) {
          for (const [, values] of Object.entries(tagData.units)) {
            for (const v of values) {
              if (v.end && (v.form === '10-K' || v.form === '10-K/A')) {
                facts.push({
                  tag,
                  value: String(v.val),
                  periodEnd: new Date(v.end),
                  periodType: 'duration',
                })
              }
            }
          }
        }
      }
    }

    // Get latest fiscal year
    const latestFiscalYear = Math.max(
      ...facts
        .filter(f => f.periodEnd)
        .map(f => f.periodEnd!.getFullYear())
        .filter(y => y <= currentYear)
    )

    // Map to financial inputs
    const financials = mapXBRLToFinancials(facts, latestFiscalYear)

    // Calculate scores
    const scores: Record<string, unknown> = {
      fiscalYear: latestFiscalYear,
      dataQuality: {
        hasCurrentYearData: !!financials.totalAssets,
        hasPriorYearData: !!financials.priorTotalAssets,
        availableMetrics: Object.keys(financials).filter(k => financials[k as keyof typeof financials] !== undefined).length,
      },
    }

    // Build complete financial inputs with defaults
    const completeInputs: FinancialInputs = {
      revenue: financials.revenue || 0,
      costOfRevenue: financials.costOfRevenue || 0,
      grossProfit: financials.grossProfit || 0,
      netIncome: financials.netIncome || 0,
      operatingIncome: financials.operatingIncome || 0,
      totalAssets: financials.totalAssets || 0,
      currentAssets: financials.currentAssets || 0,
      currentLiabilities: financials.currentLiabilities || 0,
      totalLiabilities: financials.totalLiabilities || 0,
      longTermDebt: financials.longTermDebt || 0,
      shareholdersEquity: financials.shareholdersEquity || 0,
      cash: financials.cash || 0,
      receivables: financials.receivables || 0,
      inventory: financials.inventory || 0,
      ppenet: financials.ppenet || 0,
      depreciation: financials.depreciation || 0,
      sgaExpense: financials.sgaExpense || 0,
      operatingCashFlow: financials.operatingCashFlow || 0,
      retainedEarnings: financials.retainedEarnings || 0,
      workingCapital: financials.workingCapital || 0,
      ebit: financials.ebit || 0,
      priorRevenue: financials.priorRevenue,
      priorGrossProfit: financials.priorGrossProfit,
      priorTotalAssets: financials.priorTotalAssets,
      priorReceivables: financials.priorReceivables,
      priorInventory: financials.priorInventory,
      priorCurrentAssets: financials.priorCurrentAssets,
      priorCurrentLiabilities: financials.priorCurrentLiabilities,
      priorPPENet: financials.priorPPENet,
      priorDepreciation: financials.priorDepreciation,
      priorSGAExpense: financials.priorSGAExpense,
      priorLongTermDebt: financials.priorLongTermDebt,
    }

    // Beneish M-Score
    if (completeInputs.totalAssets > 0 && completeInputs.priorTotalAssets) {
      const beneish = calculateBeneishMScore(completeInputs)
      if (beneish) {
        scores.beneishMScore = beneish
      }
    }

    // Altman Z-Score
    if (completeInputs.totalAssets > 0) {
      scores.altmanZScore = calculateAltmanZScore(completeInputs, false)
    }

    // Accruals Quality
    if (completeInputs.netIncome !== 0 || completeInputs.operatingCashFlow !== 0) {
      scores.accrualsQuality = calculateAccrualsQuality(completeInputs)
    }

    // Cash Runway (for cash-burning companies)
    if (completeInputs.cash > 0 && completeInputs.operatingCashFlow < 0) {
      scores.cashRunway = calculateCashRunway(
        completeInputs.cash,
        completeInputs.operatingCashFlow
      )
    }

    // Piotroski F-Score
    if (completeInputs.totalAssets > 0 && completeInputs.priorTotalAssets) {
      const piotroski = calculatePiotroskiFScore(completeInputs)
      if (piotroski) {
        scores.piotroskiFScore = piotroski
      }
    }

    // Calculate overall earnings quality rating
    let overallRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'fair'
    const redFlags: string[] = []

    // Aggregate flags
    if (scores.beneishMScore && (scores.beneishMScore as { interpretation: string }).interpretation === 'high_risk') {
      redFlags.push('High manipulation risk (Beneish M-Score)')
      overallRating = 'poor'
    }
    if (scores.altmanZScore && (scores.altmanZScore as { interpretation: string }).interpretation === 'distress') {
      redFlags.push('Financial distress risk (Altman Z-Score)')
      overallRating = 'critical'
    }
    if (scores.accrualsQuality && (scores.accrualsQuality as { interpretation: string }).interpretation === 'low_quality') {
      redFlags.push('Low earnings quality (high accruals)')
    }
    if (scores.cashRunway && (scores.cashRunway as { interpretation: string }).interpretation === 'critical') {
      redFlags.push('Critical cash runway - immediate financing needed')
      overallRating = 'critical'
    }

    // Positive signals
    const greenFlags: string[] = []
    if (scores.piotroskiFScore && (scores.piotroskiFScore as { score: number }).score >= 7) {
      greenFlags.push('Strong financial health (Piotroski F-Score)')
      if (overallRating === 'fair') overallRating = 'good'
    }
    if (scores.altmanZScore && (scores.altmanZScore as { interpretation: string }).interpretation === 'safe') {
      greenFlags.push('Low bankruptcy risk')
      if (overallRating === 'fair') overallRating = 'good'
    }
    if (scores.accrualsQuality && (scores.accrualsQuality as { interpretation: string }).interpretation === 'high_quality') {
      greenFlags.push('High-quality earnings backed by cash flow')
    }

    if (redFlags.length === 0 && greenFlags.length >= 2) {
      overallRating = 'excellent'
    }

    return NextResponse.json({
      company,
      fiscalYear: latestFiscalYear,
      overallRating,
      redFlags,
      greenFlags,
      scores,
      financialInputs: {
        revenue: completeInputs.revenue,
        netIncome: completeInputs.netIncome,
        totalAssets: completeInputs.totalAssets,
        totalLiabilities: completeInputs.totalLiabilities,
        cash: completeInputs.cash,
        operatingCashFlow: completeInputs.operatingCashFlow,
      },
    })
  } catch (error) {
    console.error('Error calculating intelligence scores:', error)
    return NextResponse.json(
      { error: 'Failed to calculate intelligence scores' },
      { status: 500 }
    )
  }
}
