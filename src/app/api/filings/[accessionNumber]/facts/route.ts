import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessionNumber: string }> }
) {
  try {
    const { accessionNumber } = await params
    const decoded = decodeURIComponent(accessionNumber)
    const searchParams = request.nextUrl.searchParams

    // Optional filters
    const taxonomy = searchParams.get('taxonomy')
    const tag = searchParams.get('tag')
    const periodType = searchParams.get('periodType')
    const limit = parseInt(searchParams.get('limit') || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Find the filing
    const filing = await prisma.filing.findUnique({
      where: { accessionNumber: decoded },
      select: {
        id: true,
        accessionNumber: true,
        formType: true,
        filingDate: true,
        periodEndDate: true,
        company: {
          select: {
            cik: true,
            name: true,
            ticker: true,
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

    // Build where clause for facts
    const whereClause: Record<string, unknown> = {
      filingId: filing.id,
    }

    if (taxonomy) {
      whereClause.taxonomy = taxonomy
    }
    if (tag) {
      whereClause.tag = { contains: tag, mode: 'insensitive' }
    }
    if (periodType) {
      whereClause.periodType = periodType
    }

    // Get facts with pagination
    const [facts, totalCount] = await Promise.all([
      prisma.xBRLFact.findMany({
        where: whereClause,
        orderBy: [
          { taxonomy: 'asc' },
          { tag: 'asc' },
          { periodEnd: 'desc' },
        ],
        take: limit,
        skip: offset,
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
          segment: true,
        },
      }),
      prisma.xBRLFact.count({ where: whereClause }),
    ])

    // Group facts by tag for easier consumption
    type FactType = typeof facts[number]
    const groupedByTag = facts.reduce((acc: Record<string, FactType[]>, fact: FactType) => {
      const key = `${fact.taxonomy}:${fact.tag}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(fact)
      return acc
    }, {})

    // Get unique tags for filtering
    const uniqueTags = await prisma.xBRLFact.groupBy({
      by: ['taxonomy', 'tag'],
      where: { filingId: filing.id },
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: 100,
    })

    return NextResponse.json({
      filing: {
        accessionNumber: filing.accessionNumber,
        formType: filing.formType,
        filingDate: filing.filingDate,
        periodEndDate: filing.periodEndDate,
        company: filing.company,
      },
      facts,
      groupedByTag,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + facts.length < totalCount,
      },
      availableTags: uniqueTags.map(t => ({
        concept: `${t.taxonomy}:${t.tag}`,
        taxonomy: t.taxonomy,
        tag: t.tag,
        count: t._count.tag,
      })),
    })
  } catch (error) {
    console.error('Error fetching filing facts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filing facts' },
      { status: 500 }
    )
  }
}
