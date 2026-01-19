import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface XBRLFactData {
  tag: string
  label: string | null
  value: string
  unit: string | null
  periodEnd: Date | null
}

interface SectionData {
  sectionType: string
  sectionTitle: string
  wordCount: number
}

interface EventData {
  itemNumber: string
  itemTitle: string
  eventType: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessionNumber: string; otherAccessionNumber: string }> }
) {
  try {
    const { accessionNumber, otherAccessionNumber } = await params
    const decoded1 = decodeURIComponent(accessionNumber)
    const decoded2 = decodeURIComponent(otherAccessionNumber)

    // Fetch both filings with their related data
    const [filing1, filing2] = await Promise.all([
      prisma.filing.findUnique({
        where: { accessionNumber: decoded1 },
        include: {
          company: {
            select: { name: true, ticker: true },
          },
          sections: {
            select: { sectionType: true, sectionTitle: true, wordCount: true },
          },
          xbrlFacts: {
            select: { tag: true, label: true, value: true, unit: true, periodEnd: true },
            take: 500,
          },
          events: {
            select: { itemNumber: true, itemTitle: true, eventType: true },
          },
        },
      }),
      prisma.filing.findUnique({
        where: { accessionNumber: decoded2 },
        include: {
          company: {
            select: { name: true, ticker: true },
          },
          sections: {
            select: { sectionType: true, sectionTitle: true, wordCount: true },
          },
          xbrlFacts: {
            select: { tag: true, label: true, value: true, unit: true, periodEnd: true },
            take: 500,
          },
          events: {
            select: { itemNumber: true, itemTitle: true, eventType: true },
          },
        },
      }),
    ])

    if (!filing1 || !filing2) {
      return NextResponse.json(
        { error: 'One or both filings not found' },
        { status: 404 }
      )
    }

    // Build section diff
    const allSectionTypes = new Set([
      ...filing1.sections.map((s: SectionData) => s.sectionType),
      ...filing2.sections.map((s: SectionData) => s.sectionType),
    ])

    const sectionDiffs = Array.from(allSectionTypes).map(sectionType => {
      const section1 = filing1.sections.find((s: SectionData) => s.sectionType === sectionType)
      const section2 = filing2.sections.find((s: SectionData) => s.sectionType === sectionType)

      return {
        sectionType,
        sectionTitle: section1?.sectionTitle || section2?.sectionTitle || sectionType,
        inFiling1: !!section1,
        inFiling2: !!section2,
        wordCount1: section1?.wordCount || null,
        wordCount2: section2?.wordCount || null,
        wordCountDiff: section1 && section2 ? section2.wordCount - section1.wordCount : null,
      }
    })

    // Build XBRL diff (compare same tags)
    const filing1Facts = new Map<string, XBRLFactData>(
      filing1.xbrlFacts.map((f: XBRLFactData) => [f.tag, f])
    )
    const filing2Facts = new Map<string, XBRLFactData>(
      filing2.xbrlFacts.map((f: XBRLFactData) => [f.tag, f])
    )

    const allTags = new Set([
      ...filing1.xbrlFacts.map((f: XBRLFactData) => f.tag),
      ...filing2.xbrlFacts.map((f: XBRLFactData) => f.tag),
    ])

    const xbrlDiffs = Array.from(allTags)
      .filter(tag => {
        return filing1Facts.has(tag) && filing2Facts.has(tag)
      })
      .map(tag => {
        const fact1 = filing1Facts.get(tag)
        const fact2 = filing2Facts.get(tag)

        let percentChange: number | null = null
        const val1 = fact1 ? parseFloat(fact1.value) : null
        const val2 = fact2 ? parseFloat(fact2.value) : null

        if (val1 && val2 && val1 !== 0) {
          percentChange = ((val2 - val1) / Math.abs(val1)) * 100
        }

        return {
          tag,
          label: fact1?.label || fact2?.label || null,
          value1: fact1?.value || null,
          value2: fact2?.value || null,
          unit: fact1?.unit || fact2?.unit || null,
          periodEnd: fact2?.periodEnd?.toISOString() || fact1?.periodEnd?.toISOString() || null,
          percentChange,
        }
      })
      .filter(diff => diff.percentChange !== null && Math.abs(diff.percentChange) > 0.01)
      .sort((a, b) => Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0))
      .slice(0, 50)

    // Build event diff
    const allEventItems = new Set([
      ...filing1.events.map((e: EventData) => e.itemNumber),
      ...filing2.events.map((e: EventData) => e.itemNumber),
    ])

    const eventDiffs = Array.from(allEventItems).map(itemNumber => {
      const event1 = filing1.events.find((e: EventData) => e.itemNumber === itemNumber)
      const event2 = filing2.events.find((e: EventData) => e.itemNumber === itemNumber)

      return {
        itemNumber,
        itemTitle: event1?.itemTitle || event2?.itemTitle || itemNumber,
        inFiling1: !!event1,
        inFiling2: !!event2,
        eventType1: event1?.eventType || null,
        eventType2: event2?.eventType || null,
      }
    })

    const result = {
      filing1: {
        accessionNumber: filing1.accessionNumber,
        formType: filing1.formType,
        filingDate: filing1.filingDate.toISOString(),
        company: filing1.company,
      },
      filing2: {
        accessionNumber: filing2.accessionNumber,
        formType: filing2.formType,
        filingDate: filing2.filingDate.toISOString(),
        company: filing2.company,
      },
      sections: sectionDiffs,
      xbrlDiffs,
      eventDiffs,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error generating diff:', error)
    return NextResponse.json(
      { error: 'Failed to generate filing diff' },
      { status: 500 }
    )
  }
}
