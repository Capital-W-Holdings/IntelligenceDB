import * as cheerio from 'cheerio'

// 8-K Item definitions with event type classification
const ITEM_DEFINITIONS = [
  { pattern: /Item\s*1\.01/i, number: '1.01', title: 'Entry into Material Definitive Agreement', eventType: 'agreement' },
  { pattern: /Item\s*1\.02/i, number: '1.02', title: 'Termination of Material Definitive Agreement', eventType: 'agreement_termination' },
  { pattern: /Item\s*1\.03/i, number: '1.03', title: 'Bankruptcy or Receivership', eventType: 'bankruptcy' },
  { pattern: /Item\s*1\.04/i, number: '1.04', title: 'Mine Safety', eventType: 'mine_safety' },
  { pattern: /Item\s*2\.01/i, number: '2.01', title: 'Completion of Acquisition or Disposition', eventType: 'acquisition' },
  { pattern: /Item\s*2\.02/i, number: '2.02', title: 'Results of Operations and Financial Condition', eventType: 'earnings' },
  { pattern: /Item\s*2\.03/i, number: '2.03', title: 'Creation of Direct Financial Obligation', eventType: 'financing' },
  { pattern: /Item\s*2\.04/i, number: '2.04', title: 'Triggering Events That Accelerate Obligations', eventType: 'obligation' },
  { pattern: /Item\s*2\.05/i, number: '2.05', title: 'Costs Associated with Exit Activities', eventType: 'restructuring' },
  { pattern: /Item\s*2\.06/i, number: '2.06', title: 'Material Impairments', eventType: 'impairment' },
  { pattern: /Item\s*3\.01/i, number: '3.01', title: 'Notice of Delisting', eventType: 'delisting' },
  { pattern: /Item\s*3\.02/i, number: '3.02', title: 'Unregistered Sales of Equity Securities', eventType: 'equity_sale' },
  { pattern: /Item\s*3\.03/i, number: '3.03', title: 'Material Modification to Rights of Security Holders', eventType: 'rights_modification' },
  { pattern: /Item\s*4\.01/i, number: '4.01', title: 'Changes in Registrant\'s Certifying Accountant', eventType: 'auditor_change' },
  { pattern: /Item\s*4\.02/i, number: '4.02', title: 'Non-Reliance on Previously Issued Financial Statements', eventType: 'restatement' },
  { pattern: /Item\s*5\.01/i, number: '5.01', title: 'Changes in Control of Registrant', eventType: 'control_change' },
  { pattern: /Item\s*5\.02/i, number: '5.02', title: 'Departure/Appointment of Directors or Officers', eventType: 'executive_change' },
  { pattern: /Item\s*5\.03/i, number: '5.03', title: 'Amendments to Articles of Incorporation or Bylaws', eventType: 'bylaws' },
  { pattern: /Item\s*5\.04/i, number: '5.04', title: 'Temporary Suspension of Trading Under Employee Plans', eventType: 'trading_suspension' },
  { pattern: /Item\s*5\.05/i, number: '5.05', title: 'Amendment to Code of Ethics', eventType: 'ethics' },
  { pattern: /Item\s*5\.06/i, number: '5.06', title: 'Change in Shell Company Status', eventType: 'shell_status' },
  { pattern: /Item\s*5\.07/i, number: '5.07', title: 'Submission of Matters to Vote of Security Holders', eventType: 'shareholder_vote' },
  { pattern: /Item\s*5\.08/i, number: '5.08', title: 'Shareholder Director Nominations', eventType: 'nominations' },
  { pattern: /Item\s*6\.01/i, number: '6.01', title: 'ABS Informational and Computational Material', eventType: 'abs' },
  { pattern: /Item\s*6\.02/i, number: '6.02', title: 'Change of Servicer or Trustee', eventType: 'servicer_change' },
  { pattern: /Item\s*6\.03/i, number: '6.03', title: 'Change in Credit Enhancement', eventType: 'credit_enhancement' },
  { pattern: /Item\s*6\.04/i, number: '6.04', title: 'Failure to Make Distribution', eventType: 'distribution_failure' },
  { pattern: /Item\s*6\.05/i, number: '6.05', title: 'Securities Act Updating Disclosure', eventType: 'updating' },
  { pattern: /Item\s*7\.01/i, number: '7.01', title: 'Regulation FD Disclosure', eventType: 'reg_fd' },
  { pattern: /Item\s*8\.01/i, number: '8.01', title: 'Other Events', eventType: 'other' },
  { pattern: /Item\s*9\.01/i, number: '9.01', title: 'Financial Statements and Exhibits', eventType: 'exhibits' },
]

export interface EightKItem {
  itemNumber: string
  itemTitle: string
  eventType: string
  rawText: string
  startOffset: number
  endOffset: number
  summary?: string
}

export interface EightKParseResult {
  items: EightKItem[]
  exhibits: string[]
  fullText: string
}

/**
 * Strip HTML tags and normalize whitespace
 */
function stripHtml(html: string): string {
  const $ = cheerio.load(html)

  // Remove script and style elements
  $('script, style').remove()

  // Get text
  let text = $.text()

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  return text
}

/**
 * Parse 8-K filing HTML to extract items
 */
export function parseEightK(html: string): EightKParseResult {
  const text = stripHtml(html)
  const items: EightKItem[] = []
  const exhibits: string[] = []

  // Find all item positions
  const itemPositions: {
    definition: (typeof ITEM_DEFINITIONS)[0]
    position: number
    matchEnd: number
  }[] = []

  for (const definition of ITEM_DEFINITIONS) {
    let searchText = text
    let offset = 0

    while (true) {
      const match = definition.pattern.exec(searchText)
      if (!match || match.index === undefined) break

      const position = offset + match.index
      itemPositions.push({
        definition,
        position,
        matchEnd: position + match[0].length,
      })

      offset = position + match[0].length
      searchText = text.slice(offset)

      // Reset lastIndex for global patterns
      definition.pattern.lastIndex = 0
    }
  }

  // Sort by position in document
  itemPositions.sort((a, b) => a.position - b.position)

  // Remove duplicates (same item appearing multiple times)
  const seenItems = new Set<string>()
  const uniquePositions = itemPositions.filter((pos) => {
    if (seenItems.has(pos.definition.number)) {
      return false
    }
    seenItems.add(pos.definition.number)
    return true
  })

  // Extract text between items
  for (let i = 0; i < uniquePositions.length; i++) {
    const current = uniquePositions[i]
    const next = uniquePositions[i + 1]

    const startOffset = current.position
    // End at either next item or a reasonable limit (10000 chars) or end of text
    const endOffset = next ? Math.min(next.position, startOffset + 50000) : Math.min(text.length, startOffset + 50000)

    let rawText = text.slice(startOffset, endOffset).trim()

    // Try to find a more natural endpoint (signature section, exhibit section, etc.)
    const sigIndex = rawText.search(/SIGNATURE|PURSUANT TO THE REQUIREMENTS/i)
    if (sigIndex > 500 && !next) {
      rawText = rawText.slice(0, sigIndex).trim()
    }

    items.push({
      itemNumber: current.definition.number,
      itemTitle: current.definition.title,
      eventType: current.definition.eventType,
      rawText,
      startOffset,
      endOffset: startOffset + rawText.length,
    })
  }

  // Extract exhibit references
  const exhibitRegex = /Exhibit\s+(\d+(?:\.\d+)?)/gi
  let exhibitMatch
  while ((exhibitMatch = exhibitRegex.exec(text)) !== null) {
    if (!exhibits.includes(exhibitMatch[1])) {
      exhibits.push(exhibitMatch[1])
    }
  }

  return {
    items,
    exhibits,
    fullText: text,
  }
}

/**
 * Classify healthcare-specific 8-K events
 */
export function classifyHealthcareEvent(item: EightKItem): string | null {
  const text = item.rawText.toLowerCase()

  // FDA-related events
  if (text.includes('fda') || text.includes('food and drug administration')) {
    if (text.includes('approv')) return 'fda_approval'
    if (text.includes('clear')) return 'fda_clearance'
    if (text.includes('accept') && text.includes('file')) return 'fda_filing_accepted'
    if (text.includes('complete response letter') || text.includes('crl')) return 'fda_crl'
    if (text.includes('breakthrough')) return 'fda_breakthrough'
    if (text.includes('fast track')) return 'fda_fast_track'
    if (text.includes('priority review')) return 'fda_priority_review'
    if (text.includes('warning letter')) return 'fda_warning'
    return 'fda_other'
  }

  // Clinical trial events
  if (
    text.includes('clinical trial') ||
    text.includes('phase') ||
    text.includes('trial results') ||
    text.includes('study results')
  ) {
    if (text.includes('phase 3') || text.includes('phase iii')) return 'clinical_phase3'
    if (text.includes('phase 2') || text.includes('phase ii')) return 'clinical_phase2'
    if (text.includes('phase 1') || text.includes('phase i')) return 'clinical_phase1'
    if (text.includes('positive') || text.includes('met primary endpoint')) return 'clinical_positive'
    if (text.includes('negative') || text.includes('did not meet') || text.includes('failed')) return 'clinical_negative'
    return 'clinical_other'
  }

  // Drug/product events
  if (text.includes('launch') && (text.includes('drug') || text.includes('product') || text.includes('therapy'))) {
    return 'product_launch'
  }

  // Pricing/reimbursement
  if (text.includes('cms') || text.includes('medicare') || text.includes('medicaid') || text.includes('reimbursement')) {
    return 'reimbursement'
  }

  // Licensing/partnership
  if (text.includes('license agreement') || text.includes('collaboration') || text.includes('partnership')) {
    return 'licensing_partnership'
  }

  return null
}

/**
 * Generate a summary of an 8-K item for healthcare companies
 */
export function summarizeHealthcareEvent(item: EightKItem): string {
  const healthcareType = classifyHealthcareEvent(item)
  const baseType = item.eventType

  const text = item.rawText.slice(0, 2000) // First 2000 chars for summary

  if (healthcareType) {
    switch (healthcareType) {
      case 'fda_approval':
        return `FDA approval announcement - ${extractDrugName(text) || 'Product details in filing'}`
      case 'fda_clearance':
        return `FDA clearance received for medical device/diagnostic`
      case 'fda_crl':
        return `Complete Response Letter received from FDA - regulatory setback`
      case 'clinical_positive':
        return `Positive clinical trial results announced`
      case 'clinical_negative':
        return `Clinical trial did not meet endpoints`
      case 'product_launch':
        return `New product launch announced`
      case 'licensing_partnership':
        return `Strategic licensing or partnership agreement`
      default:
        break
    }
  }

  // Default summaries based on base event type
  switch (baseType) {
    case 'earnings':
      return `Financial results and operations update`
    case 'acquisition':
      return `Acquisition or disposition completed`
    case 'executive_change':
      return `Management or board change announced`
    case 'financing':
      return `New financing or debt arrangement`
    case 'agreement':
      return `Material agreement entered`
    default:
      return `${item.itemTitle}`
  }
}

/**
 * Try to extract drug/product name from text
 */
function extractDrugName(text: string): string | null {
  // Look for capitalized words followed by (R) or ® or common drug suffixes
  const drugPatterns = [
    /([A-Z][a-z]+(?:mab|nib|tinib|ciclib|zumab|ximab|lumab|umab))/,
    /([A-Z][a-z]+)(?:®|\(R\)|\™|\(TM\))/,
    /(?:product|drug|therapy|treatment)\s+(?:called\s+)?([A-Z][A-Za-z0-9-]+)/i,
  ]

  for (const pattern of drugPatterns) {
    const match = pattern.exec(text)
    if (match) return match[1]
  }

  return null
}
