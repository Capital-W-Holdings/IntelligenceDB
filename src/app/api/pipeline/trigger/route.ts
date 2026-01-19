import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { IngestionPipeline } from '@/lib/ingestion/pipeline'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      runType = 'manual',
      maxCompanies = 10,
      maxFilingsPerCompany = 5,
      formTypes = ['8-K', '10-K'],
      skipExisting = true,
    } = body

    // Check if there's already a running pipeline
    const runningPipeline = await prisma.pipelineRun.findFirst({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' },
    })

    if (runningPipeline) {
      return NextResponse.json(
        {
          error: 'Pipeline already running',
          runId: runningPipeline.id,
          startedAt: runningPipeline.startedAt,
        },
        { status: 409 }
      )
    }

    // Create a new pipeline run record
    const pipelineRun = await prisma.pipelineRun.create({
      data: {
        runType,
        status: 'running',
      },
    })

    // Start the pipeline in the background
    // Note: In production, this would be handled by a worker/queue
    runPipelineAsync(pipelineRun.id, {
      maxCompanies,
      maxFilingsPerCompany,
      formTypes,
      skipExisting,
    })

    return NextResponse.json({
      success: true,
      runId: pipelineRun.id,
      message: 'Pipeline started',
      config: {
        runType,
        maxCompanies,
        maxFilingsPerCompany,
        formTypes,
        skipExisting,
      },
    })
  } catch (error) {
    console.error('Error triggering pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to trigger pipeline' },
      { status: 500 }
    )
  }
}

async function runPipelineAsync(
  runId: string,
  options: {
    maxCompanies: number
    maxFilingsPerCompany: number
    formTypes: string[]
    skipExisting: boolean
  }
) {
  const pipeline = new IngestionPipeline({
    maxCompanies: options.maxCompanies,
    maxFilingsPerCompany: options.maxFilingsPerCompany,
    formTypes: options.formTypes,
    skipExisting: options.skipExisting,
  })

  try {
    const result = await pipeline.run()

    await prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        filingsFound: result.filingsFound,
        filingsIngested: result.filingsIngested,
        filingsFailed: result.filingsFailed,
      },
    })
  } catch (error) {
    console.error('Pipeline run failed:', error)
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorLog: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}
