import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params

    // Try to get from database first
    const company = await prisma.company.findUnique({
      where: { cik },
      include: {
        filings: {
          orderBy: { filingDate: 'desc' },
          take: 20,
          select: {
            id: true,
            accessionNumber: true,
            formType: true,
            filingDate: true,
            periodEndDate: true,
            acceptedAt: true,
            primaryDocUrl: true,
          },
        },
        metrics: {
          orderBy: { periodEnd: 'desc' },
          take: 10,
        },
        products: {
          orderBy: { name: 'asc' },
          take: 20,
        },
        guidance: {
          where: { isCurrent: true },
          orderBy: { issuedDate: 'desc' },
          take: 5,
        },
        _count: {
          select: { filings: true, risks: true, products: true },
        },
      },
    }).catch(() => null)

    // If not in database, fetch from SEC directly
    if (!company) {
      const secClient = new SECClient()

      try {
        const submissions = await secClient.getCompanySubmissions(cik)

        if (!submissions || !submissions.name) {
          return NextResponse.json(
            { error: 'Company not found' },
            { status: 404 }
          )
        }

        // Build filings from SEC data
        const filings: Array<{
          accessionNumber: string
          formType: string
          filingDate: string
          primaryDocument: string | null
        }> = []

        const recentFilings = submissions.filings?.recent
        if (recentFilings?.accessionNumber) {
          const limit = Math.min(recentFilings.accessionNumber.length, 30)
          for (let i = 0; i < limit; i++) {
            filings.push({
              accessionNumber: recentFilings.accessionNumber[i],
              formType: recentFilings.form?.[i] || 'Unknown',
              filingDate: recentFilings.filingDate?.[i] || '',
              primaryDocument: recentFilings.primaryDocument?.[i] || null,
            })
          }
        }

        // Return SEC-sourced data
        return NextResponse.json({
          cik,
          name: submissions.name,
          ticker: submissions.tickers?.[0] || null,
          sector: null,
          sicCode: submissions.sic || null,
          sicDescription: submissions.sicDescription || null,
          filings,
          metrics: [],
          products: [],
          guidance: [],
          _count: {
            filings: filings.length,
            risks: 0,
            products: 0,
          },
          _source: 'sec', // Indicate data is from SEC, not DB
        })
      } catch (secError) {
        console.error('Error fetching from SEC:', secError)
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        )
      }
    }

    // Transform metrics to the format expected by the frontend
    // Group metrics by period and create a combined metrics object
    const metricsMap = new Map<string, Record<string, number | null>>()

    for (const metric of company.metrics) {
      const period = metric.period
      if (!metricsMap.has(period)) {
        metricsMap.set(period, {
          id: metric.id,
          period,
          periodEnd: metric.periodEnd ? new Date(metric.periodEnd).toISOString() : null,
        } as unknown as Record<string, number | null>)
      }

      const periodMetrics = metricsMap.get(period)!
      // Convert metric names to camelCase for frontend
      const metricKey = metric.metricName.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())
      periodMetrics[metricKey] = metric.value
    }

    // Define interface for filing data
    interface FilingData {
      id: string
      accessionNumber: string
      formType: string
      filingDate: Date
      periodEndDate: Date | null
      acceptedAt: Date | null
      primaryDocUrl: string
    }

    // Also get the latest XBRL facts for key metrics if no metrics exist
    let latestFacts: Record<string, number | null> = {}
    if (company.metrics.length === 0) {
      const latestFiling = company.filings.find((f: FilingData) => f.formType === '10-K' || f.formType === '10-Q')
      if (latestFiling) {
        const facts = await prisma.xBRLFact.findMany({
          where: {
            filingId: latestFiling.id,
            tag: {
              in: [
                'Revenues',
                'RevenueFromContractWithCustomerExcludingAssessedTax',
                'NetIncomeLoss',
                'Assets',
                'CashAndCashEquivalentsAtCarryingValue',
                'ResearchAndDevelopmentExpense',
                'GrossProfit',
                'OperatingIncomeLoss',
              ],
            },
          },
          orderBy: { periodEnd: 'desc' },
        })

        for (const fact of facts) {
          const value = parseFloat(fact.value)
          if (!isNaN(value)) {
            switch (fact.tag) {
              case 'Revenues':
              case 'RevenueFromContractWithCustomerExcludingAssessedTax':
                latestFacts.revenue = latestFacts.revenue ?? value
                break
              case 'NetIncomeLoss':
                latestFacts.netIncome = latestFacts.netIncome ?? value
                break
              case 'Assets':
                latestFacts.totalAssets = latestFacts.totalAssets ?? value
                break
              case 'CashAndCashEquivalentsAtCarryingValue':
                latestFacts.cashAndEquivalents = latestFacts.cashAndEquivalents ?? value
                break
              case 'ResearchAndDevelopmentExpense':
                latestFacts.rdExpense = latestFacts.rdExpense ?? value
                break
            }
          }
        }

        // Calculate derived metrics
        if (latestFacts.revenue && latestFacts.rdExpense) {
          latestFacts.rdIntensity = latestFacts.rdExpense / latestFacts.revenue
        }
      }
    }

    const metrics: Array<Record<string, unknown>> = Array.from(metricsMap.values())

    // If no metrics but we have XBRL facts, use those
    if (metrics.length === 0 && Object.keys(latestFacts).length > 0) {
      metrics.push({
        id: 'xbrl-derived',
        ...latestFacts,
      })
    }

    const response = {
      ...company,
      metrics,
      filings: company.filings.map((f: FilingData) => ({
        accessionNumber: f.accessionNumber,
        formType: f.formType,
        filingDate: f.filingDate,
        periodOfReport: f.periodEndDate,
        primaryDocument: f.primaryDocUrl,
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company', details: String(error) },
      { status: 500 }
    )
  }
}
