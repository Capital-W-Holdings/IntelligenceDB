import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import { parseEightK } from '@/lib/parser/eight-k-parser'
import { extractSections } from '@/lib/parser/section-extractor'
import { parseXBRLFacts } from '@/lib/parser/xbrl-parser'

// Healthcare SIC codes
const HEALTHCARE_SIC_CODES = [
  // Pharma/Biotech
  '2833', '2834', '2835', '2836',
  // Medical Devices
  '3841', '3842', '3843', '3844', '3845',
  // Healthcare Services
  '8000', '8011', '8021', '8031', '8041', '8042', '8043', '8049',
  '8050', '8051', '8052', '8059', '8060', '8062', '8063', '8069',
  '8071', '8072', '8082', '8090', '8092', '8093', '8099',
  // Health Insurance
  '6320', '6321', '6324', '6330', '6331',
]

export interface IngestionResult {
  companiesProcessed: number
  filingsFound: number
  filingsIngested: number
  filingsFailed: number
  eventsExtracted: number
  xbrlFactsExtracted: number
  errors: string[]
}

export interface IngestionOptions {
  maxCompanies?: number
  maxFilingsPerCompany?: number
  formTypes?: string[]
  fromDate?: Date
  skipExisting?: boolean
}

interface SECFiling {
  accessionNumber: string
  filingDate: string
  formType: string
  primaryDocument: string
}

export class IngestionPipeline {
  private secClient: SECClient
  private options: Required<IngestionOptions>
  private results: IngestionResult

  constructor(options: IngestionOptions = {}) {
    this.secClient = new SECClient()
    this.options = {
      maxCompanies: options.maxCompanies ?? 100,
      maxFilingsPerCompany: options.maxFilingsPerCompany ?? 20,
      formTypes: options.formTypes ?? ['8-K', '10-K', '10-Q'],
      fromDate: options.fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      skipExisting: options.skipExisting ?? true,
    }
    this.results = {
      companiesProcessed: 0,
      filingsFound: 0,
      filingsIngested: 0,
      filingsFailed: 0,
      eventsExtracted: 0,
      xbrlFactsExtracted: 0,
      errors: [],
    }
  }

  async run(): Promise<IngestionResult> {
    console.log('Starting ingestion pipeline...')
    console.log(`Options: maxCompanies=${this.options.maxCompanies}, formTypes=${this.options.formTypes.join(',')}`)

    // Get list of healthcare companies from SEC
    const companies = await this.getHealthcareCompanies()
    console.log(`Found ${companies.length} healthcare companies`)

    for (const company of companies) {
      try {
        await this.processCompany(company)
        this.results.companiesProcessed++
      } catch (error) {
        const message = `Error processing company ${company.cik}: ${error}`
        console.error(message)
        this.results.errors.push(message)
      }
    }

    console.log('Ingestion complete!')
    console.log(`Companies: ${this.results.companiesProcessed}`)
    console.log(`Filings Found: ${this.results.filingsFound}`)
    console.log(`Filings Ingested: ${this.results.filingsIngested}`)
    console.log(`Filings Failed: ${this.results.filingsFailed}`)
    console.log(`Events: ${this.results.eventsExtracted}`)
    console.log(`XBRL Facts: ${this.results.xbrlFactsExtracted}`)
    console.log(`Errors: ${this.results.errors.length}`)

    return this.results
  }

  private async getHealthcareCompanies(): Promise<Array<{
    cik: string
    name: string
    ticker: string | null
    sicCode: string
    sicDescription: string
  }>> {
    const tickers = await this.secClient.getCompanyTickers()

    const healthcareCompanies: Array<{
      cik: string
      name: string
      ticker: string | null
      sicCode: string
      sicDescription: string
    }> = []

    for (const entry of Object.values(tickers)) {
      if (healthcareCompanies.length >= this.options.maxCompanies) break

      try {
        const cik = String(entry.cik_str).padStart(10, '0')
        const submissions = await this.secClient.getCompanySubmissions(cik)

        if (submissions && HEALTHCARE_SIC_CODES.includes(submissions.sic || '')) {
          healthcareCompanies.push({
            cik,
            name: submissions.name,
            ticker: entry.ticker || null,
            sicCode: submissions.sic || '',
            sicDescription: submissions.sicDescription || '',
          })
        }
      } catch {
        // Skip companies where we can't get SIC code
      }
    }

    return healthcareCompanies
  }

  private async processCompany(company: {
    cik: string
    name: string
    ticker: string | null
    sicCode: string
    sicDescription: string
  }): Promise<void> {
    console.log(`Processing company: ${company.name} (${company.cik})`)

    // Upsert company record
    const sector = this.getSectorFromSIC(company.sicCode)
    const dbCompany = await prisma.company.upsert({
      where: { cik: company.cik },
      update: {
        name: company.name,
        ticker: company.ticker,
        sicCode: company.sicCode,
        sicDescription: company.sicDescription,
        sector,
      },
      create: {
        cik: company.cik,
        name: company.name,
        ticker: company.ticker,
        sicCode: company.sicCode,
        sicDescription: company.sicDescription,
        sector,
      },
    })

    // Get recent filings
    const submissions = await this.secClient.getCompanySubmissions(company.cik)
    if (!submissions?.filings?.recent) return

    const filings = this.extractFilings(submissions.filings.recent)
      .filter((f) => this.options.formTypes.includes(f.formType))
      .filter((f) => new Date(f.filingDate) >= this.options.fromDate)
      .slice(0, this.options.maxFilingsPerCompany)

    this.results.filingsFound += filings.length

    for (const filing of filings) {
      try {
        await this.processFiling(dbCompany.id, company.cik, filing)
        this.results.filingsIngested++
      } catch (error) {
        const message = `Error processing filing ${filing.accessionNumber}: ${error}`
        console.error(message)
        this.results.errors.push(message)
        this.results.filingsFailed++
      }
    }

    // Update company's last filing date
    if (filings.length > 0) {
      const latestDate = filings
        .map(f => new Date(f.filingDate))
        .sort((a, b) => b.getTime() - a.getTime())[0]

      await prisma.company.update({
        where: { id: dbCompany.id },
        data: { lastFilingDate: latestDate },
      })
    }
  }

  private extractFilings(recent: {
    accessionNumber: string[]
    filingDate: string[]
    form: string[]
    primaryDocument: string[]
  }): SECFiling[] {
    const filings: SECFiling[] = []
    const count = recent.accessionNumber.length

    for (let i = 0; i < count; i++) {
      filings.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        formType: recent.form[i],
        primaryDocument: recent.primaryDocument[i],
      })
    }

    return filings
  }

  private async processFiling(
    companyId: string,
    cik: string,
    filing: SECFiling
  ): Promise<void> {
    // Check if filing already exists
    if (this.options.skipExisting) {
      const existing = await prisma.filing.findUnique({
        where: { accessionNumber: filing.accessionNumber },
      })
      if (existing) {
        console.log(`  Skipping existing filing: ${filing.accessionNumber}`)
        return
      }
    }

    console.log(`  Processing filing: ${filing.formType} ${filing.accessionNumber}`)

    const accessionClean = filing.accessionNumber.replace(/-/g, '')
    const primaryDocUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionClean}/${filing.primaryDocument}`
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionClean}/index.json`

    // Create filing record
    const dbFiling = await prisma.filing.upsert({
      where: { accessionNumber: filing.accessionNumber },
      update: {
        formType: filing.formType,
        filingDate: new Date(filing.filingDate),
        primaryDocUrl,
        indexUrl,
        status: 'ingested',
      },
      create: {
        companyId,
        accessionNumber: filing.accessionNumber,
        formType: filing.formType,
        filingDate: new Date(filing.filingDate),
        primaryDocUrl,
        indexUrl,
        status: 'ingested',
      },
    })

    // Fetch and parse filing content
    try {
      const content = await this.secClient.getFilingDocument(primaryDocUrl)

      if (filing.formType === '8-K') {
        const parsed = parseEightK(content)

        // Store events
        for (const event of parsed.items) {
          await prisma.filingEvent.create({
            data: {
              filingId: dbFiling.id,
              itemNumber: event.itemNumber,
              itemTitle: event.itemTitle,
              eventType: event.eventType,
              rawText: event.rawText,
              summary: event.rawText.substring(0, 500),
            },
          })
          this.results.eventsExtracted++
        }
      } else if (filing.formType === '10-K' || filing.formType === '10-Q') {
        const result = extractSections(content)

        // Store sections
        for (const section of result.sections) {
          await prisma.filingSection.create({
            data: {
              filingId: dbFiling.id,
              sectionType: section.sectionType,
              sectionTitle: section.sectionTitle,
              rawText: section.rawText,
              wordCount: section.wordCount,
              startOffset: section.startOffset,
              endOffset: section.endOffset,
            },
          })
        }
      }

      // Update filing status
      await prisma.filing.update({
        where: { id: dbFiling.id },
        data: { status: 'parsed', processedAt: new Date() },
      })
    } catch (error) {
      console.error(`    Error parsing filing content: ${error}`)
      await prisma.filing.update({
        where: { id: dbFiling.id },
        data: { status: 'failed' },
      })
    }

    // Try to fetch and parse XBRL facts from company facts API
    try {
      const companyFacts = await this.secClient.getCompanyFacts(cik)
      if (companyFacts) {
        const xbrlFacts = parseXBRLFacts(companyFacts)

        // Filter facts to those relevant to this filing's period
        const filingDate = new Date(filing.filingDate)
        const relevantFacts = xbrlFacts.filter(fact => {
          if (!fact.periodEnd) return false
          const factDate = new Date(fact.periodEnd)
          // Facts within 90 days before filing date are likely relevant
          const daysDiff = (filingDate.getTime() - factDate.getTime()) / (1000 * 60 * 60 * 24)
          return daysDiff >= 0 && daysDiff <= 90
        }).slice(0, 500)

        // Store XBRL facts
        for (const fact of relevantFacts) {
          await prisma.xBRLFact.create({
            data: {
              filingId: dbFiling.id,
              taxonomy: fact.taxonomy,
              tag: fact.originalTag,
              label: fact.standardLabel,
              value: String(fact.value),
              datatype: 'monetary', // Most financial facts are monetary
              unit: fact.unit,
              periodType: fact.periodType,
              periodStart: fact.periodStart ? new Date(fact.periodStart) : null,
              periodEnd: fact.periodEnd ? new Date(fact.periodEnd) : null,
            },
          })
          this.results.xbrlFactsExtracted++
        }

        // Update filing status
        await prisma.filing.update({
          where: { id: dbFiling.id },
          data: { status: 'extracted' },
        })
      }
    } catch (error) {
      console.error(`    Error parsing XBRL: ${error}`)
    }
  }

  private getSectorFromSIC(sicCode: string): string | null {
    const sic = parseInt(sicCode)

    if (sic >= 2833 && sic <= 2836) return 'Biotech/Pharma'
    if (sic >= 3841 && sic <= 3845) return 'Medical Devices'
    if (sic >= 8000 && sic <= 8099) return 'Healthcare Services'
    if (sic >= 6320 && sic <= 6331) return 'Payers'

    return null
  }
}

export async function runIngestionPipeline(options?: IngestionOptions): Promise<IngestionResult> {
  const pipeline = new IngestionPipeline(options)
  return pipeline.run()
}
