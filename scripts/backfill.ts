#!/usr/bin/env npx tsx
/**
 * Backfill script for Healthcare Filings Database
 *
 * This script populates the database with historical SEC filings
 * from healthcare companies.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts [options]
 *
 * Options:
 *   --companies <n>    Max number of companies to process (default: 50)
 *   --filings <n>      Max filings per company (default: 20)
 *   --forms <types>    Comma-separated form types (default: 8-K,10-K)
 *   --from <date>      Only process filings after this date (YYYY-MM-DD)
 *   --force            Process even if filing already exists
 *   --dry-run          Show what would be processed without making changes
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { IngestionPipeline } from '../src/lib/ingestion/pipeline'

interface BackfillOptions {
  maxCompanies: number
  maxFilingsPerCompany: number
  formTypes: string[]
  fromDate?: Date
  skipExisting: boolean
  dryRun: boolean
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2)
  const options: BackfillOptions = {
    maxCompanies: 50,
    maxFilingsPerCompany: 20,
    formTypes: ['8-K', '10-K'],
    skipExisting: true,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--companies':
        options.maxCompanies = parseInt(args[++i])
        break
      case '--filings':
        options.maxFilingsPerCompany = parseInt(args[++i])
        break
      case '--forms':
        options.formTypes = args[++i].split(',')
        break
      case '--from':
        options.fromDate = new Date(args[++i])
        break
      case '--force':
        options.skipExisting = false
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--help':
        printHelp()
        process.exit(0)
    }
  }

  return options
}

function printHelp(): void {
  console.log(`
Healthcare Filings Database - Backfill Script

Usage:
  npx tsx scripts/backfill.ts [options]

Options:
  --companies <n>    Max number of companies to process (default: 50)
  --filings <n>      Max filings per company (default: 20)
  --forms <types>    Comma-separated form types (default: 8-K,10-K)
  --from <date>      Only process filings after this date (YYYY-MM-DD)
  --force            Process even if filing already exists
  --dry-run          Show what would be processed without making changes
  --help             Show this help message

Examples:
  # Process 100 companies with their last 50 filings
  npx tsx scripts/backfill.ts --companies 100 --filings 50

  # Only process 8-K filings from 2024
  npx tsx scripts/backfill.ts --forms 8-K --from 2024-01-01

  # Reprocess all filings (including existing)
  npx tsx scripts/backfill.ts --force
`)
}

async function main(): Promise<void> {
  const options = parseArgs()

  console.log('=' .repeat(60))
  console.log('Healthcare Filings Database - Backfill')
  console.log('=' .repeat(60))
  console.log('')
  console.log('Configuration:')
  console.log(`  Max Companies:        ${options.maxCompanies}`)
  console.log(`  Max Filings/Company:  ${options.maxFilingsPerCompany}`)
  console.log(`  Form Types:           ${options.formTypes.join(', ')}`)
  console.log(`  From Date:            ${options.fromDate?.toISOString().split('T')[0] || 'All time'}`)
  console.log(`  Skip Existing:        ${options.skipExisting}`)
  console.log(`  Dry Run:              ${options.dryRun}`)
  console.log('')

  if (options.dryRun) {
    console.log('DRY RUN MODE - No changes will be made')
    console.log('')
  }

  // Check database connection
  try {
    await prisma.$connect()
    console.log('✓ Database connection successful')
  } catch (error) {
    console.error('✗ Failed to connect to database:', error)
    process.exit(1)
  }

  // Get current counts
  const companiesBefore = await prisma.company.count()
  const filingsBefore = await prisma.filing.count()
  const eventsBefore = await prisma.filingEvent.count()
  const xbrlFactsBefore = await prisma.xBRLFact.count()

  console.log('')
  console.log('Current database state:')
  console.log(`  Companies:    ${companiesBefore}`)
  console.log(`  Filings:      ${filingsBefore}`)
  console.log(`  Events:       ${eventsBefore}`)
  console.log(`  XBRL Facts:   ${xbrlFactsBefore}`)
  console.log('')

  if (options.dryRun) {
    console.log('Dry run complete. Use without --dry-run to execute.')
    await prisma.$disconnect()
    return
  }

  // Run ingestion pipeline
  console.log('Starting ingestion...')
  console.log('-'.repeat(60))

  const startTime = Date.now()
  const pipeline = new IngestionPipeline({
    maxCompanies: options.maxCompanies,
    maxFilingsPerCompany: options.maxFilingsPerCompany,
    formTypes: options.formTypes,
    fromDate: options.fromDate,
    skipExisting: options.skipExisting,
  })
  const results = await pipeline.run()

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  // Get final counts
  const companiesAfter = await prisma.company.count()
  const filingsAfter = await prisma.filing.count()
  const eventsAfter = await prisma.filingEvent.count()
  const xbrlFactsAfter = await prisma.xBRLFact.count()

  console.log('')
  console.log('-'.repeat(60))
  console.log('Backfill Complete!')
  console.log('-'.repeat(60))
  console.log('')
  console.log('Results:')
  console.log(`  Duration:           ${duration}s`)
  console.log(`  Companies Added:    ${companiesAfter - companiesBefore}`)
  console.log(`  Filings Added:      ${filingsAfter - filingsBefore}`)
  console.log(`  Events Added:       ${eventsAfter - eventsBefore}`)
  console.log(`  XBRL Facts Added:   ${xbrlFactsAfter - xbrlFactsBefore}`)
  console.log('')
  console.log('Final database state:')
  console.log(`  Companies:    ${companiesAfter}`)
  console.log(`  Filings:      ${filingsAfter}`)
  console.log(`  Events:       ${eventsAfter}`)
  console.log(`  XBRL Facts:   ${xbrlFactsAfter}`)

  if (results.errors.length > 0) {
    console.log('')
    console.log(`Errors (${results.errors.length}):`)
    results.errors.slice(0, 10).forEach((err) => {
      console.log(`  - ${err}`)
    })
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more`)
    }
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
