import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeSmartEvent, SmartEventResult } from '@/lib/intelligence/smart-events'

interface EnhancedEvent {
  id: string
  accessionNumber: string
  filingDate: Date
  itemNumber: string
  itemTitle: string
  rawText: string
  analysis: SmartEventResult
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const category = searchParams.get('category')
    const minMateriality = parseFloat(searchParams.get('minMateriality') || '0')

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

    // Get 8-K filings with their events
    const filings = await prisma.filing.findMany({
      where: {
        companyId: company.id,
        formType: { in: ['8-K', '8-K/A'] },
      },
      orderBy: { filingDate: 'desc' },
      take: limit * 2, // Get extra in case we filter some out
      select: {
        id: true,
        accessionNumber: true,
        filingDate: true,
        events: {
          select: {
            id: true,
            itemNumber: true,
            itemTitle: true,
            rawText: true,
            eventType: true,
          },
        },
      },
    })

    // Analyze each event
    const enhancedEvents: EnhancedEvent[] = []

    for (const filing of filings) {
      for (const event of filing.events) {
        if (!event.rawText || event.rawText.length < 50) continue

        const analysis = analyzeSmartEvent({
          itemNumber: event.itemNumber,
          itemTitle: event.itemTitle,
          rawText: event.rawText,
          companyName: company.name,
          companyTicker: company.ticker || undefined,
        })

        // Apply filters
        if (category && analysis.primaryCategory !== category) continue
        if (analysis.materialityScore < minMateriality) continue

        enhancedEvents.push({
          id: event.id,
          accessionNumber: filing.accessionNumber,
          filingDate: filing.filingDate,
          itemNumber: event.itemNumber,
          itemTitle: event.itemTitle,
          rawText: event.rawText,
          analysis,
        })

        if (enhancedEvents.length >= limit) break
      }
      if (enhancedEvents.length >= limit) break
    }

    // Sort by materiality (most material first)
    enhancedEvents.sort((a, b) => b.analysis.materialityScore - a.analysis.materialityScore)

    // Calculate category distribution
    const categoryDistribution: Record<string, number> = {}
    for (const event of enhancedEvents) {
      const cat = event.analysis.primaryCategory
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1
    }

    // Calculate average materiality
    const avgMateriality = enhancedEvents.length > 0
      ? enhancedEvents.reduce((sum, e) => sum + e.analysis.materialityScore, 0) / enhancedEvents.length
      : 0

    // Find high-alert events
    const highAlertEvents = enhancedEvents.filter(e => e.analysis.materialityScore >= 8)

    return NextResponse.json({
      company,
      totalEvents: enhancedEvents.length,
      categoryDistribution,
      averageMateriality: Math.round(avgMateriality * 10) / 10,
      highAlertCount: highAlertEvents.length,
      events: enhancedEvents.map(e => ({
        id: e.id,
        accessionNumber: e.accessionNumber,
        filingDate: e.filingDate,
        itemNumber: e.itemNumber,
        itemTitle: e.itemTitle,
        analysis: {
          primaryCategory: e.analysis.primaryCategory,
          subCategory: e.analysis.subCategory,
          sentiment: e.analysis.sentiment,
          materialityScore: e.analysis.materialityScore,
          summary: e.analysis.summary,
          keyPoints: e.analysis.keyPoints,
          investorImplications: e.analysis.investorImplications,
          relatedRisks: e.analysis.relatedRisks,
          entities: {
            people: e.analysis.entities.people.slice(0, 3),
            amounts: e.analysis.entities.amounts.slice(0, 3),
            drugs: e.analysis.entities.drugs.slice(0, 3),
          },
        },
        // Truncate raw text for response
        textPreview: e.rawText.substring(0, 500) + (e.rawText.length > 500 ? '...' : ''),
      })),
    })
  } catch (error) {
    console.error('Error analyzing smart events:', error)
    return NextResponse.json(
      { error: 'Failed to analyze 8-K events' },
      { status: 500 }
    )
  }
}
