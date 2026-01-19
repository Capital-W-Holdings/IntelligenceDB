import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import {
  calculateBeneishMScore,
  calculateAltmanZScore,
  calculatePiotroskiFScore,
  calculateAccrualsQuality,
  calculateCashRunway,
  FinancialInputs,
} from '@/lib/intelligence/earnings-quality'

interface XBRLFactData {
  tag: string
  value: string
  periodEnd: Date | null
}

function mapXBRLToFinancials(facts: XBRLFactData[], fiscalYear: number): FinancialInputs {
  const findFact = (tags: string[], year: number): number | undefined => {
    for (const tag of tags) {
      const fact = facts.find(f => {
        const tagLower = f.tag.toLowerCase()
        return (tagLower === tag.toLowerCase() || tagLower.includes(tag.toLowerCase())) &&
               f.periodEnd?.getFullYear() === year
      })
      if (fact) {
        const value = parseFloat(fact.value)
        if (!isNaN(value)) return value
      }
    }
    return undefined
  }

  const priorYear = fiscalYear - 1

  return {
    revenue: findFact(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], fiscalYear) || 0,
    costOfRevenue: findFact(['CostOfRevenue', 'CostOfGoodsAndServicesSold'], fiscalYear) || 0,
    grossProfit: findFact(['GrossProfit'], fiscalYear) || 0,
    netIncome: findFact(['NetIncomeLoss', 'ProfitLoss'], fiscalYear) || 0,
    operatingIncome: findFact(['OperatingIncomeLoss'], fiscalYear) || 0,
    totalAssets: findFact(['Assets'], fiscalYear) || 0,
    currentAssets: findFact(['AssetsCurrent'], fiscalYear) || 0,
    currentLiabilities: findFact(['LiabilitiesCurrent'], fiscalYear) || 0,
    totalLiabilities: findFact(['Liabilities'], fiscalYear) || 0,
    longTermDebt: findFact(['LongTermDebt', 'LongTermDebtNoncurrent'], fiscalYear) || 0,
    shareholdersEquity: findFact(['StockholdersEquity'], fiscalYear) || 0,
    cash: findFact(['CashAndCashEquivalentsAtCarryingValue', 'Cash'], fiscalYear) || 0,
    receivables: findFact(['AccountsReceivableNetCurrent'], fiscalYear) || 0,
    inventory: findFact(['InventoryNet'], fiscalYear) || 0,
    ppenet: findFact(['PropertyPlantAndEquipmentNet'], fiscalYear) || 0,
    depreciation: findFact(['DepreciationDepletionAndAmortization'], fiscalYear) || 0,
    sgaExpense: findFact(['SellingGeneralAndAdministrativeExpense'], fiscalYear) || 0,
    operatingCashFlow: findFact(['NetCashProvidedByUsedInOperatingActivities'], fiscalYear) || 0,
    retainedEarnings: findFact(['RetainedEarningsAccumulatedDeficit'], fiscalYear) || 0,
    workingCapital: (findFact(['AssetsCurrent'], fiscalYear) || 0) - (findFact(['LiabilitiesCurrent'], fiscalYear) || 0),
    ebit: findFact(['OperatingIncomeLoss'], fiscalYear) || 0,
    priorRevenue: findFact(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'], priorYear),
    priorGrossProfit: findFact(['GrossProfit'], priorYear),
    priorTotalAssets: findFact(['Assets'], priorYear),
    priorReceivables: findFact(['AccountsReceivableNetCurrent'], priorYear),
    priorInventory: findFact(['InventoryNet'], priorYear),
    priorCurrentAssets: findFact(['AssetsCurrent'], priorYear),
    priorCurrentLiabilities: findFact(['LiabilitiesCurrent'], priorYear),
    priorPPENet: findFact(['PropertyPlantAndEquipmentNet'], priorYear),
    priorDepreciation: findFact(['DepreciationDepletionAndAmortization'], priorYear),
    priorSGAExpense: findFact(['SellingGeneralAndAdministrativeExpense'], priorYear),
    priorLongTermDebt: findFact(['LongTermDebt'], priorYear),
  }
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function generateReportHTML(data: {
  company: { cik: string; name: string; ticker?: string | null; sector?: string | null }
  fiscalYear: number
  financials: FinancialInputs
  scores: {
    piotroski?: { score: number; components: { profitability: number; leverage: number; efficiency: number } }
    altmanZ?: { score: number; interpretation: string }
    beneishM?: { mScore: number; interpretation: string }
    accrualsQuality?: { ratio: number; interpretation: string }
    cashRunway?: { runwayMonths: number; interpretation: string }
  }
  overallRating: string
  redFlags: string[]
  greenFlags: string[]
  recentFilings: Array<{ formType: string; filingDate: Date; accessionNumber: string }>
}): string {
  const { company, fiscalYear, financials, scores, overallRating, redFlags, greenFlags, recentFilings } = data

  const ratingColors: Record<string, string> = {
    excellent: '#22c55e',
    good: '#3b82f6',
    fair: '#eab308',
    poor: '#f97316',
    critical: '#ef4444',
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${company.name} - Intelligence Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; }
    .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; color: #1e40af; }
    .header .ticker { color: #6b7280; font-size: 18px; font-family: monospace; }
    .header .meta { color: #6b7280; font-size: 14px; margin-top: 8px; }
    .rating-badge { display: inline-block; padding: 8px 20px; border-radius: 6px; color: white; font-weight: bold; font-size: 16px; text-transform: uppercase; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 20px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .card-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 24px; font-weight: 700; color: #111827; margin-top: 4px; }
    .card-sublabel { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .score-box { display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }
    .score-circle { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: white; }
    .score-info h4 { font-size: 14px; font-weight: 600; }
    .score-info p { font-size: 12px; color: #6b7280; }
    .flag { padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 14px; }
    .flag-red { background: #fef2f2; border-left: 4px solid #ef4444; color: #991b1b; }
    .flag-green { background: #f0fdf4; border-left: 4px solid #22c55e; color: #166534; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .table th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1>${company.name}</h1>
          ${company.ticker ? `<span class="ticker">${company.ticker}</span>` : ''}
          <div class="meta">
            CIK: ${company.cik} ${company.sector ? `• ${company.sector}` : ''} • Fiscal Year ${fiscalYear}
          </div>
        </div>
        <div class="rating-badge" style="background: ${ratingColors[overallRating] || '#6b7280'}">
          ${overallRating.toUpperCase()}
        </div>
      </div>
    </header>

    <section class="section">
      <h2 class="section-title">Executive Summary</h2>
      <div class="grid">
        <div class="card">
          <div class="card-label">Revenue</div>
          <div class="card-value">${formatCurrency(financials.revenue)}</div>
        </div>
        <div class="card">
          <div class="card-label">Net Income</div>
          <div class="card-value" style="color: ${financials.netIncome < 0 ? '#ef4444' : '#111827'}">${formatCurrency(financials.netIncome)}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Assets</div>
          <div class="card-value">${formatCurrency(financials.totalAssets)}</div>
        </div>
        <div class="card">
          <div class="card-label">Cash Position</div>
          <div class="card-value">${formatCurrency(financials.cash)}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Intelligence Scores</h2>
      ${scores.piotroski ? `
      <div class="score-box">
        <div class="score-circle" style="background: ${scores.piotroski.score >= 7 ? '#22c55e' : scores.piotroski.score >= 4 ? '#eab308' : '#ef4444'}">
          ${scores.piotroski.score}/9
        </div>
        <div class="score-info">
          <h4>Piotroski F-Score</h4>
          <p>${scores.piotroski.score >= 7 ? 'Strong financial health' : scores.piotroski.score >= 4 ? 'Average financial health' : 'Weak financial health'}</p>
        </div>
      </div>
      ` : ''}
      ${scores.altmanZ ? `
      <div class="score-box">
        <div class="score-circle" style="background: ${scores.altmanZ.interpretation === 'safe' ? '#22c55e' : scores.altmanZ.interpretation === 'gray' ? '#eab308' : '#ef4444'}">
          ${scores.altmanZ.score.toFixed(1)}
        </div>
        <div class="score-info">
          <h4>Altman Z-Score</h4>
          <p>${scores.altmanZ.interpretation === 'safe' ? 'Low bankruptcy risk' : scores.altmanZ.interpretation === 'gray' ? 'Gray zone - monitor closely' : 'High bankruptcy risk'}</p>
        </div>
      </div>
      ` : ''}
      ${scores.beneishM ? `
      <div class="score-box">
        <div class="score-circle" style="background: ${scores.beneishM.interpretation === 'low_risk' ? '#22c55e' : scores.beneishM.interpretation === 'moderate_risk' ? '#eab308' : '#ef4444'}">
          ${scores.beneishM.mScore.toFixed(1)}
        </div>
        <div class="score-info">
          <h4>Beneish M-Score</h4>
          <p>${scores.beneishM.interpretation === 'low_risk' ? 'Low manipulation risk' : scores.beneishM.interpretation === 'moderate_risk' ? 'Moderate manipulation risk' : 'High manipulation risk'}</p>
        </div>
      </div>
      ` : ''}
      ${scores.cashRunway ? `
      <div class="score-box">
        <div class="score-circle" style="background: ${scores.cashRunway.interpretation === 'strong' ? '#22c55e' : scores.cashRunway.interpretation === 'adequate' ? '#eab308' : '#ef4444'}">
          ${scores.cashRunway.runwayMonths}mo
        </div>
        <div class="score-info">
          <h4>Cash Runway</h4>
          <p>${scores.cashRunway.interpretation === 'strong' ? 'Strong runway (>24 months)' : scores.cashRunway.interpretation === 'adequate' ? 'Adequate runway' : 'Critical - financing needed'}</p>
        </div>
      </div>
      ` : ''}
    </section>

    ${redFlags.length > 0 || greenFlags.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Key Signals</h2>
      ${redFlags.map(flag => `<div class="flag flag-red">⚠️ ${flag}</div>`).join('')}
      ${greenFlags.map(flag => `<div class="flag flag-green">✓ ${flag}</div>`).join('')}
    </section>
    ` : ''}

    <section class="section">
      <h2 class="section-title">Financial Summary</h2>
      <table class="table">
        <tr><th>Metric</th><th>Value</th><th>Analysis</th></tr>
        <tr><td>Revenue</td><td>${formatCurrency(financials.revenue)}</td><td>${financials.priorRevenue ? `${((financials.revenue - financials.priorRevenue) / financials.priorRevenue * 100).toFixed(1)}% YoY` : 'N/A'}</td></tr>
        <tr><td>Net Income</td><td>${formatCurrency(financials.netIncome)}</td><td>${financials.netIncome < 0 ? 'Loss' : `${(financials.netIncome / financials.revenue * 100).toFixed(1)}% margin`}</td></tr>
        <tr><td>Operating Cash Flow</td><td>${formatCurrency(financials.operatingCashFlow)}</td><td>${financials.operatingCashFlow > 0 ? 'Cash generative' : 'Cash consuming'}</td></tr>
        <tr><td>Total Debt</td><td>${formatCurrency(financials.longTermDebt + (financials.currentLiabilities - (financials.currentAssets - financials.cash)))}</td><td>${financials.totalAssets > 0 ? `${((financials.totalLiabilities / financials.totalAssets) * 100).toFixed(1)}% of assets` : 'N/A'}</td></tr>
        <tr><td>Working Capital</td><td>${formatCurrency(financials.workingCapital)}</td><td>${financials.workingCapital > 0 ? 'Positive' : 'Negative'}</td></tr>
        <tr><td>Current Ratio</td><td>${financials.currentLiabilities > 0 ? (financials.currentAssets / financials.currentLiabilities).toFixed(2) : 'N/A'}</td><td>${financials.currentLiabilities > 0 && financials.currentAssets / financials.currentLiabilities >= 1.5 ? 'Healthy' : 'Monitor'}</td></tr>
      </table>
    </section>

    ${recentFilings.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Recent SEC Filings</h2>
      <table class="table">
        <tr><th>Form Type</th><th>Filing Date</th><th>Accession Number</th></tr>
        ${recentFilings.map(f => `<tr><td>${f.formType}</td><td>${formatDate(f.filingDate)}</td><td>${f.accessionNumber}</td></tr>`).join('')}
      </table>
    </section>
    ` : ''}

    <footer class="footer">
      <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <p>Healthcare Filings Intelligence Platform • This report is for informational purposes only and does not constitute investment advice.</p>
    </footer>
  </div>
</body>
</html>
`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params

    const company = await prisma.company.findUnique({
      where: { cik },
      include: {
        filings: {
          orderBy: { filingDate: 'desc' },
          take: 10,
          select: {
            formType: true,
            filingDate: true,
            accessionNumber: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const secClient = new SECClient()
    const companyFacts = await secClient.getCompanyFacts(cik)

    if (!companyFacts?.facts?.['us-gaap']) {
      return new NextResponse(
        generateReportHTML({
          company: { cik: company.cik, name: company.name, ticker: company.ticker, sector: company.sector },
          fiscalYear: new Date().getFullYear() - 1,
          financials: {} as FinancialInputs,
          scores: {},
          overallRating: 'fair',
          redFlags: ['XBRL data not available'],
          greenFlags: [],
          recentFilings: company.filings,
        }),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const facts: XBRLFactData[] = []
    const currentYear = new Date().getFullYear()

    for (const [tag, data] of Object.entries(companyFacts.facts['us-gaap'])) {
      const tagData = data as { units?: Record<string, Array<{ val: number; end?: string; form?: string }>> }
      if (tagData.units) {
        for (const [, values] of Object.entries(tagData.units)) {
          for (const v of values) {
            if (v.end && (v.form === '10-K' || v.form === '10-K/A')) {
              facts.push({ tag, value: String(v.val), periodEnd: new Date(v.end) })
            }
          }
        }
      }
    }

    const latestFiscalYear = Math.max(
      ...facts.filter(f => f.periodEnd).map(f => f.periodEnd!.getFullYear()).filter(y => y <= currentYear)
    )

    const financials = mapXBRLToFinancials(facts, latestFiscalYear)

    const scores: {
      piotroski?: { score: number; components: { profitability: number; leverage: number; efficiency: number } }
      altmanZ?: { score: number; interpretation: string }
      beneishM?: { mScore: number; interpretation: string }
      accrualsQuality?: { ratio: number; interpretation: string }
      cashRunway?: { runwayMonths: number; interpretation: string }
    } = {}

    const redFlags: string[] = []
    const greenFlags: string[] = []
    let overallRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'fair'

    if (financials.totalAssets > 0) {
      const altman = calculateAltmanZScore(financials, false)
      scores.altmanZ = { score: altman.zScore, interpretation: altman.interpretation }

      if (altman.interpretation === 'distress') {
        redFlags.push('High bankruptcy risk (Altman Z-Score)')
        overallRating = 'critical'
      } else if (altman.interpretation === 'safe') {
        greenFlags.push('Low bankruptcy risk')
        if (overallRating === 'fair') overallRating = 'good'
      }
    }

    if (financials.totalAssets > 0 && financials.priorTotalAssets) {
      const piotroski = calculatePiotroskiFScore(financials)
      if (piotroski) {
        scores.piotroski = { score: piotroski.score, components: piotroski.components }
        if (piotroski.score >= 7) {
          greenFlags.push('Strong financial health (Piotroski F-Score)')
          if (overallRating !== 'critical') overallRating = piotroski.score >= 8 ? 'excellent' : 'good'
        } else if (piotroski.score <= 2) {
          redFlags.push('Weak financial health')
        }
      }

      const beneish = calculateBeneishMScore(financials)
      if (beneish) {
        scores.beneishM = { mScore: beneish.mScore, interpretation: beneish.interpretation }
        if (beneish.interpretation === 'high_risk') {
          redFlags.push('High manipulation risk (Beneish M-Score)')
          if (overallRating !== 'critical') overallRating = 'poor'
        } else if (beneish.interpretation === 'low_risk') {
          greenFlags.push('Low earnings manipulation risk')
        }
      }
    }

    const accrualsQ = calculateAccrualsQuality(financials)
    scores.accrualsQuality = { ratio: accrualsQ.accrualsRatio, interpretation: accrualsQ.interpretation }
    if (accrualsQ.interpretation === 'low_quality') {
      redFlags.push('Low earnings quality (high accruals)')
    } else if (accrualsQ.interpretation === 'high_quality') {
      greenFlags.push('High-quality earnings backed by cash flow')
    }

    if (financials.cash > 0 && financials.operatingCashFlow < 0) {
      const runway = calculateCashRunway(financials.cash, financials.operatingCashFlow)
      scores.cashRunway = { runwayMonths: runway.runwayMonths, interpretation: runway.interpretation }
      if (runway.interpretation === 'critical') {
        redFlags.push(`Critical cash runway (${runway.runwayMonths} months)`)
        overallRating = 'critical'
      } else if (runway.interpretation === 'concerning') {
        redFlags.push(`Limited cash runway (${runway.runwayMonths} months)`)
      }
    }

    if (redFlags.length === 0 && greenFlags.length >= 2 && overallRating !== 'critical') {
      overallRating = 'excellent'
    }

    const html = generateReportHTML({
      company: { cik: company.cik, name: company.name, ticker: company.ticker, sector: company.sector },
      fiscalYear: latestFiscalYear,
      financials,
      scores,
      overallRating,
      redFlags,
      greenFlags,
      recentFilings: company.filings,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${company.ticker || company.name}_Intelligence_Report.html"`,
      },
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
