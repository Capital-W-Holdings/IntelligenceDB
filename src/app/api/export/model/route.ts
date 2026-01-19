import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import { generateFinancialModel, generateXLSX, workbookToBuffer, getSuggestedFilename } from '@/lib/model-generator'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cik = searchParams.get('cik')

    if (!cik) {
      return NextResponse.json(
        { error: 'CIK parameter is required' },
        { status: 400 }
      )
    }

    // Get company info from database
    const company = await prisma.company.findUnique({
      where: { cik },
      select: {
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
        { error: 'Could not fetch company financial data from SEC' },
        { status: 404 }
      )
    }

    // Generate financial model
    const model = generateFinancialModel(companyFacts, {
      cik: company.cik,
      name: company.name,
      ticker: company.ticker,
      sector: company.sector,
    })

    // Generate Excel workbook
    const workbook = generateXLSX(model)
    const buffer = workbookToBuffer(workbook)
    const filename = getSuggestedFilename(model)

    // Return as file download (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating model:', error)
    return NextResponse.json(
      { error: 'Failed to generate financial model' },
      { status: 500 }
    )
  }
}

// POST endpoint to generate model with custom options
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cik, periods = 5, includeKPIs = true, includeBalanceSheet = true, includeCashFlow = true } = body

    if (!cik) {
      return NextResponse.json(
        { error: 'CIK parameter is required' },
        { status: 400 }
      )
    }

    // Get company info from database
    const company = await prisma.company.findUnique({
      where: { cik },
      select: {
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
        { error: 'Could not fetch company financial data from SEC' },
        { status: 404 }
      )
    }

    // Generate financial model with options
    const model = generateFinancialModel(
      companyFacts,
      {
        cik: company.cik,
        name: company.name,
        ticker: company.ticker,
        sector: company.sector,
      },
      { periods, includeKPIs, includeBalanceSheet, includeCashFlow }
    )

    // Generate Excel workbook
    const workbook = generateXLSX(model)
    const buffer = workbookToBuffer(workbook)
    const filename = getSuggestedFilename(model)

    // Return as file download (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating model:', error)
    return NextResponse.json(
      { error: 'Failed to generate financial model' },
      { status: 500 }
    )
  }
}
