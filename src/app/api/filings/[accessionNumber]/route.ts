import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessionNumber: string }> }
) {
  try {
    const { accessionNumber } = await params
    // Handle URL-encoded accession number (dashes become encoded)
    const decodedAccession = decodeURIComponent(accessionNumber)

    const filing = await prisma.filing.findUnique({
      where: { accessionNumber: decodedAccession },
      include: {
        company: {
          select: {
            cik: true,
            name: true,
            ticker: true,
            sector: true,
          },
        },
        sections: {
          orderBy: { startOffset: 'asc' },
          select: {
            id: true,
            sectionType: true,
            sectionTitle: true,
            rawText: true,
            wordCount: true,
            startOffset: true,
            endOffset: true,
          },
        },
        events: {
          orderBy: { itemNumber: 'asc' },
          select: {
            id: true,
            itemNumber: true,
            itemTitle: true,
            eventType: true,
            eventDate: true,
            summary: true,
            rawText: true,
          },
        },
        xbrlFacts: {
          take: 200,
          orderBy: [{ taxonomy: 'asc' }, { tag: 'asc' }],
          select: {
            id: true,
            taxonomy: true,
            tag: true,
            label: true,
            value: true,
            datatype: true,
            unit: true,
            periodType: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    })

    if (!filing) {
      return NextResponse.json(
        { error: 'Filing not found' },
        { status: 404 }
      )
    }

    // Also fetch risk factors from the company if this is a 10-K
    let riskFactors: Array<{
      id: string
      title: string
      category: string
      description: string
    }> = []

    if (filing.formType === '10-K' || filing.formType === '10-K/A') {
      const companyRisks = await prisma.riskFactor.findMany({
        where: {
          companyId: filing.company.cik ? undefined : undefined,
          filingId: filing.id,
        },
        take: 20,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
        },
      })
      riskFactors = companyRisks
    }

    // Define interfaces for the related data
    interface SectionData {
      id: string
      sectionType: string
      sectionTitle: string
      rawText: string
      wordCount: number
      startOffset: number
      endOffset: number
    }

    interface EventData {
      id: string
      itemNumber: string
      itemTitle: string
      eventType: string
      eventDate: Date | null
      summary: string | null
      rawText: string
    }

    interface XBRLData {
      id: string
      taxonomy: string
      tag: string
      label: string | null
      value: string
      datatype: string
      unit: string | null
      periodType: string
      periodStart: Date | null
      periodEnd: Date | null
    }

    // Transform the response to match frontend expectations
    const response = {
      ...filing,
      filingUrl: filing.primaryDocUrl,
      periodOfReport: filing.periodEndDate,
      sections: filing.sections.map((s: SectionData) => ({
        id: s.id,
        sectionType: s.sectionTitle || s.sectionType,
        content: s.rawText,
        wordCount: s.wordCount,
      })),
      events: filing.events.map((e: EventData) => ({
        id: e.id,
        itemNumber: e.itemNumber,
        itemTitle: e.itemTitle,
        eventType: e.eventType,
        eventDate: e.eventDate,
        summary: e.summary || e.rawText.substring(0, 500),
      })),
      xbrlFacts: filing.xbrlFacts.map((f: XBRLData) => ({
        id: f.id,
        concept: `${f.taxonomy}:${f.tag}`,
        value: f.value,
        unitRef: f.unit,
        period: f.periodEnd ? formatPeriod(f.periodStart, f.periodEnd, f.periodType) : null,
        contextRef: f.periodType,
      })),
      riskFactors: riskFactors.map(r => ({
        id: r.id,
        title: r.title,
        content: r.description,
        riskCategory: r.category,
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching filing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filing' },
      { status: 500 }
    )
  }
}

function formatPeriod(start: Date | null, end: Date, periodType: string): string {
  const endDate = new Date(end)
  const year = endDate.getFullYear()

  if (periodType === 'instant') {
    return endDate.toISOString().split('T')[0]
  }

  // For duration, try to determine the period (Q1-Q4 or FY)
  if (start) {
    const startDate = new Date(start)
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                       (endDate.getMonth() - startDate.getMonth())

    if (monthsDiff >= 11 && monthsDiff <= 13) {
      return `FY${year}`
    }

    const quarter = Math.ceil((endDate.getMonth() + 1) / 3)
    return `Q${quarter} ${year}`
  }

  return `${year}`
}
