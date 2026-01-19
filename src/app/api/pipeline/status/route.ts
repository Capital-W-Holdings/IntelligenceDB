import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface PipelineRun {
  id: string
  runType: string
  status: string
  startedAt: Date
  completedAt: Date | null
  filingsFound: number
  filingsIngested: number
  filingsFailed: number
  errorLog: string | null
}

interface FilingStatusCount {
  status: string
  _count: { status: number }
}

export async function GET() {
  try {
    // Get the most recent pipeline runs
    const recentRuns = await prisma.pipelineRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    })

    // Check if there's a currently running pipeline
    const currentRun = recentRuns.find((run: PipelineRun) => run.status === 'running')

    // Get summary statistics
    const [companyCount, filingCount, eventCount, factCount] = await Promise.all([
      prisma.company.count(),
      prisma.filing.count(),
      prisma.filingEvent.count(),
      prisma.xBRLFact.count(),
    ])

    // Get filing status breakdown
    const filingsByStatus = await prisma.filing.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    // Get recent filings
    const recentFilings = await prisma.filing.findMany({
      orderBy: { filingDate: 'desc' },
      take: 5,
      select: {
        accessionNumber: true,
        formType: true,
        filingDate: true,
        status: true,
        company: {
          select: {
            name: true,
            ticker: true,
            cik: true,
          },
        },
      },
    })

    return NextResponse.json({
      status: currentRun ? 'running' : 'idle',
      currentRun: currentRun ? {
        id: currentRun.id,
        runType: currentRun.runType,
        startedAt: currentRun.startedAt,
        filingsFound: currentRun.filingsFound,
        filingsIngested: currentRun.filingsIngested,
        filingsFailed: currentRun.filingsFailed,
      } : null,
      statistics: {
        companies: companyCount,
        filings: filingCount,
        events: eventCount,
        xbrlFacts: factCount,
      },
      filingsByStatus: filingsByStatus.reduce((acc: Record<string, number>, item: FilingStatusCount) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<string, number>),
      recentRuns: recentRuns.map((run: PipelineRun) => ({
        id: run.id,
        runType: run.runType,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        filingsFound: run.filingsFound,
        filingsIngested: run.filingsIngested,
        filingsFailed: run.filingsFailed,
      })),
      recentFilings,
    })
  } catch (error) {
    console.error('Error fetching pipeline status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline status' },
      { status: 500 }
    )
  }
}
