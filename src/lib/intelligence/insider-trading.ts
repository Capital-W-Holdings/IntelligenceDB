/**
 * Insider Trading Analysis System
 *
 * Analyzes Form 4 filings to provide insights on:
 * - Insider buying/selling patterns
 * - Cluster buys (multiple insiders buying)
 * - Unusual activity detection
 * - Sentiment signals for investors
 */

export interface InsiderTransaction {
  insiderName: string
  insiderTitle?: string
  insiderCik?: string
  transactionType: 'P' | 'S' | 'A' | 'M' | 'G' | 'C' | 'D' | 'F' // Purchase, Sale, Award, Exercise, Gift, Conversion, Disposition, InKind
  transactionCode?: string
  shares: number
  pricePerShare?: number
  totalValue?: number
  sharesOwnedAfter?: number
  transactionDate: Date
  filingDate: Date
  accessionNumber: string
  sourceUrl?: string
}

export interface InsiderProfile {
  name: string
  title?: string
  cik?: string
  totalTransactions: number
  totalBuys: number
  totalSells: number
  netShares: number
  netValue: number
  lastTransactionDate: Date
  currentHoldings?: number
}

export interface ClusterActivity {
  type: 'cluster_buy' | 'cluster_sell'
  insiders: string[]
  totalShares: number
  totalValue: number
  dateRange: { start: Date; end: Date }
  significance: 'high' | 'medium' | 'low'
}

export interface InsiderAnalysis {
  company: {
    name?: string
    ticker?: string
  }
  summary: {
    totalTransactions: number
    totalBuys: number
    totalSells: number
    netShares: number
    netValue: number
    buyValue: number
    sellValue: number
    uniqueInsiders: number
    lastTransactionDate?: Date
  }
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed'
  sentimentScore: number // -10 to +10
  sentimentExplanation: string
  insiders: InsiderProfile[]
  recentTransactions: InsiderTransaction[]
  clusterActivity: ClusterActivity[]
  alerts: InsiderAlert[]
  trends: TrendAnalysis
}

export interface InsiderAlert {
  type: 'cluster_buy' | 'large_purchase' | 'ceo_buy' | 'unusual_activity' | 'heavy_selling'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  date: Date
  relatedInsiders: string[]
  value?: number
}

export interface TrendAnalysis {
  last30Days: { buys: number; sells: number; netValue: number }
  last90Days: { buys: number; sells: number; netValue: number }
  last365Days: { buys: number; sells: number; netValue: number }
  monthlyTrend: Array<{
    month: string
    buys: number
    sells: number
    netValue: number
  }>
}

// Transaction type descriptions
const TRANSACTION_TYPES: Record<string, { label: string; isBuy: boolean; isSell: boolean }> = {
  'P': { label: 'Open Market Purchase', isBuy: true, isSell: false },
  'S': { label: 'Open Market Sale', isSell: true, isBuy: false },
  'A': { label: 'Grant/Award', isBuy: false, isSell: false },
  'M': { label: 'Option Exercise', isBuy: false, isSell: false },
  'G': { label: 'Gift', isBuy: false, isSell: false },
  'C': { label: 'Conversion', isBuy: false, isSell: false },
  'D': { label: 'Disposition', isSell: true, isBuy: false },
  'F': { label: 'Payment of Tax', isSell: true, isBuy: false },
}

// Executive importance ranking
const EXECUTIVE_IMPORTANCE: Record<string, number> = {
  'ceo': 10,
  'chief executive': 10,
  'cfo': 8,
  'chief financial': 8,
  'president': 7,
  'coo': 7,
  'chief operating': 7,
  'cmo': 6,
  'chief medical': 6,
  'cso': 6,
  'chief scientific': 6,
  'chairman': 5,
  'director': 3,
  '10%': 4,
  'vp': 2,
  'vice president': 2,
}

/**
 * Get the importance score for an insider based on title
 */
function getInsiderImportance(title?: string): number {
  if (!title) return 1
  const lowerTitle = title.toLowerCase()

  for (const [key, value] of Object.entries(EXECUTIVE_IMPORTANCE)) {
    if (lowerTitle.includes(key)) return value
  }

  return 1
}

/**
 * Check if a transaction is a buy
 */
function isBuyTransaction(tx: InsiderTransaction): boolean {
  return tx.transactionType === 'P'
}

/**
 * Check if a transaction is a sell
 */
function isSellTransaction(tx: InsiderTransaction): boolean {
  return tx.transactionType === 'S' || tx.transactionType === 'D' || tx.transactionType === 'F'
}

/**
 * Build insider profiles from transactions
 */
function buildInsiderProfiles(transactions: InsiderTransaction[]): InsiderProfile[] {
  const profileMap = new Map<string, InsiderProfile>()

  for (const tx of transactions) {
    const key = tx.insiderName.toLowerCase()
    let profile = profileMap.get(key)

    if (!profile) {
      profile = {
        name: tx.insiderName,
        title: tx.insiderTitle,
        cik: tx.insiderCik,
        totalTransactions: 0,
        totalBuys: 0,
        totalSells: 0,
        netShares: 0,
        netValue: 0,
        lastTransactionDate: tx.transactionDate,
        currentHoldings: tx.sharesOwnedAfter,
      }
      profileMap.set(key, profile)
    }

    profile.totalTransactions++

    if (isBuyTransaction(tx)) {
      profile.totalBuys++
      profile.netShares += tx.shares
      profile.netValue += tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
    } else if (isSellTransaction(tx)) {
      profile.totalSells++
      profile.netShares -= tx.shares
      profile.netValue -= tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
    }

    if (tx.transactionDate > profile.lastTransactionDate) {
      profile.lastTransactionDate = tx.transactionDate
      if (tx.sharesOwnedAfter !== undefined) {
        profile.currentHoldings = tx.sharesOwnedAfter
      }
    }
  }

  // Sort by importance and activity
  return Array.from(profileMap.values()).sort((a, b) => {
    const importanceA = getInsiderImportance(a.title)
    const importanceB = getInsiderImportance(b.title)
    if (importanceA !== importanceB) return importanceB - importanceA
    return b.totalTransactions - a.totalTransactions
  })
}

/**
 * Detect cluster buying/selling activity
 */
function detectClusterActivity(transactions: InsiderTransaction[]): ClusterActivity[] {
  const clusters: ClusterActivity[] = []

  // Group transactions by week
  const weeklyTx = new Map<string, InsiderTransaction[]>()

  for (const tx of transactions) {
    if (!isBuyTransaction(tx) && !isSellTransaction(tx)) continue

    const weekStart = new Date(tx.transactionDate)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]

    if (!weeklyTx.has(weekKey)) {
      weeklyTx.set(weekKey, [])
    }
    weeklyTx.get(weekKey)!.push(tx)
  }

  // Check for clusters (3+ insiders in same direction in a week)
  for (const [, txs] of weeklyTx) {
    const buyInsiders = new Set<string>()
    const sellInsiders = new Set<string>()
    let buyShares = 0, sellShares = 0
    let buyValue = 0, sellValue = 0
    let minDate = txs[0].transactionDate
    let maxDate = txs[0].transactionDate

    for (const tx of txs) {
      if (tx.transactionDate < minDate) minDate = tx.transactionDate
      if (tx.transactionDate > maxDate) maxDate = tx.transactionDate

      if (isBuyTransaction(tx)) {
        buyInsiders.add(tx.insiderName)
        buyShares += tx.shares
        buyValue += tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
      } else if (isSellTransaction(tx)) {
        sellInsiders.add(tx.insiderName)
        sellShares += tx.shares
        sellValue += tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
      }
    }

    if (buyInsiders.size >= 2) {
      const significance = buyInsiders.size >= 4 ? 'high' : buyInsiders.size >= 3 ? 'medium' : 'low'
      clusters.push({
        type: 'cluster_buy',
        insiders: Array.from(buyInsiders),
        totalShares: buyShares,
        totalValue: buyValue,
        dateRange: { start: minDate, end: maxDate },
        significance,
      })
    }

    if (sellInsiders.size >= 3) {
      const significance = sellInsiders.size >= 5 ? 'high' : sellInsiders.size >= 4 ? 'medium' : 'low'
      clusters.push({
        type: 'cluster_sell',
        insiders: Array.from(sellInsiders),
        totalShares: sellShares,
        totalValue: sellValue,
        dateRange: { start: minDate, end: maxDate },
        significance,
      })
    }
  }

  return clusters.sort((a, b) => b.dateRange.end.getTime() - a.dateRange.end.getTime())
}

/**
 * Generate alerts based on transaction patterns
 */
function generateAlerts(
  transactions: InsiderTransaction[],
  insiders: InsiderProfile[],
  clusters: ClusterActivity[]
): InsiderAlert[] {
  const alerts: InsiderAlert[] = []
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Check for cluster buys
  for (const cluster of clusters) {
    if (cluster.type === 'cluster_buy' && cluster.significance !== 'low') {
      alerts.push({
        type: 'cluster_buy',
        severity: cluster.significance as 'high' | 'medium',
        title: `Cluster Buy: ${cluster.insiders.length} insiders purchasing`,
        description: `${cluster.insiders.length} insiders purchased a total of ${cluster.totalShares.toLocaleString()} shares ($${(cluster.totalValue / 1e6).toFixed(2)}M)`,
        date: cluster.dateRange.end,
        relatedInsiders: cluster.insiders,
        value: cluster.totalValue,
      })
    }
  }

  // Check for large individual purchases
  const recentBuys = transactions.filter(
    tx => isBuyTransaction(tx) && tx.transactionDate >= thirtyDaysAgo
  )

  for (const tx of recentBuys) {
    const value = tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
    if (value >= 500000) {
      alerts.push({
        type: 'large_purchase',
        severity: value >= 1000000 ? 'high' : 'medium',
        title: `Large Purchase: $${(value / 1e6).toFixed(2)}M by ${tx.insiderName}`,
        description: `${tx.insiderName} (${tx.insiderTitle || 'Insider'}) purchased ${tx.shares.toLocaleString()} shares at $${tx.pricePerShare?.toFixed(2) || 'N/A'}`,
        date: tx.transactionDate,
        relatedInsiders: [tx.insiderName],
        value,
      })
    }
  }

  // Check for CEO/CFO buying (always notable)
  const executiveBuys = recentBuys.filter(tx => {
    const title = tx.insiderTitle?.toLowerCase() || ''
    return title.includes('ceo') || title.includes('chief executive') ||
           title.includes('cfo') || title.includes('chief financial')
  })

  for (const tx of executiveBuys) {
    const value = tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
    if (!alerts.some(a => a.type === 'large_purchase' && a.relatedInsiders.includes(tx.insiderName))) {
      alerts.push({
        type: 'ceo_buy',
        severity: 'high',
        title: `Executive Buy: ${tx.insiderTitle} purchasing shares`,
        description: `${tx.insiderName} (${tx.insiderTitle}) purchased ${tx.shares.toLocaleString()} shares ($${(value / 1e3).toFixed(0)}K)`,
        date: tx.transactionDate,
        relatedInsiders: [tx.insiderName],
        value,
      })
    }
  }

  // Check for heavy selling
  const recentSells = transactions.filter(
    tx => isSellTransaction(tx) && tx.transactionDate >= thirtyDaysAgo
  )

  const totalSellValue = recentSells.reduce(
    (sum, tx) => sum + (tx.totalValue || (tx.shares * (tx.pricePerShare || 0))), 0
  )

  if (totalSellValue >= 5000000) {
    const sellInsiders = [...new Set(recentSells.map(tx => tx.insiderName))]
    alerts.push({
      type: 'heavy_selling',
      severity: totalSellValue >= 10000000 ? 'high' : 'medium',
      title: `Heavy Insider Selling: $${(totalSellValue / 1e6).toFixed(1)}M in 30 days`,
      description: `${sellInsiders.length} insider${sellInsiders.length > 1 ? 's' : ''} sold shares totaling $${(totalSellValue / 1e6).toFixed(1)}M`,
      date: now,
      relatedInsiders: sellInsiders,
      value: totalSellValue,
    })
  }

  return alerts.sort((a, b) => {
    // Sort by severity first, then date
    const severityOrder = { high: 0, medium: 1, low: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    return b.date.getTime() - a.date.getTime()
  })
}

/**
 * Calculate trend analysis
 */
function calculateTrends(transactions: InsiderTransaction[]): TrendAnalysis {
  const now = new Date()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const day365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  const calcPeriod = (startDate: Date) => {
    const periodTx = transactions.filter(tx => tx.transactionDate >= startDate)
    let buys = 0, sells = 0, netValue = 0

    for (const tx of periodTx) {
      const value = tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
      if (isBuyTransaction(tx)) {
        buys++
        netValue += value
      } else if (isSellTransaction(tx)) {
        sells++
        netValue -= value
      }
    }

    return { buys, sells, netValue }
  }

  // Monthly trend for last 12 months
  const monthlyTrend: TrendAnalysis['monthlyTrend'] = []
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

    const monthTx = transactions.filter(tx =>
      tx.transactionDate >= monthStart && tx.transactionDate <= monthEnd
    )

    let buys = 0, sells = 0, netValue = 0
    for (const tx of monthTx) {
      const value = tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
      if (isBuyTransaction(tx)) {
        buys++
        netValue += value
      } else if (isSellTransaction(tx)) {
        sells++
        netValue -= value
      }
    }

    monthlyTrend.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      buys,
      sells,
      netValue,
    })
  }

  return {
    last30Days: calcPeriod(day30),
    last90Days: calcPeriod(day90),
    last365Days: calcPeriod(day365),
    monthlyTrend,
  }
}

/**
 * Calculate sentiment score and explanation
 */
function calculateSentiment(
  transactions: InsiderTransaction[],
  insiders: InsiderProfile[],
  clusters: ClusterActivity[],
  trends: TrendAnalysis
): { sentiment: InsiderAnalysis['sentiment']; score: number; explanation: string } {
  let score = 0

  // Weight by recent activity (last 30 days)
  const recentTx = transactions.filter(tx => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return tx.transactionDate >= thirtyDaysAgo
  })

  for (const tx of recentTx) {
    const importance = getInsiderImportance(tx.insiderTitle)
    const value = tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
    const valueWeight = Math.min(3, Math.log10(value / 10000 + 1))

    if (isBuyTransaction(tx)) {
      score += importance * valueWeight * 0.5
    } else if (isSellTransaction(tx)) {
      score -= importance * valueWeight * 0.3 // Sells weighted less (routine compensation)
    }
  }

  // Cluster bonuses
  for (const cluster of clusters) {
    if (cluster.type === 'cluster_buy') {
      score += cluster.significance === 'high' ? 4 : cluster.significance === 'medium' ? 2 : 1
    } else if (cluster.type === 'cluster_sell') {
      score -= cluster.significance === 'high' ? 3 : cluster.significance === 'medium' ? 1.5 : 0.5
    }
  }

  // Trend adjustments
  if (trends.last30Days.netValue > 1000000) score += 2
  else if (trends.last30Days.netValue < -5000000) score -= 2

  // Clamp score to -10 to +10
  score = Math.max(-10, Math.min(10, Math.round(score * 10) / 10))

  // Determine sentiment category
  let sentiment: InsiderAnalysis['sentiment']
  if (score >= 3) sentiment = 'bullish'
  else if (score <= -3) sentiment = 'bearish'
  else if (Math.abs(score) <= 1) sentiment = 'neutral'
  else sentiment = 'mixed'

  // Generate explanation
  let explanation = ''
  if (sentiment === 'bullish') {
    const buyCount = recentTx.filter(tx => isBuyTransaction(tx)).length
    if (clusters.some(c => c.type === 'cluster_buy')) {
      explanation = `Strong bullish signal: ${buyCount} recent purchases including cluster buying activity`
    } else {
      explanation = `Bullish signal: ${buyCount} insider purchases in the last 30 days`
    }
  } else if (sentiment === 'bearish') {
    const sellCount = recentTx.filter(tx => isSellTransaction(tx)).length
    explanation = `Bearish signal: ${sellCount} insider sales in the last 30 days`
    if (trends.last30Days.netValue < -1000000) {
      explanation += ` totaling $${(Math.abs(trends.last30Days.netValue) / 1e6).toFixed(1)}M net selling`
    }
  } else if (sentiment === 'neutral') {
    explanation = 'Neutral: Minimal insider trading activity in recent weeks'
  } else {
    explanation = 'Mixed signals: Both buying and selling activity from insiders'
  }

  return { sentiment, score, explanation }
}

/**
 * Main function to analyze insider trading activity
 */
export function analyzeInsiderTrading(
  transactions: InsiderTransaction[],
  companyInfo?: { name?: string; ticker?: string }
): InsiderAnalysis {
  // Sort transactions by date (newest first)
  const sortedTx = [...transactions].sort(
    (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime()
  )

  // Calculate summary stats
  let totalBuys = 0, totalSells = 0
  let buyValue = 0, sellValue = 0
  let netShares = 0

  for (const tx of sortedTx) {
    const value = tx.totalValue || (tx.shares * (tx.pricePerShare || 0))
    if (isBuyTransaction(tx)) {
      totalBuys++
      buyValue += value
      netShares += tx.shares
    } else if (isSellTransaction(tx)) {
      totalSells++
      sellValue += value
      netShares -= tx.shares
    }
  }

  const insiders = buildInsiderProfiles(sortedTx)
  const clusters = detectClusterActivity(sortedTx)
  const trends = calculateTrends(sortedTx)
  const { sentiment, score, explanation } = calculateSentiment(sortedTx, insiders, clusters, trends)
  const alerts = generateAlerts(sortedTx, insiders, clusters)

  return {
    company: companyInfo || {},
    summary: {
      totalTransactions: sortedTx.length,
      totalBuys,
      totalSells,
      netShares,
      netValue: buyValue - sellValue,
      buyValue,
      sellValue,
      uniqueInsiders: insiders.length,
      lastTransactionDate: sortedTx.length > 0 ? sortedTx[0].transactionDate : undefined,
    },
    sentiment,
    sentimentScore: score,
    sentimentExplanation: explanation,
    insiders,
    recentTransactions: sortedTx.slice(0, 20),
    clusterActivity: clusters,
    alerts,
    trends,
  }
}

/**
 * Get transaction type description
 */
export function getTransactionTypeLabel(type: string): string {
  return TRANSACTION_TYPES[type]?.label || 'Unknown'
}

/**
 * Check if transaction type is a buy
 */
export function isTransactionBuy(type: string): boolean {
  return TRANSACTION_TYPES[type]?.isBuy || false
}

/**
 * Check if transaction type is a sell
 */
export function isTransactionSell(type: string): boolean {
  return TRANSACTION_TYPES[type]?.isSell || false
}
