import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECClient } from '@/lib/sec/client'
import {
  analyzeInsiderTrading,
  InsiderTransaction,
  getTransactionTypeLabel,
  isTransactionBuy,
  isTransactionSell,
} from '@/lib/intelligence/insider-trading'

interface SECForm4Data {
  issuer?: {
    cik: string
    name: string
    tradingSymbol?: string
  }
  reportingOwner?: Array<{
    cik?: string
    name: string
    relationship?: {
      isDirector?: boolean
      isOfficer?: boolean
      isTenPercentOwner?: boolean
      isOther?: boolean
      officerTitle?: string
    }
  }>
  nonDerivativeTable?: {
    nonDerivativeTransaction?: Array<{
      securityTitle?: { value: string }
      transactionDate?: { value: string }
      transactionCoding?: { transactionCode: string }
      transactionAmounts?: {
        transactionShares?: { value: number }
        transactionPricePerShare?: { value: number }
        transactionAcquiredDisposedCode?: { value: 'A' | 'D' }
      }
      postTransactionAmounts?: {
        sharesOwnedFollowingTransaction?: { value: number }
      }
    }>
  }
}

/**
 * Parse Form 4 XML content to extract transaction data
 */
function parseForm4Xml(xml: string, accessionNumber: string, filingDate: Date): InsiderTransaction[] {
  const transactions: InsiderTransaction[] = []

  try {
    // Extract owner information
    const ownerMatch = xml.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/i)
    const ownerName = ownerMatch ? ownerMatch[1].trim() : 'Unknown'

    const titleMatch = xml.match(/<officerTitle>([^<]+)<\/officerTitle>/i)
    const ownerTitle = titleMatch ? titleMatch[1].trim() : undefined

    const ownerCikMatch = xml.match(/<rptOwnerCik>(\d+)<\/rptOwnerCik>/i)
    const ownerCik = ownerCikMatch ? ownerCikMatch[1] : undefined

    // Check if director, officer, or 10% owner
    const isDirector = /<isDirector>(?:true|1)<\/isDirector>/i.test(xml)
    const isOfficer = /<isOfficer>(?:true|1)<\/isOfficer>/i.test(xml)
    const isTenPercent = /<isTenPercentOwner>(?:true|1)<\/isTenPercentOwner>/i.test(xml)

    // Build title if not explicitly provided
    let title = ownerTitle
    if (!title) {
      const titles: string[] = []
      if (isDirector) titles.push('Director')
      if (isOfficer) titles.push('Officer')
      if (isTenPercent) titles.push('10% Owner')
      title = titles.join(', ') || undefined
    }

    // Extract non-derivative transactions
    const txPattern = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi
    let txMatch

    while ((txMatch = txPattern.exec(xml)) !== null) {
      const txXml = txMatch[1]

      // Extract transaction date
      const dateMatch = txXml.match(/<transactionDate>\s*<value>([^<]+)<\/value>/i)
      const txDateStr = dateMatch ? dateMatch[1].trim() : null
      if (!txDateStr) continue

      const txDate = new Date(txDateStr)
      if (isNaN(txDate.getTime())) continue

      // Extract transaction code (P=Purchase, S=Sale, etc.)
      const codeMatch = txXml.match(/<transactionCode>([A-Z])<\/transactionCode>/i)
      const txCode = codeMatch ? codeMatch[1] : 'U'

      // Extract shares
      const sharesMatch = txXml.match(/<transactionShares>\s*<value>([^<]+)<\/value>/i)
      const shares = sharesMatch ? parseFloat(sharesMatch[1]) : 0
      if (shares <= 0) continue

      // Extract price per share
      const priceMatch = txXml.match(/<transactionPricePerShare>\s*<value>([^<]+)<\/value>/i)
      const price = priceMatch ? parseFloat(priceMatch[1]) : undefined

      // Extract acquired/disposed code
      const adMatch = txXml.match(/<transactionAcquiredDisposedCode>\s*<value>([AD])<\/value>/i)
      const acquiredDisposed = adMatch ? adMatch[1] : 'A'

      // Map to our transaction type
      let transactionType: InsiderTransaction['transactionType']
      if (txCode === 'P') transactionType = 'P'
      else if (txCode === 'S') transactionType = 'S'
      else if (txCode === 'A') transactionType = 'A'
      else if (txCode === 'M') transactionType = 'M'
      else if (txCode === 'G') transactionType = 'G'
      else if (txCode === 'C') transactionType = 'C'
      else if (txCode === 'F') transactionType = 'F'
      else if (acquiredDisposed === 'D') transactionType = 'D'
      else transactionType = 'A'

      // Extract shares owned after
      const afterMatch = txXml.match(/<sharesOwnedFollowingTransaction>\s*<value>([^<]+)<\/value>/i)
      const sharesAfter = afterMatch ? parseFloat(afterMatch[1]) : undefined

      transactions.push({
        insiderName: ownerName,
        insiderTitle: title,
        insiderCik: ownerCik,
        transactionType,
        transactionCode: txCode,
        shares,
        pricePerShare: price,
        totalValue: price ? shares * price : undefined,
        sharesOwnedAfter: sharesAfter,
        transactionDate: txDate,
        filingDate,
        accessionNumber,
      })
    }
  } catch (error) {
    console.error('Error parsing Form 4 XML:', error)
  }

  return transactions
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params

    // Get company
    const company = await prisma.company.findUnique({
      where: { cik },
      select: {
        id: true,
        cik: true,
        name: true,
        ticker: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const secClient = new SECClient()
    const allTransactions: InsiderTransaction[] = []

    // Check for cached transactions first
    const cachedTransactions = await prisma.insiderTransaction.findMany({
      where: { companyId: company.id },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    })

    if (cachedTransactions.length > 0) {
      // Use cached data
      for (const tx of cachedTransactions) {
        allTransactions.push({
          insiderName: tx.insiderName,
          insiderTitle: tx.insiderTitle || undefined,
          insiderCik: tx.insiderCik || undefined,
          transactionType: tx.transactionType as InsiderTransaction['transactionType'],
          transactionCode: tx.transactionCode || undefined,
          shares: tx.shares,
          pricePerShare: tx.pricePerShare || undefined,
          totalValue: tx.totalValue || undefined,
          sharesOwnedAfter: tx.sharesOwnedAfter || undefined,
          transactionDate: tx.transactionDate,
          filingDate: tx.filingDate,
          accessionNumber: tx.accessionNumber,
          sourceUrl: tx.sourceUrl || undefined,
        })
      }
    } else {
      // Fetch from SEC
      try {
        const submissions = await secClient.getCompanySubmissions(cik)

        // Find Form 4 filings
        const filings = submissions.filings?.recent
        if (filings) {
          const form4Indices: number[] = []
          for (let i = 0; i < (filings.form?.length || 0) && form4Indices.length < 50; i++) {
            if (filings.form?.[i] === '4' || filings.form?.[i] === '4/A') {
              form4Indices.push(i)
            }
          }

          // Fetch and parse each Form 4
          for (const idx of form4Indices.slice(0, 20)) { // Limit to 20 for performance
            const accession = filings.accessionNumber?.[idx]
            const filingDateStr = filings.filingDate?.[idx]
            const primaryDoc = filings.primaryDocument?.[idx]

            if (!accession || !filingDateStr || !primaryDoc) continue

            try {
              const cikNum = cik.replace(/^0+/, '')
              const xml = await secClient.getFilingDocument(cikNum, accession, primaryDoc)
              const filingDate = new Date(filingDateStr)

              const txs = parseForm4Xml(xml, accession, filingDate)
              allTransactions.push(...txs)
            } catch (error) {
              console.error(`Error fetching Form 4 ${accession}:`, error)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching SEC submissions:', error)
      }
    }

    // Perform analysis
    const analysis = analyzeInsiderTrading(allTransactions, {
      name: company.name,
      ticker: company.ticker || undefined,
    })

    // Format response
    return NextResponse.json({
      company: {
        cik: company.cik,
        name: company.name,
        ticker: company.ticker,
      },
      analysis: {
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        sentimentExplanation: analysis.sentimentExplanation,
        alerts: analysis.alerts.slice(0, 10),
        clusterActivity: analysis.clusterActivity.slice(0, 5),
        trends: analysis.trends,
      },
      insiders: analysis.insiders.slice(0, 15).map(insider => ({
        name: insider.name,
        title: insider.title,
        totalTransactions: insider.totalTransactions,
        totalBuys: insider.totalBuys,
        totalSells: insider.totalSells,
        netShares: insider.netShares,
        netValue: insider.netValue,
        currentHoldings: insider.currentHoldings,
        lastTransactionDate: insider.lastTransactionDate,
      })),
      recentTransactions: analysis.recentTransactions.slice(0, 30).map(tx => ({
        insiderName: tx.insiderName,
        insiderTitle: tx.insiderTitle,
        transactionType: tx.transactionType,
        transactionTypeLabel: getTransactionTypeLabel(tx.transactionType),
        isBuy: isTransactionBuy(tx.transactionType),
        isSell: isTransactionSell(tx.transactionType),
        shares: tx.shares,
        pricePerShare: tx.pricePerShare,
        totalValue: tx.totalValue,
        sharesOwnedAfter: tx.sharesOwnedAfter,
        transactionDate: tx.transactionDate,
        filingDate: tx.filingDate,
        accessionNumber: tx.accessionNumber,
      })),
    })
  } catch (error) {
    console.error('Error analyzing insider trading:', error)
    return NextResponse.json(
      { error: 'Failed to analyze insider trading' },
      { status: 500 }
    )
  }
}
