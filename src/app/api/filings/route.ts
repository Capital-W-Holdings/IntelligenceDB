import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cik = searchParams.get('cik')
    const formType = searchParams.get('formType')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}

    if (cik) {
      where.company = { cik }
    }

    if (formType) {
      where.formType = formType
    }

    if (startDate || endDate) {
      where.filingDate = {}
      if (startDate) {
        (where.filingDate as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        (where.filingDate as Record<string, Date>).lte = new Date(endDate)
      }
    }

    const [filings, total] = await Promise.all([
      prisma.filing.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { filingDate: 'desc' },
        include: {
          company: {
            select: {
              cik: true,
              name: true,
              ticker: true,
              sector: true,
            },
          },
          _count: {
            select: {
              sections: true,
              events: true,
              xbrlFacts: true,
            },
          },
        },
      }),
      prisma.filing.count({ where }),
    ])

    return NextResponse.json({
      filings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching filings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filings' },
      { status: 500 }
    )
  }
}
