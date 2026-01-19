/**
 * Smart 8-K Event Categorization System
 *
 * Provides AI-enhanced categorization of 8-K filings with:
 * - Intelligent category detection (clinical, regulatory, financial, etc.)
 * - Materiality scoring (1-10)
 * - Key entity extraction (people, amounts, dates, drugs)
 * - Sentiment analysis
 * - Plain English summaries
 */

export interface SmartEventInput {
  itemNumber: string
  itemTitle: string
  rawText: string
  companyTicker?: string
  companyName?: string
}

export interface ExtractedEntities {
  people: Array<{ name: string; title?: string; role?: string }>
  amounts: Array<{ value: number; unit: string; context: string }>
  dates: Array<{ date: string; context: string }>
  drugs: Array<{ name: string; context: string }>
  organizations: string[]
}

export interface SmartEventResult {
  primaryCategory: SmartEventCategory
  subCategory?: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  materialityScore: number
  entities: ExtractedEntities
  summary: string
  keyPoints: string[]
  investorImplications: string[]
  relatedRisks: string[]
}

export type SmartEventCategory =
  | 'clinical'
  | 'regulatory'
  | 'financial'
  | 'executive'
  | 'legal'
  | 'strategic'
  | 'operational'
  | 'governance'
  | 'other'

// 8-K Item number to standard event type mapping
const ITEM_MAPPING: Record<string, {
  title: string
  defaultCategory: SmartEventCategory
  baseMateriailty: number
}> = {
  '1.01': { title: 'Entry into Material Definitive Agreement', defaultCategory: 'strategic', baseMateriailty: 7 },
  '1.02': { title: 'Termination of Material Definitive Agreement', defaultCategory: 'strategic', baseMateriailty: 6 },
  '1.03': { title: 'Bankruptcy or Receivership', defaultCategory: 'financial', baseMateriailty: 10 },
  '1.04': { title: 'Mine Safety', defaultCategory: 'operational', baseMateriailty: 4 },
  '2.01': { title: 'Completion of Acquisition or Disposition', defaultCategory: 'strategic', baseMateriailty: 8 },
  '2.02': { title: 'Results of Operations and Financial Condition', defaultCategory: 'financial', baseMateriailty: 8 },
  '2.03': { title: 'Creation of Direct Financial Obligation', defaultCategory: 'financial', baseMateriailty: 7 },
  '2.04': { title: 'Triggering Events That Accelerate Obligation', defaultCategory: 'financial', baseMateriailty: 8 },
  '2.05': { title: 'Costs Associated with Exit or Disposal', defaultCategory: 'financial', baseMateriailty: 6 },
  '2.06': { title: 'Material Impairments', defaultCategory: 'financial', baseMateriailty: 7 },
  '3.01': { title: 'Notice of Delisting or Transfer', defaultCategory: 'governance', baseMateriailty: 9 },
  '3.02': { title: 'Unregistered Sales of Equity Securities', defaultCategory: 'financial', baseMateriailty: 5 },
  '3.03': { title: 'Material Modification to Rights of Security Holders', defaultCategory: 'governance', baseMateriailty: 7 },
  '4.01': { title: 'Changes in Registrants Certifying Accountant', defaultCategory: 'governance', baseMateriailty: 8 },
  '4.02': { title: 'Non-Reliance on Previously Issued Financial Statements', defaultCategory: 'financial', baseMateriailty: 10 },
  '5.01': { title: 'Changes in Control of Registrant', defaultCategory: 'governance', baseMateriailty: 10 },
  '5.02': { title: 'Departure/Appointment of Officers/Directors', defaultCategory: 'executive', baseMateriailty: 7 },
  '5.03': { title: 'Amendments to Articles of Incorporation/Bylaws', defaultCategory: 'governance', baseMateriailty: 5 },
  '5.04': { title: 'Temporary Suspension of Trading Under Employee Benefit Plans', defaultCategory: 'governance', baseMateriailty: 4 },
  '5.05': { title: 'Amendment to Code of Ethics', defaultCategory: 'governance', baseMateriailty: 5 },
  '5.06': { title: 'Change in Shell Company Status', defaultCategory: 'governance', baseMateriailty: 6 },
  '5.07': { title: 'Submission of Matters to a Vote of Security Holders', defaultCategory: 'governance', baseMateriailty: 4 },
  '5.08': { title: 'Shareholder Nominations', defaultCategory: 'governance', baseMateriailty: 4 },
  '6.01': { title: 'ABS Informational and Computational Material', defaultCategory: 'financial', baseMateriailty: 4 },
  '6.02': { title: 'Change of Servicer or Trustee', defaultCategory: 'financial', baseMateriailty: 5 },
  '6.03': { title: 'Change in Credit Enhancement', defaultCategory: 'financial', baseMateriailty: 6 },
  '6.04': { title: 'Failure to Make Distribution', defaultCategory: 'financial', baseMateriailty: 8 },
  '6.05': { title: 'Securities Act Updating Disclosure', defaultCategory: 'financial', baseMateriailty: 4 },
  '7.01': { title: 'Regulation FD Disclosure', defaultCategory: 'other', baseMateriailty: 5 },
  '8.01': { title: 'Other Events', defaultCategory: 'other', baseMateriailty: 5 },
  '9.01': { title: 'Financial Statements and Exhibits', defaultCategory: 'financial', baseMateriailty: 3 },
}

// Healthcare-specific keyword patterns for categorization
const CATEGORY_PATTERNS: Record<SmartEventCategory, {
  keywords: string[]
  phrases: string[]
  weight: number
}> = {
  clinical: {
    keywords: ['trial', 'phase', 'fda', 'approval', 'study', 'patient', 'efficacy', 'safety', 'endpoint', 'data', 'results', 'enrollment', 'drug', 'therapy', 'treatment', 'indication', 'nda', 'bla', 'pdufa', 'breakthrough', 'accelerated', 'orphan', 'priority'],
    phrases: ['clinical trial', 'phase 1', 'phase 2', 'phase 3', 'fda approval', 'primary endpoint', 'overall survival', 'progression free', 'complete response', 'adverse event', 'patient enrollment'],
    weight: 2,
  },
  regulatory: {
    keywords: ['fda', 'ema', 'regulatory', 'approval', 'clearance', '510k', 'pma', 'warning', 'audit', 'inspection', 'compliance', 'recall', 'gmp', 'cgmp', 'hipaa', 'consent', 'decree'],
    phrases: ['fda approval', 'warning letter', 'form 483', 'consent decree', 'regulatory approval', 'marketing authorization', 'complete response letter', 'refuse to file'],
    weight: 2,
  },
  financial: {
    keywords: ['revenue', 'earnings', 'profit', 'loss', 'guidance', 'forecast', 'debt', 'loan', 'credit', 'offering', 'securities', 'cash', 'capital', 'financing', 'impairment', 'write-down', 'restatement'],
    phrases: ['fiscal year', 'quarterly results', 'financial guidance', 'cash position', 'credit facility', 'debt financing', 'equity offering', 'material weakness'],
    weight: 1.5,
  },
  executive: {
    keywords: ['ceo', 'cfo', 'coo', 'cmo', 'cso', 'president', 'officer', 'director', 'board', 'appointed', 'resigned', 'departed', 'retirement', 'transition', 'succession'],
    phrases: ['chief executive', 'chief financial', 'chief operating', 'chief medical', 'chief scientific', 'board of directors', 'executive officer'],
    weight: 1.5,
  },
  legal: {
    keywords: ['lawsuit', 'litigation', 'settlement', 'complaint', 'defendant', 'plaintiff', 'court', 'judgment', 'verdict', 'patent', 'infringement', 'investigation', 'subpoena', 'sec', 'doj'],
    phrases: ['class action', 'securities litigation', 'patent infringement', 'shareholder lawsuit', 'government investigation', 'false claims'],
    weight: 1.8,
  },
  strategic: {
    keywords: ['acquisition', 'merger', 'divestiture', 'partnership', 'collaboration', 'license', 'agreement', 'deal', 'transaction', 'strategic', 'alliance', 'joint', 'venture'],
    phrases: ['acquisition of', 'merger with', 'strategic partnership', 'collaboration agreement', 'license agreement', 'definitive agreement', 'joint venture'],
    weight: 1.5,
  },
  operational: {
    keywords: ['manufacturing', 'production', 'supply', 'facility', 'plant', 'capacity', 'inventory', 'distribution', 'logistics', 'restructuring', 'layoff', 'closure'],
    phrases: ['manufacturing facility', 'supply chain', 'production capacity', 'workforce reduction', 'site closure'],
    weight: 1.2,
  },
  governance: {
    keywords: ['board', 'shareholder', 'proxy', 'vote', 'bylaw', 'charter', 'committee', 'audit', 'compensation', 'nominating', 'governance'],
    phrases: ['board of directors', 'shareholder meeting', 'proxy statement', 'corporate governance'],
    weight: 1,
  },
  other: {
    keywords: [],
    phrases: [],
    weight: 0.5,
  },
}

// Sentiment indicators
const SENTIMENT_PATTERNS = {
  positive: {
    keywords: ['achieved', 'exceeded', 'successful', 'approved', 'positive', 'growth', 'improved', 'increased', 'breakthrough', 'milestone', 'beat', 'strong', 'upside', 'raised', 'favorable'],
    phrases: ['met primary endpoint', 'exceeded expectations', 'positive results', 'ahead of schedule', 'fda approval received'],
    weight: 1,
  },
  negative: {
    keywords: ['failed', 'missed', 'declined', 'decreased', 'terminated', 'discontinued', 'warning', 'impairment', 'loss', 'departed', 'lawsuit', 'investigation', 'recall', 'delay'],
    phrases: ['failed to meet', 'missed endpoint', 'warning letter', 'clinical hold', 'delayed approval', 'below expectations', 'going concern'],
    weight: 1,
  },
}

// Executive title patterns
const EXECUTIVE_PATTERNS = [
  { pattern: /chief executive officer|ceo/i, title: 'CEO' },
  { pattern: /chief financial officer|cfo/i, title: 'CFO' },
  { pattern: /chief operating officer|coo/i, title: 'COO' },
  { pattern: /chief medical officer|cmo/i, title: 'CMO' },
  { pattern: /chief scientific officer|cso/i, title: 'CSO' },
  { pattern: /chief commercial officer|cco/i, title: 'CCO' },
  { pattern: /chief technology officer|cto/i, title: 'CTO' },
  { pattern: /president/i, title: 'President' },
  { pattern: /chairman/i, title: 'Chairman' },
  { pattern: /director/i, title: 'Director' },
  { pattern: /vice president|vp/i, title: 'VP' },
]

/**
 * Extract dollar amounts from text
 */
function extractAmounts(text: string): ExtractedEntities['amounts'] {
  const amounts: ExtractedEntities['amounts'] = []

  // Match patterns like $1.5 billion, $500 million, $100,000
  const patterns = [
    /\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|thousand)?/gi,
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|thousand)?\s*(?:dollars|usd)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const valueStr = match[1].replace(/,/g, '')
      let value = parseFloat(valueStr)
      const unit = (match[2] || '').toLowerCase()

      if (unit === 'billion') value *= 1e9
      else if (unit === 'million') value *= 1e6
      else if (unit === 'thousand') value *= 1e3

      // Get context (surrounding text)
      const start = Math.max(0, match.index - 50)
      const end = Math.min(text.length, match.index + match[0].length + 50)
      const context = text.slice(start, end).trim()

      amounts.push({ value, unit: 'USD', context })
    }
  }

  // Remove duplicates by value
  return amounts.filter((a, i, arr) =>
    arr.findIndex(x => Math.abs(x.value - a.value) < 0.01) === i
  )
}

/**
 * Extract dates from text
 */
function extractDates(text: string): ExtractedEntities['dates'] {
  const dates: ExtractedEntities['dates'] = []

  // Match patterns like January 15, 2024, 01/15/2024, Q1 2024
  const patterns = [
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi,
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    /Q[1-4]\s+\d{4}/gi,
    /(?:fiscal year|fy)\s*\d{4}/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30)
      const end = Math.min(text.length, match.index + match[0].length + 30)
      const context = text.slice(start, end).trim()

      dates.push({ date: match[0], context })
    }
  }

  return dates.slice(0, 10) // Limit to 10 dates
}

/**
 * Extract drug names from text (healthcare-specific)
 */
function extractDrugs(text: string): ExtractedEntities['drugs'] {
  const drugs: ExtractedEntities['drugs'] = []

  // Common drug name patterns (capitalized words ending in -mab, -nib, -ide, etc.)
  const drugPatterns = [
    /\b[A-Z][a-z]*(?:mab|nib|tide|zumab|tinib|ciclib|sertib|rafenib|ozomib|tumab|zomib)\b/g,
    /\b[A-Z]{2,}(?:-\d+)?\b/g, // Drug codes like AZD-1234
  ]

  for (const pattern of drugPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      // Filter out common false positives
      const name = match[0]
      if (name.length < 4 || name.match(/^(THE|AND|FOR|WITH|FROM|THAT|THIS|WILL|HAVE|BEEN)$/i)) {
        continue
      }

      const start = Math.max(0, match.index - 50)
      const end = Math.min(text.length, match.index + match[0].length + 50)
      const context = text.slice(start, end).trim()

      // Check if context suggests this is a drug
      const drugContext = /phase|trial|fda|approval|indication|treatment|patient|efficacy|safety/i.test(context)
      if (drugContext) {
        drugs.push({ name, context })
      }
    }
  }

  return drugs.filter((d, i, arr) =>
    arr.findIndex(x => x.name === d.name) === i
  ).slice(0, 10)
}

/**
 * Extract people mentioned in the text
 */
function extractPeople(text: string): ExtractedEntities['people'] {
  const people: ExtractedEntities['people'] = []

  // Look for name patterns near executive titles
  for (const { pattern, title } of EXECUTIVE_PATTERNS) {
    const matches = text.matchAll(new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z](?:\\.|[a-z]+))*(?:\\s+[A-Z][a-z]+)?)(?:,?\\s+(?:the\\s+)?${pattern.source})`,
      'gi'
    ))

    for (const match of matches) {
      const name = match[1].trim()
      if (name.length > 3 && !name.match(/^(The|Our|Its|His|Her)$/)) {
        people.push({ name, title, role: title })
      }
    }
  }

  // Also check for patterns like "CEO John Smith"
  for (const { pattern, title } of EXECUTIVE_PATTERNS) {
    const matches = text.matchAll(new RegExp(
      `(?:${pattern.source})(?:,?\\s+)([A-Z][a-z]+(?:\\s+[A-Z](?:\\.|[a-z]+))*(?:\\s+[A-Z][a-z]+)?)`,
      'gi'
    ))

    for (const match of matches) {
      const name = match[1].trim()
      if (name.length > 3 && !people.some(p => p.name === name)) {
        people.push({ name, title, role: title })
      }
    }
  }

  return people.slice(0, 10)
}

/**
 * Extract organizations mentioned in the text
 */
function extractOrganizations(text: string): string[] {
  const orgs: string[] = []

  // Look for organization patterns
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc\.|Corp\.|Corporation|LLC|Ltd\.|LP|Company|Co\.)))/g,
    /(FDA|SEC|DOJ|CMS|EMA|NIH|USPTO)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim()
      if (!orgs.includes(name)) {
        orgs.push(name)
      }
    }
  }

  return orgs.slice(0, 10)
}

/**
 * Determine primary category based on content analysis
 */
function determineCategory(
  itemNumber: string,
  text: string
): { category: SmartEventCategory; subCategory?: string } {
  const lowerText = text.toLowerCase()
  const itemInfo = ITEM_MAPPING[itemNumber]

  // Score each category
  const scores: Record<SmartEventCategory, number> = {
    clinical: 0,
    regulatory: 0,
    financial: 0,
    executive: 0,
    legal: 0,
    strategic: 0,
    operational: 0,
    governance: 0,
    other: 0,
  }

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    // Score keywords
    for (const keyword of patterns.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = lowerText.match(regex)
      if (matches) {
        scores[category as SmartEventCategory] += matches.length * patterns.weight
      }
    }

    // Score phrases (higher weight)
    for (const phrase of patterns.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        scores[category as SmartEventCategory] += 5 * patterns.weight
      }
    }
  }

  // Use item default as tiebreaker
  if (itemInfo) {
    scores[itemInfo.defaultCategory] += 3
  }

  // Find highest scoring category
  const maxScore = Math.max(...Object.values(scores))
  const category = (Object.entries(scores).find(([, score]) => score === maxScore)?.[0] || 'other') as SmartEventCategory

  // Determine sub-category
  let subCategory: string | undefined
  if (category === 'clinical') {
    if (lowerText.includes('phase 3')) subCategory = 'Phase 3 Update'
    else if (lowerText.includes('phase 2')) subCategory = 'Phase 2 Update'
    else if (lowerText.includes('phase 1')) subCategory = 'Phase 1 Update'
    else if (lowerText.includes('approval')) subCategory = 'Approval Event'
    else if (lowerText.includes('endpoint')) subCategory = 'Clinical Results'
  } else if (category === 'executive') {
    if (lowerText.includes('ceo')) subCategory = 'CEO Change'
    else if (lowerText.includes('cfo')) subCategory = 'CFO Change'
    else if (lowerText.includes('board')) subCategory = 'Board Change'
  } else if (category === 'financial') {
    if (lowerText.includes('guidance')) subCategory = 'Guidance Update'
    else if (lowerText.includes('earnings') || lowerText.includes('results')) subCategory = 'Earnings'
    else if (lowerText.includes('offering')) subCategory = 'Securities Offering'
  }

  return { category, subCategory }
}

/**
 * Determine sentiment from content
 */
function determineSentiment(text: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const lowerText = text.toLowerCase()

  let positiveScore = 0
  let negativeScore = 0

  // Score positive indicators
  for (const keyword of SENTIMENT_PATTERNS.positive.keywords) {
    if (lowerText.includes(keyword)) positiveScore++
  }
  for (const phrase of SENTIMENT_PATTERNS.positive.phrases) {
    if (lowerText.includes(phrase.toLowerCase())) positiveScore += 3
  }

  // Score negative indicators
  for (const keyword of SENTIMENT_PATTERNS.negative.keywords) {
    if (lowerText.includes(keyword)) negativeScore++
  }
  for (const phrase of SENTIMENT_PATTERNS.negative.phrases) {
    if (lowerText.includes(phrase.toLowerCase())) negativeScore += 3
  }

  if (positiveScore > negativeScore * 1.5) return 'positive'
  if (negativeScore > positiveScore * 1.5) return 'negative'
  if (positiveScore > 2 && negativeScore > 2) return 'mixed'
  return 'neutral'
}

/**
 * Calculate materiality score (1-10)
 */
function calculateMateriality(
  itemNumber: string,
  category: SmartEventCategory,
  sentiment: string,
  text: string,
  entities: ExtractedEntities
): number {
  let score = ITEM_MAPPING[itemNumber]?.baseMateriailty || 5

  // Adjust based on category
  const categoryBoosts: Record<SmartEventCategory, number> = {
    clinical: 1,
    regulatory: 1,
    legal: 0.5,
    financial: 0.5,
    executive: 0,
    strategic: 0.5,
    operational: 0,
    governance: 0,
    other: -1,
  }
  score += categoryBoosts[category] || 0

  // Adjust for large dollar amounts
  const maxAmount = Math.max(...entities.amounts.map(a => a.value), 0)
  if (maxAmount >= 1e9) score += 2
  else if (maxAmount >= 100e6) score += 1
  else if (maxAmount >= 10e6) score += 0.5

  // Adjust for sentiment (negative news often more material)
  if (sentiment === 'negative') score += 1
  if (sentiment === 'positive') score += 0.5

  // High-alert phrases
  const lowerText = text.toLowerCase()
  const alertPhrases = [
    'going concern', 'material weakness', 'restatement', 'delisting',
    'class action', 'securities fraud', 'fda warning', 'clinical hold',
    'bankruptcy', 'default', 'covenant violation'
  ]
  for (const phrase of alertPhrases) {
    if (lowerText.includes(phrase)) score += 2
  }

  // Clamp to 1-10
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10))
}

/**
 * Generate plain English summary
 */
function generateSummary(
  category: SmartEventCategory,
  subCategory: string | undefined,
  entities: ExtractedEntities,
  sentiment: string,
  companyName?: string
): string {
  const company = companyName || 'The company'
  const parts: string[] = []

  if (category === 'executive' && entities.people.length > 0) {
    const person = entities.people[0]
    if (sentiment === 'negative' || subCategory?.includes('Change')) {
      parts.push(`${company} announced a change in ${person.title || 'executive leadership'}`)
      if (person.name) parts.push(`involving ${person.name}`)
    } else {
      parts.push(`${company} appointed ${person.name} as ${person.title}`)
    }
  } else if (category === 'clinical') {
    if (entities.drugs.length > 0) {
      parts.push(`${company} announced ${subCategory?.toLowerCase() || 'clinical'} update for ${entities.drugs[0].name}`)
    } else {
      parts.push(`${company} reported ${subCategory?.toLowerCase() || 'clinical trial'} developments`)
    }
  } else if (category === 'financial') {
    if (entities.amounts.length > 0) {
      const amount = entities.amounts[0]
      const formatted = amount.value >= 1e9
        ? `$${(amount.value / 1e9).toFixed(1)}B`
        : amount.value >= 1e6
        ? `$${(amount.value / 1e6).toFixed(1)}M`
        : `$${amount.value.toLocaleString()}`
      parts.push(`${company} disclosed ${subCategory?.toLowerCase() || 'financial'} matter involving ${formatted}`)
    } else {
      parts.push(`${company} reported ${subCategory?.toLowerCase() || 'financial'} information`)
    }
  } else if (category === 'strategic') {
    parts.push(`${company} announced ${subCategory?.toLowerCase() || 'strategic'} activity`)
  } else if (category === 'regulatory') {
    parts.push(`${company} disclosed ${subCategory?.toLowerCase() || 'regulatory'} development`)
  } else if (category === 'legal') {
    parts.push(`${company} reported ${subCategory?.toLowerCase() || 'legal'} matter`)
  } else {
    parts.push(`${company} filed disclosure regarding ${category} matters`)
  }

  return parts.join(' ')
}

/**
 * Generate key points from the filing
 */
function generateKeyPoints(
  text: string,
  entities: ExtractedEntities,
  category: SmartEventCategory
): string[] {
  const points: string[] = []

  // Add amount-based points
  for (const amount of entities.amounts.slice(0, 2)) {
    const formatted = amount.value >= 1e9
      ? `$${(amount.value / 1e9).toFixed(1)} billion`
      : amount.value >= 1e6
      ? `$${(amount.value / 1e6).toFixed(1)} million`
      : `$${amount.value.toLocaleString()}`
    points.push(`Transaction value: ${formatted}`)
  }

  // Add people-based points
  for (const person of entities.people.slice(0, 2)) {
    points.push(`${person.title || 'Executive'}: ${person.name}`)
  }

  // Add drug-based points
  for (const drug of entities.drugs.slice(0, 2)) {
    points.push(`Product: ${drug.name}`)
  }

  // Add date-based points
  for (const date of entities.dates.slice(0, 2)) {
    if (date.context.toLowerCase().includes('effective')) {
      points.push(`Effective date: ${date.date}`)
    }
  }

  return points.slice(0, 5)
}

/**
 * Generate investor implications
 */
function generateImplications(
  category: SmartEventCategory,
  sentiment: string,
  materialityScore: number,
  entities: ExtractedEntities
): string[] {
  const implications: string[] = []

  if (materialityScore >= 8) {
    implications.push('High materiality event - may significantly impact stock price')
  }

  if (category === 'clinical' && sentiment === 'positive') {
    implications.push('Positive clinical data may increase probability of regulatory approval')
  } else if (category === 'clinical' && sentiment === 'negative') {
    implications.push('Negative clinical data may require strategic reassessment')
  }

  if (category === 'executive') {
    implications.push('Executive transition may impact strategic direction')
    if (entities.people.some(p => p.title === 'CEO')) {
      implications.push('CEO change warrants close monitoring of strategic continuity')
    }
  }

  if (category === 'financial' && entities.amounts.some(a => a.value >= 100e6)) {
    implications.push('Material financial transaction - review impact on balance sheet')
  }

  if (category === 'legal' && sentiment === 'negative') {
    implications.push('Legal matter may result in financial liability or regulatory action')
  }

  return implications.slice(0, 3)
}

/**
 * Generate related risk areas
 */
function generateRelatedRisks(
  category: SmartEventCategory,
  text: string
): string[] {
  const risks: string[] = []
  const lowerText = text.toLowerCase()

  if (category === 'clinical') {
    risks.push('Clinical development uncertainty')
    if (lowerText.includes('phase 3')) risks.push('Regulatory approval risk')
    if (lowerText.includes('safety')) risks.push('Safety signal risk')
  }

  if (category === 'financial') {
    if (lowerText.includes('debt') || lowerText.includes('loan')) risks.push('Leverage risk')
    if (lowerText.includes('offering')) risks.push('Dilution risk')
    if (lowerText.includes('impairment')) risks.push('Asset valuation risk')
  }

  if (category === 'regulatory') {
    risks.push('Regulatory compliance risk')
    if (lowerText.includes('warning')) risks.push('Manufacturing/quality risk')
  }

  if (category === 'executive') {
    risks.push('Key person risk')
    risks.push('Strategic continuity risk')
  }

  if (category === 'legal') {
    risks.push('Litigation risk')
    risks.push('Financial liability risk')
  }

  return [...new Set(risks)].slice(0, 4)
}

/**
 * Main function to analyze an 8-K filing item
 */
export function analyzeSmartEvent(input: SmartEventInput): SmartEventResult {
  const { itemNumber, rawText, companyName } = input

  // Extract entities
  const entities: ExtractedEntities = {
    people: extractPeople(rawText),
    amounts: extractAmounts(rawText),
    dates: extractDates(rawText),
    drugs: extractDrugs(rawText),
    organizations: extractOrganizations(rawText),
  }

  // Determine category
  const { category, subCategory } = determineCategory(itemNumber, rawText)

  // Determine sentiment
  const sentiment = determineSentiment(rawText)

  // Calculate materiality
  const materialityScore = calculateMateriality(itemNumber, category, sentiment, rawText, entities)

  // Generate outputs
  const summary = generateSummary(category, subCategory, entities, sentiment, companyName)
  const keyPoints = generateKeyPoints(rawText, entities, category)
  const investorImplications = generateImplications(category, sentiment, materialityScore, entities)
  const relatedRisks = generateRelatedRisks(category, rawText)

  return {
    primaryCategory: category,
    subCategory,
    sentiment,
    materialityScore,
    entities,
    summary,
    keyPoints,
    investorImplications,
    relatedRisks,
  }
}

/**
 * Batch analyze multiple 8-K items
 */
export function analyzeMultipleEvents(inputs: SmartEventInput[]): SmartEventResult[] {
  return inputs.map(input => analyzeSmartEvent(input))
}
