import Bottleneck from 'bottleneck'
import { SECCompanySubmissions, SECCompanyFacts, HEALTHCARE_SIC_CODES, isHealthcareSIC } from './types'
import path from 'path'
import fs from 'fs/promises'

const SEC_DATA_URL = 'https://data.sec.gov'
const SEC_WWW_URL = 'https://www.sec.gov'
const SEC_ARCHIVES_URL = 'https://www.sec.gov/Archives'
const SEC_BROWSE_URL = 'https://www.sec.gov/cgi-bin/browse-edgar'

// Rate limiter: 10 requests per second max (100ms between requests)
const limiter = new Bottleneck({
  minTime: 100,
  maxConcurrent: 1,
})

export interface SECFiling {
  accessionNumber: string
  filingDate: string
  formType: string
  primaryDocument: string
}

export class SECClient {
  private userAgent: string
  private cacheDir: string

  constructor(userAgent?: string, cacheDir?: string) {
    this.userAgent = userAgent || process.env.SEC_USER_AGENT || 'HealthcareFilingsDB admin@example.com'
    this.cacheDir = cacheDir || path.join(process.cwd(), 'storage', 'filings')
  }

  private async fetch(url: string): Promise<Response> {
    return limiter.schedule(async () => {
      console.log(`[SEC] Fetching: ${url}`)
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Encoding': 'gzip, deflate',
          'Accept': 'application/json, text/html, */*',
        },
      })

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status} ${response.statusText} for ${url}`)
      }

      return response
    })
  }

  /**
   * Get company submissions data (filings list + company info)
   */
  async getCompanySubmissions(cik: string): Promise<SECCompanySubmissions> {
    const paddedCik = cik.padStart(10, '0')
    const url = `${SEC_DATA_URL}/submissions/CIK${paddedCik}.json`
    const response = await this.fetch(url)
    return response.json()
  }

  /**
   * Get XBRL company facts (structured financial data)
   */
  async getCompanyFacts(cik: string): Promise<SECCompanyFacts | null> {
    const paddedCik = cik.padStart(10, '0')
    const url = `${SEC_DATA_URL}/api/xbrl/companyfacts/CIK${paddedCik}.json`

    try {
      const response = await this.fetch(url)
      return response.json()
    } catch (error) {
      // Not all companies have XBRL facts
      console.log(`[SEC] No XBRL facts available for CIK ${cik}`)
      return null
    }
  }

  /**
   * Fetch a filing document (HTML/text) by URL or by components
   */
  async getFilingDocument(cik: string, accessionNumber: string, documentName: string): Promise<string>
  async getFilingDocument(url: string): Promise<string>
  async getFilingDocument(cikOrUrl: string, accessionNumber?: string, documentName?: string): Promise<string> {
    let url: string
    if (accessionNumber && documentName) {
      url = this.getFilingUrl(cikOrUrl, accessionNumber, documentName)
    } else {
      url = cikOrUrl
    }
    const response = await this.fetch(url)
    return response.text()
  }

  /**
   * Download and cache a filing document locally
   */
  async downloadFiling(
    cik: string,
    accessionNumber: string,
    documentName: string
  ): Promise<string> {
    const accessionNoDash = accessionNumber.replace(/-/g, '')
    const url = `${SEC_ARCHIVES_URL}/edgar/data/${cik}/${accessionNoDash}/${documentName}`

    // Create cache path
    const cachePath = path.join(this.cacheDir, cik, accessionNumber, documentName)
    const cacheDir = path.dirname(cachePath)

    // Check if already cached
    try {
      await fs.access(cachePath)
      console.log(`[SEC] Using cached filing: ${cachePath}`)
      return cachePath
    } catch {
      // Not cached, proceed to download
    }

    // Download
    const content = await this.getFilingDocument(url)

    // Cache
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(cachePath, content, 'utf-8')
    console.log(`[SEC] Cached filing to: ${cachePath}`)

    return cachePath
  }

  /**
   * Read a cached filing from disk
   */
  async readCachedFiling(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
  }

  /**
   * Search for healthcare companies by SIC code
   */
  async searchHealthcareCompanies(limit: number = 100): Promise<SECCompanySubmissions[]> {
    const companies: SECCompanySubmissions[] = []
    const sicCodes = Object.keys(HEALTHCARE_SIC_CODES)

    for (const sic of sicCodes) {
      if (companies.length >= limit) break

      try {
        // The SEC doesn't have a direct SIC search API, so we'll need to use company tickers
        // For a real implementation, you'd maintain a mapping of healthcare CIKs
        console.log(`[SEC] Searching SIC code: ${sic}`)
      } catch (error) {
        console.error(`[SEC] Error searching SIC ${sic}:`, error)
      }
    }

    return companies
  }

  /**
   * Get recent filings for a form type
   */
  async getRecentFilings(formType: string = '8-K', count: number = 100): Promise<{
    cik: string
    accessionNumber: string
    formType: string
    filingDate: string
  }[]> {
    // Use the EDGAR RSS/Atom feed
    const url = `${SEC_BROWSE_URL}?action=getcurrent&type=${formType}&company=&dateb=&owner=include&count=${count}&output=atom`

    const response = await this.fetch(url)
    const text = await response.text()

    // Parse Atom feed
    const entries: {
      cik: string
      accessionNumber: string
      formType: string
      filingDate: string
    }[] = []

    // Simple regex parsing of the Atom feed
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    const titleRegex = /<title[^>]*>([^<]+)<\/title>/
    const linkRegex = /<link[^>]*href="([^"]+)"/
    const updatedRegex = /<updated>([^<]+)<\/updated>/

    let match
    while ((match = entryRegex.exec(text)) !== null) {
      const entry = match[1]
      const titleMatch = titleRegex.exec(entry)
      const linkMatch = linkRegex.exec(entry)
      const updatedMatch = updatedRegex.exec(entry)

      if (titleMatch && linkMatch && updatedMatch) {
        // Parse CIK and accession from the link
        const linkUrl = linkMatch[1]
        const cikMatch = /\/data\/(\d+)\//.exec(linkUrl)
        const accessionMatch = /\/(\d{10}-\d{2}-\d{6})/.exec(linkUrl)

        if (cikMatch && accessionMatch) {
          entries.push({
            cik: cikMatch[1],
            accessionNumber: accessionMatch[1],
            formType: formType,
            filingDate: updatedMatch[1].split('T')[0],
          })
        }
      }
    }

    return entries
  }

  /**
   * Build filing document URL
   */
  buildFilingUrl(cik: string, accessionNumber: string, documentName: string): string {
    const accessionNoDash = accessionNumber.replace(/-/g, '')
    return `${SEC_ARCHIVES_URL}/edgar/data/${cik}/${accessionNoDash}/${documentName}`
  }

  /**
   * Build filing index URL
   */
  buildFilingIndexUrl(cik: string, accessionNumber: string): string {
    const accessionNoDash = accessionNumber.replace(/-/g, '')
    return `${SEC_ARCHIVES_URL}/edgar/data/${cik}/${accessionNoDash}/${accessionNumber}-index.htm`
  }

  /**
   * Get list of all company tickers from SEC
   */
  async getCompanyTickers(): Promise<Record<string, { cik_str: number; ticker: string; title: string }>> {
    const url = `${SEC_WWW_URL}/files/company_tickers.json`
    const response = await this.fetch(url)
    return response.json()
  }

  /**
   * Get filing URL for direct access
   */
  getFilingUrl(cik: string, accessionNumber: string, documentName?: string): string {
    const paddedCik = cik.replace(/^0+/, '')
    const accessionNoDash = accessionNumber.replace(/-/g, '')
    if (documentName) {
      return `${SEC_ARCHIVES_URL}/edgar/data/${paddedCik}/${accessionNoDash}/${documentName}`
    }
    return `${SEC_ARCHIVES_URL}/edgar/data/${paddedCik}/${accessionNoDash}/${accessionNumber}-index.htm`
  }

  /**
   * Get XBRL document content
   */
  async getXBRLDocument(cik: string, accessionNumber: string): Promise<string | null> {
    try {
      // Try to find XBRL file in the filing index
      const paddedCik = cik.replace(/^0+/, '')
      const accessionNoDash = accessionNumber.replace(/-/g, '')
      const indexUrl = `${SEC_ARCHIVES_URL}/edgar/data/${paddedCik}/${accessionNoDash}/`

      const response = await this.fetch(indexUrl)
      const html = await response.text()

      // Look for XBRL file (usually ends with .xml or _htm.xml)
      const xbrlMatch = html.match(/href="([^"]+(?:_htm\.xml|\.xml))"/i)
      if (xbrlMatch) {
        const xbrlUrl = `${indexUrl}${xbrlMatch[1]}`
        const xbrlResponse = await this.fetch(xbrlUrl)
        return xbrlResponse.text()
      }

      return null
    } catch {
      return null
    }
  }
}

// Export singleton instance
export const secClient = new SECClient()
