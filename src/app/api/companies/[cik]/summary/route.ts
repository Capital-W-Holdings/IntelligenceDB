import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import {
  calculateBeneishMScore,
  calculateAltmanZScore,
  calculatePiotroskiFScore,
  FinancialInputs,
} from '@/lib/intelligence/earnings-quality'

interface XBRLFactData {
  tag: string
  value: string
  periodEnd: Date | null
  periodType: string
}

function mapXBRLToFinancials(
  facts: XBRLFactData[],
  fiscalYear: number
): Partial<FinancialInputs> & { priorYear?: Partial<FinancialInputs> } {
  const result: Partial<FinancialInputs> = {}
  const priorYear: Partial<FinancialInputs> = {}

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

  result.revenue = findFact(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], fiscalYear)
  result.netIncome = findFact(['NetIncomeLoss', 'ProfitLoss'], fiscalYear)
  result.totalAssets = findFact(['Assets'], fiscalYear)
  result.currentAssets = findFact(['AssetsCurrent'], fiscalYear)
  result.currentLiabilities = findFact(['LiabilitiesCurrent'], fiscalYear)
  result.totalLiabilities = findFact(['Liabilities'], fiscalYear)
  result.longTermDebt = findFact(['LongTermDebt', 'LongTermDebtNoncurrent'], fiscalYear)
  result.shareholdersEquity = findFact(['StockholdersEquity'], fiscalYear)
  result.cash = findFact(['CashAndCashEquivalentsAtCarryingValue', 'Cash'], fiscalYear)
  result.receivables = findFact(['AccountsReceivableNetCurrent'], fiscalYear)
  result.operatingIncome = findFact(['OperatingIncomeLoss'], fiscalYear)
  result.operatingCashFlow = findFact(['NetCashProvidedByUsedInOperatingActivities'], fiscalYear)
  result.retainedEarnings = findFact(['RetainedEarningsAccumulatedDeficit'], fiscalYear)

  if (result.currentAssets !== undefined && result.currentLiabilities !== undefined) {
    result.workingCapital = result.currentAssets - result.currentLiabilities
  }
  if (result.operatingIncome !== undefined) {
    result.ebit = result.operatingIncome
  }

  const priorFiscalYear = fiscalYear - 1
  priorYear.totalAssets = findFact(['Assets'], priorFiscalYear)
  priorYear.revenue = findFact(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'], priorFiscalYear)
  priorYear.receivables = findFact(['AccountsReceivableNetCurrent'], priorFiscalYear)
  priorYear.currentAssets = findFact(['AssetsCurrent'], priorFiscalYear)
  priorYear.currentLiabilities = findFact(['LiabilitiesCurrent'], priorFiscalYear)
  priorYear.longTermDebt = findFact(['LongTermDebt'], priorFiscalYear)

  return {
    ...result,
    priorTotalAssets: priorYear.totalAssets,
    priorRevenue: priorYear.revenue,
    priorReceivables: priorYear.receivables,
    priorCurrentAssets: priorYear.currentAssets,
    priorCurrentLiabilities: priorYear.currentLiabilities,
    priorLongTermDebt: priorYear.longTermDebt,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params
    const secClient = new SECClient()

    // Try to get company from database first
    let company = await prisma.company.findUnique({
      where: { cik },
      include: {
        metrics: {
          orderBy: { periodEnd: 'desc' },
          take: 1,
        },
        filings: {
          where: { formType: { in: ['10-K', '10-K/A', '8-K', '8-K/A'] } },
          orderBy: { filingDate: 'desc' },
          take: 20,
          select: {
            id: true,
            accessionNumber: true,
            formType: true,
            filingDate: true,
          },
        },
      },
    }).catch(() => null)

    // If not in DB, fetch basic info from SEC
    let companyInfo: { cik: string; name: string; ticker?: string | null; sector?: string | null } = {
      cik,
      name: 'Unknown Company',
      ticker: null,
      sector: null,
    }

    if (company) {
      companyInfo = {
        cik: company.cik,
        name: company.name,
        ticker: company.ticker,
        sector: company.sector,
      }
    } else {
      // Try to get company info from SEC submissions
      try {
        const submissions = await secClient.getCompanySubmissions(cik)
        if (submissions) {
          companyInfo = {
            cik,
            name: submissions.name || 'Unknown Company',
            ticker: submissions.tickers?.[0] || null,
            sector: null,
          }
        }
      } catch {
        // Continue with default info
      }
    }

    // Get XBRL facts from SEC for earnings quality scores
    let earningsQuality = null

    try {
      const companyFacts = await secClient.getCompanyFacts(cik)

      if (companyFacts?.facts?.['us-gaap']) {
        const facts: XBRLFactData[] = []
        const currentYear = new Date().getFullYear()

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

        if (facts.length > 0) {
          const latestFiscalYear = Math.max(
            ...facts
              .filter(f => f.periodEnd)
              .map(f => f.periodEnd!.getFullYear())
              .filter(y => y <= currentYear)
          )

          if (latestFiscalYear > 0) {
            const financials = mapXBRLToFinancials(facts, latestFiscalYear)

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
              priorTotalAssets: financials.priorTotalAssets,
              priorRevenue: financials.priorRevenue,
              priorReceivables: financials.priorReceivables,
              priorCurrentAssets: financials.priorCurrentAssets,
              priorCurrentLiabilities: financials.priorCurrentLiabilities,
              priorLongTermDebt: financials.priorLongTermDebt,
            }

            let overallRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'fair'
            let piotroskiFScore: number | undefined
            let altmanZ: { score: number; interpretation: string } | undefined
            let beneishM: { score: number; interpretation: string } | undefined

            if (completeInputs.totalAssets > 0) {
              const altman = calculateAltmanZScore(completeInputs, false)
              altmanZ = { score: altman.zScore, interpretation: altman.interpretation }

              if (altman.interpretation === 'distress') overallRating = 'critical'
              else if (altman.interpretation === 'safe' && overallRating === 'fair') overallRating = 'good'
            }

            if (completeInputs.totalAssets > 0 && completeInputs.priorTotalAssets) {
              const piotroski = calculatePiotroskiFScore(completeInputs)
              if (piotroski) {
                piotroskiFScore = piotroski.score
                if (piotroski.score >= 7 && overallRating !== 'critical') overallRating = piotroski.score >= 8 ? 'excellent' : 'good'
              }

              const beneish = calculateBeneishMScore(completeInputs)
              if (beneish) {
                beneishM = { score: beneish.mScore, interpretation: beneish.interpretation }
                if (beneish.interpretation === 'high_risk') overallRating = 'poor'
              }
            }

            earningsQuality = { overallRating, piotroskiFScore, altmanZ, beneishM }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SEC XBRL data:', error)
    }

    return NextResponse.json({
      company: companyInfo,
      metrics: company?.metrics?.[0] || null,
      summary: {
        totalFilings: company?.filings?.length || 0,
        total10K: company?.filings?.filter((f: { formType: string }) => f.formType.includes('10-K')).length || 0,
        total8K: company?.filings?.filter((f: { formType: string }) => f.formType.includes('8-K')).length || 0,
        events8KCount: 0,
        insiderTxCount: 0,
        riskFactorChanges: 0,
      },
      earningsQuality,
      recentFilings: company?.filings?.slice(0, 5) || [],
    })
  } catch (error) {
    console.error('Error fetching company summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company summary', details: String(error) },
      { status: 500 }
    )
  }
}
