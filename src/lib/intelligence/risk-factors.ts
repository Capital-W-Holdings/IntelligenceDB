import { diff_match_patch, Diff } from 'diff-match-patch'

export interface RiskFactor {
  title: string
  content: string
  category: string
  wordCount: number
}

export interface RiskFactorDiff {
  title: string
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  category: string
  currentContent?: string
  priorContent?: string
  diffHtml?: string
  changePercent?: number
  addedText?: string[]
  removedText?: string[]
  severity?: number
  materialityScore?: number
  summary?: string
}

export interface RiskFactorAnalysis {
  currentFilingYear: number
  priorFilingYear: number
  totalRisks: {
    current: number
    prior: number
    added: number
    removed: number
    modified: number
  }
  categoryBreakdown: Record<string, {
    current: number
    prior: number
    added: number
    removed: number
    modified: number
  }>
  changes: RiskFactorDiff[]
  overallSeverity: 'critical' | 'high' | 'moderate' | 'low' | 'minimal'
  keyInsights: string[]
}

// Healthcare-specific risk categories
const RISK_CATEGORIES = {
  regulatory: [
    'fda', 'ema', 'regulatory', 'approval', 'clearance', '510(k)', 'pma',
    'compliance', 'audit', 'inspection', 'warning letter', 'recall',
    'gmp', 'quality system', 'cgmp', 'hipaa', 'phi', 'cms', 'medicare', 'medicaid'
  ],
  clinical: [
    'clinical trial', 'phase', 'efficacy', 'safety', 'adverse event',
    'patient', 'endpoint', 'enrollment', 'data', 'results', 'fda approval',
    'indication', 'label', 'study', 'placebo', 'randomized'
  ],
  competitive: [
    'competition', 'competitive', 'competitor', 'market share', 'generic',
    'biosimilar', 'patent expir', 'loss of exclusivity', 'pricing pressure',
    'substitute', 'alternative', 'market entry'
  ],
  financial: [
    'capital', 'funding', 'cash', 'liquidity', 'debt', 'financing',
    'revenue', 'profitability', 'operating loss', 'cash burn', 'going concern',
    'dilution', 'stock', 'covenant', 'credit'
  ],
  operational: [
    'manufacturing', 'supply chain', 'supplier', 'raw material', 'capacity',
    'production', 'inventory', 'distribution', 'logistics', 'third party',
    'key personnel', 'employee', 'labor', 'workforce'
  ],
  ip: [
    'patent', 'intellectual property', 'trade secret', 'infringement',
    'litigation', 'license', 'royalt', 'proprietary', 'trademark'
  ],
  legal: [
    'lawsuit', 'litigation', 'legal', 'settlement', 'class action',
    'investigation', 'subpoena', 'securities', 'antitrust', 'false claims'
  ],
  reimbursement: [
    'reimbursement', 'coverage', 'payer', 'insurance', 'medicare', 'medicaid',
    'cms', 'pricing', 'drug pricing', 'aca', 'affordable care', 'coverage decision'
  ],
  cybersecurity: [
    'cybersecurity', 'data breach', 'cyber', 'security incident', 'ransomware',
    'data protection', 'privacy', 'hack', 'unauthorized access'
  ]
}

/**
 * Categorize a risk factor based on its content
 */
export function categorizeRisk(content: string): string {
  const lowerContent = content.toLowerCase()

  const scores: Record<string, number> = {}

  for (const [category, keywords] of Object.entries(RISK_CATEGORIES)) {
    scores[category] = keywords.filter(kw => lowerContent.includes(kw)).length
  }

  const maxCategory = Object.entries(scores).reduce(
    (max, [cat, score]) => score > max.score ? { category: cat, score } : max,
    { category: 'general', score: 0 }
  )

  return maxCategory.score > 0 ? maxCategory.category : 'general'
}

/**
 * Extract risk factors from 10-K Item 1A text
 */
export function extractRiskFactors(item1aText: string): RiskFactor[] {
  const risks: RiskFactor[] = []

  // Clean up the text
  let text = item1aText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Common patterns for risk factor headers in SEC filings
  const headerPatterns = [
    // Bold or caps headers followed by newline
    /\n([A-Z][A-Z\s,&'-]{10,100})\n/g,
    // Risk factors starting with "Risk:" or "We may"
    /\n((?:Risk:|We may|Our|The Company|If we)[^\n]{20,150})\n/g,
    // Numbered risk factors
    /\n(\d+\.\s+[A-Z][^\n]{20,150})\n/g,
    // Bullet points
    /\n([•\-]\s*[A-Z][^\n]{20,150})\n/g,
  ]

  // Try to identify risk factor boundaries
  let riskBoundaries: { start: number; title: string }[] = []

  for (const pattern of headerPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const title = match[1].trim()
      // Filter out non-risk headers (too short, navigation elements, etc.)
      if (title.length > 15 && !title.match(/^(table of contents|page|item)/i)) {
        riskBoundaries.push({
          start: match.index,
          title
        })
      }
    }
  }

  // Sort by position
  riskBoundaries = riskBoundaries.sort((a, b) => a.start - b.start)

  // Remove duplicates (similar position or title)
  const deduped: typeof riskBoundaries = []
  for (const boundary of riskBoundaries) {
    const existing = deduped.find(
      d => Math.abs(d.start - boundary.start) < 50 ||
           d.title.toLowerCase() === boundary.title.toLowerCase()
    )
    if (!existing) {
      deduped.push(boundary)
    }
  }

  // Extract content between boundaries
  for (let i = 0; i < deduped.length; i++) {
    const current = deduped[i]
    const next = deduped[i + 1]

    const endPos = next ? next.start : text.length
    const content = text.slice(current.start, endPos).trim()

    // Clean up content
    const cleanContent = content
      .replace(/^\s*[\d\.\)]+\s*/, '') // Remove leading numbers
      .replace(current.title, '') // Remove title from content
      .trim()

    if (cleanContent.length > 100) { // Minimum content length
      risks.push({
        title: normalizeTitle(current.title),
        content: cleanContent,
        category: categorizeRisk(cleanContent),
        wordCount: cleanContent.split(/\s+/).length
      })
    }
  }

  // If no structured risks found, try to split by paragraph length
  if (risks.length < 3) {
    const paragraphs = text.split(/\n{2,}/)
    let currentRisk: { title: string; content: string } | null = null

    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (trimmed.length < 50) continue

      // Check if this looks like a header
      if (trimmed.length < 200 && trimmed.match(/^[A-Z]/) && !trimmed.endsWith('.')) {
        if (currentRisk && currentRisk.content.length > 100) {
          risks.push({
            title: currentRisk.title,
            content: currentRisk.content,
            category: categorizeRisk(currentRisk.content),
            wordCount: currentRisk.content.split(/\s+/).length
          })
        }
        currentRisk = { title: normalizeTitle(trimmed), content: '' }
      } else if (currentRisk) {
        currentRisk.content += (currentRisk.content ? '\n\n' : '') + trimmed
      }
    }

    // Don't forget the last one
    if (currentRisk && currentRisk.content.length > 100) {
      risks.push({
        title: currentRisk.title,
        content: currentRisk.content,
        category: categorizeRisk(currentRisk.content),
        wordCount: currentRisk.content.split(/\s+/).length
      })
    }
  }

  return risks
}

/**
 * Normalize a risk factor title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/^\s*[\d\.\)]+\s*/, '') // Remove leading numbers
    .replace(/[•\-]\s*/, '') // Remove bullets
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 200) // Limit length
}

/**
 * Create normalized key for risk matching
 */
function createRiskKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50)
}

/**
 * Calculate similarity between two strings (Jaccard similarity of words)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/))
  const words2 = new Set(str2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Match risk factors between two filings
 */
function matchRiskFactors(
  currentRisks: RiskFactor[],
  priorRisks: RiskFactor[]
): Map<number, number | null> {
  const matches = new Map<number, number | null>()
  const usedPriorIndices = new Set<number>()

  // First pass: exact title matches
  for (let i = 0; i < currentRisks.length; i++) {
    const currentKey = createRiskKey(currentRisks[i].title)

    for (let j = 0; j < priorRisks.length; j++) {
      if (usedPriorIndices.has(j)) continue

      const priorKey = createRiskKey(priorRisks[j].title)

      if (currentKey === priorKey) {
        matches.set(i, j)
        usedPriorIndices.add(j)
        break
      }
    }
  }

  // Second pass: fuzzy title + content matching
  for (let i = 0; i < currentRisks.length; i++) {
    if (matches.has(i)) continue

    let bestMatch: { index: number; score: number } | null = null

    for (let j = 0; j < priorRisks.length; j++) {
      if (usedPriorIndices.has(j)) continue

      const titleSimilarity = calculateSimilarity(
        currentRisks[i].title,
        priorRisks[j].title
      )

      const contentSimilarity = calculateSimilarity(
        currentRisks[i].content.substring(0, 500),
        priorRisks[j].content.substring(0, 500)
      )

      // Weight title more heavily
      const score = titleSimilarity * 0.6 + contentSimilarity * 0.4

      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { index: j, score }
      }
    }

    if (bestMatch) {
      matches.set(i, bestMatch.index)
      usedPriorIndices.add(bestMatch.index)
    } else {
      matches.set(i, null) // New risk
    }
  }

  return matches
}

/**
 * Generate HTML diff between two texts
 */
function generateDiffHtml(oldText: string, newText: string): string {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)

  return diffs.map((diff: Diff) => {
    const text = diff[1]
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')

    switch (diff[0]) {
      case -1: // Deletion
        return `<del class="bg-red-100 text-red-800 line-through">${text}</del>`
      case 1: // Insertion
        return `<ins class="bg-green-100 text-green-800">${text}</ins>`
      default: // No change
        return text
    }
  }).join('')
}

/**
 * Extract key changes from diff
 */
function extractKeyChanges(
  oldText: string,
  newText: string
): { added: string[]; removed: string[] } {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)

  const added: string[] = []
  const removed: string[] = []

  for (const diff of diffs) {
    const text = diff[1].trim()
    if (text.length < 20) continue // Skip small changes

    // Extract sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

    if (diff[0] === -1) { // Deletion
      removed.push(...sentences.filter(s => s.trim().length > 20))
    } else if (diff[0] === 1) { // Insertion
      added.push(...sentences.filter(s => s.trim().length > 20))
    }
  }

  return {
    added: added.slice(0, 5), // Limit to top 5
    removed: removed.slice(0, 5)
  }
}

/**
 * Calculate materiality score for a risk factor change
 */
function calculateMaterialityScore(diff: Partial<RiskFactorDiff>): number {
  let score = 0

  // Base score by change type
  if (diff.changeType === 'added') score += 7
  else if (diff.changeType === 'removed') score += 5
  else if (diff.changeType === 'modified') score += 3

  // Category importance (healthcare-specific)
  const categoryWeights: Record<string, number> = {
    regulatory: 3,
    clinical: 3,
    legal: 2.5,
    financial: 2,
    reimbursement: 2,
    competitive: 1.5,
    ip: 1.5,
    operational: 1,
    cybersecurity: 1.5,
    general: 0.5
  }

  score *= (categoryWeights[diff.category || 'general'] || 1)

  // Change magnitude for modifications
  if (diff.changePercent) {
    if (diff.changePercent > 50) score *= 1.5
    else if (diff.changePercent > 25) score *= 1.2
  }

  // Key phrases that increase materiality
  const content = (diff.currentContent || '') + (diff.addedText?.join(' ') || '')
  const highAlertPhrases = [
    'going concern', 'material weakness', 'significant deficiency',
    'warning letter', 'fda', 'complete response', 'clinical hold',
    'class action', 'securities litigation', 'restatement',
    'covenant violation', 'default', 'bankruptcy'
  ]

  const alertMatches = highAlertPhrases.filter(phrase =>
    content.toLowerCase().includes(phrase)
  ).length

  score += alertMatches * 2

  return Math.min(10, Math.round(score * 10) / 10)
}

/**
 * Generate summary of a risk change
 */
function generateChangeSummary(diff: RiskFactorDiff): string {
  switch (diff.changeType) {
    case 'added':
      return `New ${diff.category} risk added: "${diff.title.substring(0, 60)}${diff.title.length > 60 ? '...' : ''}"`
    case 'removed':
      return `${diff.category.charAt(0).toUpperCase() + diff.category.slice(1)} risk removed: "${diff.title.substring(0, 60)}${diff.title.length > 60 ? '...' : ''}"`
    case 'modified':
      const changeDesc = diff.changePercent && diff.changePercent > 20
        ? `Significantly modified (${Math.round(diff.changePercent)}% changed)`
        : 'Minor updates'
      return `${changeDesc} to ${diff.category} risk: "${diff.title.substring(0, 50)}${diff.title.length > 50 ? '...' : ''}"`
    default:
      return `No changes to: "${diff.title.substring(0, 60)}"`
  }
}

/**
 * Analyze risk factor changes between two filings
 */
export function analyzeRiskFactorChanges(
  currentRisks: RiskFactor[],
  priorRisks: RiskFactor[],
  currentYear: number,
  priorYear: number
): RiskFactorAnalysis {
  const matches = matchRiskFactors(currentRisks, priorRisks)
  const changes: RiskFactorDiff[] = []

  const usedPriorIndices = new Set<number>()

  // Process matched risks
  for (const [currentIdx, priorIdx] of matches.entries()) {
    const current = currentRisks[currentIdx]

    if (priorIdx === null) {
      // New risk
      const diff: RiskFactorDiff = {
        title: current.title,
        changeType: 'added',
        category: current.category,
        currentContent: current.content,
        severity: 4,
      }
      diff.materialityScore = calculateMaterialityScore(diff)
      diff.summary = generateChangeSummary(diff)
      changes.push(diff)
    } else {
      usedPriorIndices.add(priorIdx)
      const prior = priorRisks[priorIdx]

      // Check for modifications
      const similarity = calculateSimilarity(current.content, prior.content)
      const changePercent = Math.round((1 - similarity) * 100)

      if (changePercent > 5) { // More than 5% change
        const keyChanges = extractKeyChanges(prior.content, current.content)

        const diff: RiskFactorDiff = {
          title: current.title,
          changeType: 'modified',
          category: current.category,
          currentContent: current.content,
          priorContent: prior.content,
          diffHtml: generateDiffHtml(
            prior.content.substring(0, 2000),
            current.content.substring(0, 2000)
          ),
          changePercent,
          addedText: keyChanges.added,
          removedText: keyChanges.removed,
          severity: changePercent > 30 ? 3 : changePercent > 15 ? 2 : 1,
        }
        diff.materialityScore = calculateMaterialityScore(diff)
        diff.summary = generateChangeSummary(diff)
        changes.push(diff)
      } else {
        changes.push({
          title: current.title,
          changeType: 'unchanged',
          category: current.category,
          materialityScore: 0
        })
      }
    }
  }

  // Check for removed risks
  for (let i = 0; i < priorRisks.length; i++) {
    if (!usedPriorIndices.has(i)) {
      const prior = priorRisks[i]
      const diff: RiskFactorDiff = {
        title: prior.title,
        changeType: 'removed',
        category: prior.category,
        priorContent: prior.content,
        severity: 2,
      }
      diff.materialityScore = calculateMaterialityScore(diff)
      diff.summary = generateChangeSummary(diff)
      changes.push(diff)
    }
  }

  // Sort by materiality
  changes.sort((a, b) => (b.materialityScore || 0) - (a.materialityScore || 0))

  // Calculate category breakdown
  const categoryBreakdown: RiskFactorAnalysis['categoryBreakdown'] = {}

  for (const risk of currentRisks) {
    if (!categoryBreakdown[risk.category]) {
      categoryBreakdown[risk.category] = { current: 0, prior: 0, added: 0, removed: 0, modified: 0 }
    }
    categoryBreakdown[risk.category].current++
  }

  for (const risk of priorRisks) {
    if (!categoryBreakdown[risk.category]) {
      categoryBreakdown[risk.category] = { current: 0, prior: 0, added: 0, removed: 0, modified: 0 }
    }
    categoryBreakdown[risk.category].prior++
  }

  for (const change of changes) {
    if (!categoryBreakdown[change.category]) {
      categoryBreakdown[change.category] = { current: 0, prior: 0, added: 0, removed: 0, modified: 0 }
    }
    if (change.changeType === 'added') categoryBreakdown[change.category].added++
    else if (change.changeType === 'removed') categoryBreakdown[change.category].removed++
    else if (change.changeType === 'modified') categoryBreakdown[change.category].modified++
  }

  // Calculate totals
  const totalRisks = {
    current: currentRisks.length,
    prior: priorRisks.length,
    added: changes.filter(c => c.changeType === 'added').length,
    removed: changes.filter(c => c.changeType === 'removed').length,
    modified: changes.filter(c => c.changeType === 'modified').length,
  }

  // Determine overall severity
  const maxMateriality = Math.max(...changes.map(c => c.materialityScore || 0))
  const highMaterialityCount = changes.filter(c => (c.materialityScore || 0) > 6).length

  let overallSeverity: RiskFactorAnalysis['overallSeverity']
  if (maxMateriality >= 9 || highMaterialityCount >= 3) {
    overallSeverity = 'critical'
  } else if (maxMateriality >= 7 || highMaterialityCount >= 2) {
    overallSeverity = 'high'
  } else if (totalRisks.added > 5 || maxMateriality >= 5) {
    overallSeverity = 'moderate'
  } else if (totalRisks.added > 0 || totalRisks.modified > 3) {
    overallSeverity = 'low'
  } else {
    overallSeverity = 'minimal'
  }

  // Generate key insights
  const keyInsights: string[] = []

  if (totalRisks.added > 0) {
    keyInsights.push(`${totalRisks.added} new risk factor${totalRisks.added > 1 ? 's' : ''} added`)
  }
  if (totalRisks.removed > 0) {
    keyInsights.push(`${totalRisks.removed} risk factor${totalRisks.removed > 1 ? 's' : ''} removed`)
  }

  const significantChanges = changes.filter(c =>
    c.changeType === 'modified' && (c.changePercent || 0) > 25
  )
  if (significantChanges.length > 0) {
    keyInsights.push(`${significantChanges.length} risk${significantChanges.length > 1 ? 's' : ''} with significant modifications`)
  }

  // Highlight critical categories
  const criticalCategories = Object.entries(categoryBreakdown)
    .filter(([, stats]) => stats.added > 0)
    .map(([cat]) => cat)

  if (criticalCategories.includes('regulatory')) {
    keyInsights.push('⚠️ New regulatory risks identified')
  }
  if (criticalCategories.includes('clinical')) {
    keyInsights.push('⚠️ New clinical/trial risks identified')
  }
  if (criticalCategories.includes('financial')) {
    keyInsights.push('⚠️ New financial risks identified')
  }

  return {
    currentFilingYear: currentYear,
    priorFilingYear: priorYear,
    totalRisks,
    categoryBreakdown,
    changes,
    overallSeverity,
    keyInsights,
  }
}
