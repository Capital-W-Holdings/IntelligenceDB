import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import { generateFinancialModel } from '@/lib/model-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params
    const searchParams = request.nextUrl.searchParams
    const periods = parseInt(searchParams.get('periods') || '5')
    const includeKPIs = searchParams.get('includeKPIs') !== 'false'
    const includeBalanceSheet = searchParams.get('includeBalanceSheet') !== 'false'
    const includeCashFlow = searchParams.get('includeCashFlow') !== 'false'

    // Get company info
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
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Fetch company facts from SEC
    const secClient = new SECClient()
    const companyFacts = await secClient.getCompanyFacts(cik)

    if (!companyFacts) {
      return NextResponse.json(
        { error: 'No financial data available for this company' },
        { status: 404 }
      )
    }

    // Generate the financial model
    const model = generateFinancialModel(
      companyFacts,
      {
        cik: company.cik,
        name: company.name,
        ticker: company.ticker,
        sector: company.sector,
      },
      {
        periods,
        includeKPIs,
        includeBalanceSheet,
        includeCashFlow,
      }
    )

    return NextResponse.json(model)
  } catch (error) {
    console.error('Error generating model:', error)
    return NextResponse.json(
      { error: 'Failed to generate financial model' },
      { status: 500 }
    )
  }
}
