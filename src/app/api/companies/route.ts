import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sector = searchParams.get('sector')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (sector) {
      where.sector = sector
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ticker: { contains: search, mode: 'insensitive' } },
        { cik: { contains: search } },
      ]
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          cik: true,
          name: true,
          ticker: true,
          sicCode: true,
          sicDescription: true,
          sector: true,
          firstSeenAt: true,
          lastFilingDate: true,
          _count: {
            select: { filings: true },
          },
        },
      }),
      prisma.company.count({ where }),
    ])

    return NextResponse.json({
      companies,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}
