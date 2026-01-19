import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const type = searchParams.get('type') || 'all' // all, companies, filings, events
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const results: {
      companies: unknown[]
      filings: unknown[]
      events: unknown[]
    } = {
      companies: [],
      filings: [],
      events: [],
    }

    // Search companies
    if (type === 'all' || type === 'companies') {
      results.companies = await prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { ticker: { contains: query, mode: 'insensitive' } },
            { cik: { contains: query } },
          ],
        },
        take: limit,
        select: {
          cik: true,
          name: true,
          ticker: true,
          sector: true,
        },
      })
    }

    // Search filings (by form type or description)
    if (type === 'all' || type === 'filings') {
      results.filings = await prisma.filing.findMany({
        where: {
          OR: [
            { formType: { contains: query, mode: 'insensitive' } },
            { company: { name: { contains: query, mode: 'insensitive' } } },
            { company: { ticker: { contains: query, mode: 'insensitive' } } },
          ],
        },
        take: limit,
        include: {
          company: {
            select: {
              cik: true,
              name: true,
              ticker: true,
            },
          },
        },
        orderBy: { filingDate: 'desc' },
      })
    }

    // Search events (8-K items with healthcare relevance)
    if (type === 'all' || type === 'events') {
      results.events = await prisma.filingEvent.findMany({
        where: {
          OR: [
            { itemTitle: { contains: query, mode: 'insensitive' } },
            { summary: { contains: query, mode: 'insensitive' } },
            { eventType: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        include: {
          filing: {
            select: {
              accessionNumber: true,
              formType: true,
              filingDate: true,
              company: {
                select: {
                  cik: true,
                  name: true,
                  ticker: true,
                },
              },
            },
          },
        },
        orderBy: { eventDate: 'desc' },
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error searching:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
