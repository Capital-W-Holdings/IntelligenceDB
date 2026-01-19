import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import {
  extractRiskFactors,
  analyzeRiskFactorChanges,
  RiskFactor,
} from '@/lib/intelligence/risk-factors'

interface FilingSectionData {
  sectionType: string
  rawText: string
  filing: {
    accessionNumber: string
    filingDate: Date
    periodEndDate: Date | null
  }
}

/**
 * Extract Item 1A (Risk Factors) from a 10-K filing HTML
 */
function extractItem1AFromHtml(html: string): string | null {
  // Remove HTML tags but preserve structure
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '\n[TABLE]\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Find Item 1A section
  const item1aPatterns = [
    /item\s*1a\.?\s*risk\s*factors/i,
    /ITEM\s*1A\.?\s*RISK\s*FACTORS/,
    /risk\s*factors/i,
  ]

  let startIndex = -1
  for (const pattern of item1aPatterns) {
    const match = text.search(pattern)
    if (match !== -1) {
      startIndex = match
      break
    }
  }

  if (startIndex === -1) {
    return null
  }

  // Find end of section (next item or end of document)
  const endPatterns = [
    /item\s*1b\.?\s*unresolved\s*staff\s*comments/i,
    /item\s*2\.?\s*properties/i,
    /ITEM\s*1B/,
    /ITEM\s*2\./,
  ]

  let endIndex = text.length
  for (const pattern of endPatterns) {
    const match = text.slice(startIndex + 100).search(pattern)
    if (match !== -1) {
      endIndex = Math.min(endIndex, startIndex + 100 + match)
    }
  }

  const item1aText = text.slice(startIndex, endIndex)

  // Minimum viable section
  if (item1aText.length < 1000) {
    return null
  }

  return item1aText
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
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Get 10-K filings ordered by date
    const filings = await prisma.filing.findMany({
      where: {
        companyId: company.id,
        formType: { in: ['10-K', '10-K/A'] },
      },
      orderBy: { filingDate: 'desc' },
      take: 3, // Current + 2 prior years
      select: {
        id: true,
        accessionNumber: true,
        filingDate: true,
        periodEndDate: true,
        primaryDocUrl: true,
        sections: {
          where: { sectionType: 'item1a' },
          select: { rawText: true },
        },
      },
    })

    if (filings.length < 2) {
      return NextResponse.json({
        company,
        error: 'Need at least 2 annual filings for risk factor comparison',
        filings: filings.length,
      })
    }

    const secClient = new SECClient()
    const risksByFiling: Map<string, { year: number; risks: RiskFactor[] }> = new Map()

    // Process each filing
    for (const filing of filings.slice(0, 2)) {
      const year = filing.periodEndDate?.getFullYear() || filing.filingDate.getFullYear()

      // Check if we have cached section
      if (filing.sections.length > 0 && filing.sections[0].rawText) {
        const risks = extractRiskFactors(filing.sections[0].rawText)
        risksByFiling.set(filing.accessionNumber, { year, risks })
      } else {
        // Fetch from SEC
        try {
          const primaryDoc = filing.primaryDocUrl.split('/').pop() || ''
          const cikNum = company.cik.replace(/^0+/, '')
          const html = await secClient.getFilingDocument(
            cikNum,
            filing.accessionNumber,
            primaryDoc
          )

          const item1aText = extractItem1AFromHtml(html)
          if (item1aText) {
            const risks = extractRiskFactors(item1aText)
            risksByFiling.set(filing.accessionNumber, { year, risks })

            // Cache for future use (if section exists in schema)
            // await prisma.filingSection.upsert(...)
          }
        } catch (error) {
          console.error(`Error fetching filing ${filing.accessionNumber}:`, error)
        }
      }
    }

    // Get current and prior year data
    const entries = Array.from(risksByFiling.entries())
    if (entries.length < 2) {
      return NextResponse.json({
        company,
        error: 'Could not extract risk factors from filings',
      })
    }

    const [currentAccession, currentData] = entries[0]
    const [priorAccession, priorData] = entries[1]

    // Perform analysis
    const analysis = analyzeRiskFactorChanges(
      currentData.risks,
      priorData.risks,
      currentData.year,
      priorData.year
    )

    // Filter to only material changes for the response
    const materialChanges = analysis.changes.filter(c =>
      c.changeType !== 'unchanged'
    )

    return NextResponse.json({
      company,
      currentFiling: {
        accessionNumber: currentAccession,
        year: currentData.year,
        riskCount: currentData.risks.length,
      },
      priorFiling: {
        accessionNumber: priorAccession,
        year: priorData.year,
        riskCount: priorData.risks.length,
      },
      analysis: {
        ...analysis,
        changes: materialChanges.slice(0, 50), // Limit response size
      },
    })
  } catch (error) {
    console.error('Error analyzing risk factors:', error)
    return NextResponse.json(
      { error: 'Failed to analyze risk factors' },
      { status: 500 }
    )
  }
}
