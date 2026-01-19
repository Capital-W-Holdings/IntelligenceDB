import * as cheerio from 'cheerio'

// 10-K Section definitions
const SECTION_DEFINITIONS = [
  {
    type: 'item1',
    title: 'Business',
    patterns: [/Item\s*1\.?\s*[-–—]?\s*Business/i, /Item\s*1\.\s*Business/i, /ITEM\s*1[\.\s]+BUSINESS/i],
  },
  {
    type: 'item1a',
    title: 'Risk Factors',
    patterns: [/Item\s*1A\.?\s*[-–—]?\s*Risk\s*Factors/i, /ITEM\s*1A[\.\s]+RISK\s*FACTORS/i],
  },
  {
    type: 'item1b',
    title: 'Unresolved Staff Comments',
    patterns: [/Item\s*1B\.?\s*[-–—]?\s*Unresolved\s*Staff\s*Comments/i],
  },
  {
    type: 'item2',
    title: 'Properties',
    patterns: [/Item\s*2\.?\s*[-–—]?\s*Properties/i, /ITEM\s*2[\.\s]+PROPERTIES/i],
  },
  {
    type: 'item3',
    title: 'Legal Proceedings',
    patterns: [/Item\s*3\.?\s*[-–—]?\s*Legal\s*Proceedings/i],
  },
  {
    type: 'item4',
    title: 'Mine Safety Disclosures',
    patterns: [/Item\s*4\.?\s*[-–—]?\s*Mine\s*Safety/i],
  },
  {
    type: 'item5',
    title: 'Market for Common Equity',
    patterns: [/Item\s*5\.?\s*[-–—]?\s*Market\s*for/i],
  },
  {
    type: 'item6',
    title: 'Selected Financial Data',
    patterns: [/Item\s*6\.?\s*[-–—]?\s*(?:Selected\s*Financial|Reserved)/i],
  },
  {
    type: 'item7',
    title: "Management's Discussion and Analysis",
    patterns: [/Item\s*7\.?\s*[-–—]?\s*Management['']?s?\s*Discussion/i, /ITEM\s*7[\.\s]+MANAGEMENT/i, /MD&A/i],
  },
  {
    type: 'item7a',
    title: 'Quantitative and Qualitative Disclosures About Market Risk',
    patterns: [/Item\s*7A\.?\s*[-–—]?\s*Quantitative/i],
  },
  {
    type: 'item8',
    title: 'Financial Statements and Supplementary Data',
    patterns: [/Item\s*8\.?\s*[-–—]?\s*Financial\s*Statements/i, /ITEM\s*8[\.\s]+FINANCIAL/i],
  },
  {
    type: 'item9',
    title: 'Changes in and Disagreements With Accountants',
    patterns: [/Item\s*9\.?\s*[-–—]?\s*Changes\s*in\s*and\s*Disagreements/i],
  },
  {
    type: 'item9a',
    title: 'Controls and Procedures',
    patterns: [/Item\s*9A\.?\s*[-–—]?\s*Controls/i],
  },
  {
    type: 'item9b',
    title: 'Other Information',
    patterns: [/Item\s*9B\.?\s*[-–—]?\s*Other\s*Information/i],
  },
  {
    type: 'item10',
    title: 'Directors, Executive Officers and Corporate Governance',
    patterns: [/Item\s*10\.?\s*[-–—]?\s*Directors/i],
  },
  {
    type: 'item11',
    title: 'Executive Compensation',
    patterns: [/Item\s*11\.?\s*[-–—]?\s*Executive\s*Compensation/i],
  },
  {
    type: 'item12',
    title: 'Security Ownership',
    patterns: [/Item\s*12\.?\s*[-–—]?\s*Security\s*Ownership/i],
  },
  {
    type: 'item13',
    title: 'Certain Relationships and Related Transactions',
    patterns: [/Item\s*13\.?\s*[-–—]?\s*Certain\s*Relationships/i],
  },
  {
    type: 'item14',
    title: 'Principal Accountant Fees',
    patterns: [/Item\s*14\.?\s*[-–—]?\s*Principal\s*Account/i],
  },
  {
    type: 'item15',
    title: 'Exhibits and Financial Statement Schedules',
    patterns: [/Item\s*15\.?\s*[-–—]?\s*Exhibits/i],
  },
]

export interface FilingSection {
  sectionType: string
  sectionTitle: string
  rawText: string
  wordCount: number
  startOffset: number
  endOffset: number
}

export interface SectionExtractionResult {
  sections: FilingSection[]
  fullText: string
  metadata: {
    fiscalYearEnd?: string
    companyName?: string
    cik?: string
  }
}

/**
 * Clean HTML and extract text
 */
function cleanHtml(html: string): string {
  const $ = cheerio.load(html)

  // Remove script, style, and hidden elements
  $('script, style, [style*="display:none"], [style*="display: none"]').remove()

  // Get text content
  let text = $.text()

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00A0/g, ' ') // non-breaking spaces
    .trim()

  return text
}

/**
 * Extract all sections from a 10-K filing
 */
export function extractSections(html: string): SectionExtractionResult {
  const text = cleanHtml(html)

  // Find section positions
  const sectionPositions: {
    definition: (typeof SECTION_DEFINITIONS)[0]
    position: number
    matchEnd: number
  }[] = []

  for (const definition of SECTION_DEFINITIONS) {
    let bestMatch: { position: number; matchEnd: number } | null = null

    for (const pattern of definition.patterns) {
      const match = pattern.exec(text)
      if (match && match.index !== undefined) {
        // Prefer matches that appear to be section headers (after table of contents)
        const position = match.index

        // Skip if it looks like it's in table of contents (very short line before next section marker)
        const contextBefore = text.slice(Math.max(0, position - 100), position)
        const contextAfter = text.slice(match.index + match[0].length, Math.min(text.length, match.index + match[0].length + 200))

        // If context suggests this is the actual section (longer content after), use it
        if (contextAfter.trim().length > 50 && (!bestMatch || position > bestMatch.position)) {
          bestMatch = {
            position,
            matchEnd: position + match[0].length,
          }
        }
      }
    }

    if (bestMatch) {
      sectionPositions.push({
        definition,
        position: bestMatch.position,
        matchEnd: bestMatch.matchEnd,
      })
    }
  }

  // Sort by position
  sectionPositions.sort((a, b) => a.position - b.position)

  // Extract sections
  const sections: FilingSection[] = []

  for (let i = 0; i < sectionPositions.length; i++) {
    const current = sectionPositions[i]
    const next = sectionPositions[i + 1]

    const startOffset = current.position
    const endOffset = next ? next.position : text.length

    const rawText = text.slice(startOffset, endOffset).trim()
    const wordCount = rawText.split(/\s+/).length

    // Only include if section has meaningful content
    if (wordCount > 50) {
      sections.push({
        sectionType: current.definition.type,
        sectionTitle: current.definition.title,
        rawText,
        wordCount,
        startOffset,
        endOffset,
      })
    }
  }

  // Extract metadata from the beginning of the document
  const metadata: SectionExtractionResult['metadata'] = {}

  // Try to extract company name from cover page
  const nameMatch = text.match(/Commission\s+file\s+number[:\s]+[\d-]+\s*\n+\s*([A-Z][A-Z\s&,.]+(?:INC|CORP|LLC|LTD|CO|COMPANY|CORPORATION|HOLDINGS)?)/i)
  if (nameMatch) {
    metadata.companyName = nameMatch[1].trim()
  }

  // Try to extract CIK
  const cikMatch = text.match(/(?:CIK|Central\s+Index\s+Key)[:\s]*(\d{10}|\d{7})/i)
  if (cikMatch) {
    metadata.cik = cikMatch[1].padStart(10, '0')
  }

  // Try to extract fiscal year end
  const fyeMatch = text.match(/(?:fiscal\s+year\s+ended?|for\s+the\s+year\s+ended?)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (fyeMatch) {
    metadata.fiscalYearEnd = fyeMatch[1]
  }

  return {
    sections,
    fullText: text,
    metadata,
  }
}

/**
 * Extract specific key sections for quick analysis
 */
export function extractKeySections(
  result: SectionExtractionResult
): {
  business: FilingSection | null
  riskFactors: FilingSection | null
  mda: FilingSection | null
  financials: FilingSection | null
} {
  return {
    business: result.sections.find((s) => s.sectionType === 'item1') || null,
    riskFactors: result.sections.find((s) => s.sectionType === 'item1a') || null,
    mda: result.sections.find((s) => s.sectionType === 'item7') || null,
    financials: result.sections.find((s) => s.sectionType === 'item8') || null,
  }
}

/**
 * Extract risk factor categories from Item 1A
 */
export function parseRiskFactors(
  riskSection: FilingSection
): {
  category: string
  title: string
  description: string
}[] {
  const risks: {
    category: string
    title: string
    description: string
  }[] = []

  const text = riskSection.rawText

  // Common patterns for risk factor headers
  const riskHeaderPattern = /(?:^|\n)([A-Z][^.!?\n]{10,150}(?:\.|—))\s*\n/g

  let match
  const headers: { title: string; position: number }[] = []

  while ((match = riskHeaderPattern.exec(text)) !== null) {
    headers.push({
      title: match[1].trim(),
      position: match.index,
    })
  }

  for (let i = 0; i < headers.length; i++) {
    const current = headers[i]
    const next = headers[i + 1]

    const endPosition = next ? next.position : Math.min(current.position + 5000, text.length)
    const description = text.slice(current.position, endPosition).trim()

    // Categorize the risk
    const category = categorizeRisk(current.title + ' ' + description.slice(0, 500))

    risks.push({
      category,
      title: current.title.replace(/\.$/, ''),
      description: description.slice(0, 2000), // Limit description length
    })
  }

  return risks
}

/**
 * Categorize a risk factor based on content
 */
function categorizeRisk(text: string): string {
  const lowerText = text.toLowerCase()

  // Healthcare-specific categories
  if (lowerText.includes('fda') || lowerText.includes('regulatory approv') || lowerText.includes('clinical trial')) {
    return 'regulatory'
  }
  if (lowerText.includes('clinical') || lowerText.includes('efficacy') || lowerText.includes('safety') || lowerText.includes('patient')) {
    return 'clinical'
  }
  if (lowerText.includes('compet') || lowerText.includes('market share') || lowerText.includes('pricing pressure')) {
    return 'competitive'
  }
  if (lowerText.includes('patent') || lowerText.includes('intellectual property') || lowerText.includes('generic')) {
    return 'ip'
  }
  if (lowerText.includes('reimburse') || lowerText.includes('cms') || lowerText.includes('medicare') || lowerText.includes('insurance')) {
    return 'reimbursement'
  }
  if (lowerText.includes('manufacturing') || lowerText.includes('supply chain') || lowerText.includes('supplier')) {
    return 'operational'
  }
  if (lowerText.includes('debt') || lowerText.includes('financ') || lowerText.includes('capital') || lowerText.includes('liquidity')) {
    return 'financial'
  }
  if (lowerText.includes('cybersecurity') || lowerText.includes('data breach') || lowerText.includes('privacy')) {
    return 'cybersecurity'
  }
  if (lowerText.includes('litigation') || lowerText.includes('lawsuit') || lowerText.includes('legal proceed')) {
    return 'legal'
  }

  return 'general'
}

/**
 * Extract product/pipeline information from Business section
 */
export function extractProducts(
  businessSection: FilingSection
): {
  name: string
  status: string
  indication?: string
  description: string
}[] {
  const products: {
    name: string
    status: string
    indication?: string
    description: string
  }[] = []

  const text = businessSection.rawText

  // Look for product mentions with status indicators
  const productPatterns = [
    // Drug names with status
    /([A-Z][a-z]+(?:mab|nib|tinib|ciclib|zumab))\s*(?:\(([^)]+)\))?\s*(?:is|was|has been)?\s*(approved|in\s+Phase\s+[1-3I-V]+|in\s+development|preclinical)/gi,
    // Products with trademark symbols
    /([A-Z][A-Za-z0-9-]+)[®™]\s*(?:\(([^)]+)\))?\s*(?:is|was|has been)?\s*(marketed|approved|launched|commercialized)/gi,
  ]

  for (const pattern of productPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]
      const indication = match[2] || undefined
      const statusText = match[3].toLowerCase()

      let status = 'unknown'
      if (statusText.includes('approved') || statusText.includes('marketed') || statusText.includes('launched') || statusText.includes('commercialized')) {
        status = 'approved'
      } else if (statusText.includes('phase 3') || statusText.includes('phase iii')) {
        status = 'phase3'
      } else if (statusText.includes('phase 2') || statusText.includes('phase ii')) {
        status = 'phase2'
      } else if (statusText.includes('phase 1') || statusText.includes('phase i')) {
        status = 'phase1'
      } else if (statusText.includes('preclinical') || statusText.includes('development')) {
        status = 'preclinical'
      }

      // Find context around the match
      const contextStart = Math.max(0, match.index - 100)
      const contextEnd = Math.min(text.length, match.index + match[0].length + 200)
      const description = text.slice(contextStart, contextEnd).trim()

      // Avoid duplicates
      if (!products.find((p) => p.name.toLowerCase() === name.toLowerCase())) {
        products.push({
          name,
          status,
          indication,
          description,
        })
      }
    }
  }

  return products
}
