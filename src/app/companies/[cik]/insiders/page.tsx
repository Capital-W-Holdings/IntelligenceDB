'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency } from '@/lib/utils'

interface Transaction {
  insiderName: string
  insiderTitle?: string
  transactionType: string
  transactionTypeLabel: string
  isBuy: boolean
  isSell: boolean
  shares: number
  pricePerShare?: number
  totalValue?: number
  sharesOwnedAfter?: number
  transactionDate: string
  filingDate: string
  accessionNumber: string
}

interface Insider {
  name: string
  title?: string
  totalTransactions: number
  totalBuys: number
  totalSells: number
  netShares: number
  netValue: number
  currentHoldings?: number
  lastTransactionDate: string
}

interface Alert {
  type: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  date: string
  relatedInsiders: string[]
  value?: number
}

interface ClusterActivity {
  type: 'cluster_buy' | 'cluster_sell'
  insiders: string[]
  totalShares: number
  totalValue: number
  dateRange: { start: string; end: string }
  significance: 'high' | 'medium' | 'low'
}

interface TrendPeriod {
  buys: number
  sells: number
  netValue: number
}

interface MonthlyTrend {
  month: string
  buys: number
  sells: number
  netValue: number
}

interface Analysis {
  summary: {
    totalTransactions: number
    totalBuys: number
    totalSells: number
    netShares: number
    netValue: number
    buyValue: number
    sellValue: number
    uniqueInsiders: number
    lastTransactionDate?: string
  }
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed'
  sentimentScore: number
  sentimentExplanation: string
  alerts: Alert[]
  clusterActivity: ClusterActivity[]
  trends: {
    last30Days: TrendPeriod
    last90Days: TrendPeriod
    last365Days: TrendPeriod
    monthlyTrend: MonthlyTrend[]
  }
}

interface Company {
  cik: string
  name: string
  ticker: string | null
}

interface ApiResponse {
  company: Company
  analysis: Analysis
  insiders: Insider[]
  recentTransactions: Transaction[]
  error?: string
}

const sentimentColors = {
  bullish: 'bg-green-100 text-green-800 border-green-300',
  bearish: 'bg-red-100 text-red-800 border-red-300',
  neutral: 'bg-gray-100 text-gray-800 border-gray-300',
  mixed: 'bg-yellow-100 text-yellow-800 border-yellow-300',
}

const sentimentEmoji = {
  bullish: '📈',
  bearish: '📉',
  neutral: '➖',
  mixed: '📊',
}

function SentimentGauge({ score }: { score: number }) {
  // Score is -10 to +10, normalize to 0-100
  const normalized = ((score + 10) / 20) * 100

  const getColor = () => {
    if (score >= 3) return 'bg-green-500'
    if (score >= 1) return 'bg-green-400'
    if (score >= -1) return 'bg-gray-400'
    if (score >= -3) return 'bg-red-400'
    return 'bg-red-500'
  }

  return (
    <div className="relative">
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 z-10" />
        {/* Score indicator */}
        <div
          className={`absolute top-0 h-full w-2 rounded-full ${getColor()} transition-all`}
          style={{ left: `calc(${normalized}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Bearish</span>
        <span className="font-medium">{score > 0 ? '+' : ''}{score.toFixed(1)}</span>
        <span>Bullish</span>
      </div>
    </div>
  )
}

function MiniTrendChart({ trend }: { trend: MonthlyTrend[] }) {
  const maxAbs = Math.max(...trend.map(t => Math.abs(t.netValue)), 1)

  return (
    <div className="flex items-end gap-1 h-16">
      {trend.map((t, i) => {
        const height = Math.abs(t.netValue) / maxAbs * 100
        const isPositive = t.netValue >= 0

        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end">
            <div
              className={`w-full rounded-t transition-all ${isPositive ? 'bg-green-400' : 'bg-red-400'}`}
              style={{ height: `${Math.max(2, height)}%` }}
              title={`${t.month}: ${t.netValue >= 0 ? '+' : ''}$${(t.netValue / 1e6).toFixed(2)}M`}
            />
            {i % 3 === 0 && (
              <span className="text-[8px] text-gray-400 mt-1">{t.month}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const formatShares = (shares: number) => {
    if (shares >= 1e6) return `${(shares / 1e6).toFixed(1)}M`
    if (shares >= 1e3) return `${(shares / 1e3).toFixed(1)}K`
    return shares.toLocaleString()
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-3 px-2">
        <div className="font-medium text-sm">{tx.insiderName}</div>
        {tx.insiderTitle && (
          <div className="text-xs text-gray-500">{tx.insiderTitle}</div>
        )}
      </td>
      <td className="py-3 px-2">
        <Badge
          className={tx.isBuy ? 'bg-green-100 text-green-800' : tx.isSell ? 'bg-red-100 text-red-800' : 'bg-gray-100'}
        >
          {tx.isBuy ? '🟢' : tx.isSell ? '🔴' : '⚪'} {tx.transactionTypeLabel}
        </Badge>
      </td>
      <td className="py-3 px-2 text-right font-mono text-sm">
        {tx.isSell ? '-' : '+'}{formatShares(tx.shares)}
      </td>
      <td className="py-3 px-2 text-right font-mono text-sm">
        {tx.pricePerShare ? `$${tx.pricePerShare.toFixed(2)}` : '-'}
      </td>
      <td className="py-3 px-2 text-right font-mono text-sm">
        {tx.totalValue ? formatCurrency(tx.totalValue) : '-'}
      </td>
      <td className="py-3 px-2 text-sm text-gray-500">
        {formatDate(tx.transactionDate)}
      </td>
    </tr>
  )
}

export default function InsiderTradingPage() {
  const params = useParams()
  const cik = params.cik as string
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllInsiders, setShowAllInsiders] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/companies/${cik}/insider-trading`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching insider trading data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (cik) {
      fetchData()
    }
  }, [cik])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing insider trading activity...</p>
          <p className="mt-1 text-sm text-gray-500">Fetching Form 4 filings from SEC</p>
        </div>
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href={`/companies/${cik}`}>
            <Button variant="outline" size="sm">← Back to Company</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {data?.error || 'Failed to load insider trading data.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const { analysis, insiders, recentTransactions } = data
  const displayInsiders = showAllInsiders ? insiders : insiders.slice(0, 8)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/companies/${cik}`}>
          <Button variant="outline" size="sm">← Back to Company</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insider Trading Analysis</h1>
          <p className="text-gray-600 mt-1">
            {data.company?.name} ({data.company?.ticker})
          </p>
        </div>

        {/* Sentiment Badge */}
        <div className="text-right">
          <Badge className={`${sentimentColors[analysis.sentiment]} text-lg px-4 py-1`}>
            {sentimentEmoji[analysis.sentiment]} {analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Sentiment Gauge & Explanation */}
      <Card className="mb-6 bg-gradient-to-r from-gray-50 to-slate-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Insider Sentiment Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md mb-4">
            <SentimentGauge score={analysis.sentimentScore} />
          </div>
          <p className="text-sm text-gray-600">{analysis.sentimentExplanation}</p>
        </CardContent>
      </Card>

      {/* Alerts */}
      {analysis.alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {analysis.alerts.map((alert, i) => (
            <Card key={i} className={`border-l-4 ${
              alert.severity === 'high' ? 'border-l-red-500 bg-red-50' :
              alert.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-50' :
              'border-l-blue-500 bg-blue-50'
            }`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        alert.severity === 'high' ? 'border-red-300 text-red-700' :
                        alert.severity === 'medium' ? 'border-yellow-300 text-yellow-700' :
                        'border-blue-300 text-blue-700'
                      }>
                        {alert.type.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500">{formatDate(alert.date)}</span>
                    </div>
                    <h4 className="font-medium mt-1">{alert.title}</h4>
                    <p className="text-sm text-gray-600">{alert.description}</p>
                  </div>
                  {alert.value && (
                    <div className="text-right">
                      <div className="text-lg font-bold">{formatCurrency(alert.value)}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{analysis.summary.totalTransactions}</div>
            <div className="text-xs text-gray-500">Total Transactions</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-700">{analysis.summary.totalBuys}</div>
            <div className="text-xs text-green-600">Purchases</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-700">{analysis.summary.totalSells}</div>
            <div className="text-xs text-red-600">Sales</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{analysis.summary.uniqueInsiders}</div>
            <div className="text-xs text-gray-500">Unique Insiders</div>
          </CardContent>
        </Card>
        <Card className={analysis.summary.netValue >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="pt-4 pb-3">
            <div className={`text-lg font-bold ${analysis.summary.netValue >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {analysis.summary.netValue >= 0 ? '+' : ''}{formatCurrency(analysis.summary.netValue)}
            </div>
            <div className={`text-xs ${analysis.summary.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Net Activity
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-lg font-bold">
              {analysis.summary.netShares >= 0 ? '+' : ''}{analysis.summary.netShares.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Net Shares</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Monthly Net Insider Activity (12 Months)</CardTitle>
          <CardDescription>Green = net buying, Red = net selling</CardDescription>
        </CardHeader>
        <CardContent>
          <MiniTrendChart trend={analysis.trends.monthlyTrend} />
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Last 30 Days</div>
              <div className={`font-bold ${analysis.trends.last30Days.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(analysis.trends.last30Days.netValue)}
              </div>
              <div className="text-xs text-gray-400">
                {analysis.trends.last30Days.buys} buys / {analysis.trends.last30Days.sells} sells
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Last 90 Days</div>
              <div className={`font-bold ${analysis.trends.last90Days.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(analysis.trends.last90Days.netValue)}
              </div>
              <div className="text-xs text-gray-400">
                {analysis.trends.last90Days.buys} buys / {analysis.trends.last90Days.sells} sells
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Last 12 Months</div>
              <div className={`font-bold ${analysis.trends.last365Days.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(analysis.trends.last365Days.netValue)}
              </div>
              <div className="text-xs text-gray-400">
                {analysis.trends.last365Days.buys} buys / {analysis.trends.last365Days.sells} sells
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cluster Activity */}
      {analysis.clusterActivity.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Cluster Activity</CardTitle>
            <CardDescription>Multiple insiders transacting in the same direction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.clusterActivity.map((cluster, i) => (
                <div key={i} className={`p-3 rounded-lg border ${
                  cluster.type === 'cluster_buy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge className={cluster.type === 'cluster_buy' ? 'bg-green-600' : 'bg-red-600'}>
                        {cluster.type === 'cluster_buy' ? '📈 Cluster Buy' : '📉 Cluster Sell'}
                      </Badge>
                      <span className="ml-2 text-sm text-gray-600">
                        {cluster.insiders.length} insiders · {cluster.totalShares.toLocaleString()} shares
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(cluster.totalValue)}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(cluster.dateRange.start)} - {formatDate(cluster.dateRange.end)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {cluster.insiders.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insider Profiles */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Insider Profiles</CardTitle>
          <CardDescription>Trading activity by individual insider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayInsiders.map((insider, i) => (
              <div key={i} className="p-3 border rounded-lg hover:shadow-sm transition-shadow">
                <div className="font-medium text-sm truncate" title={insider.name}>
                  {insider.name}
                </div>
                {insider.title && (
                  <div className="text-xs text-gray-500 truncate">{insider.title}</div>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-green-600">{insider.totalBuys} buys</span>
                  <span className="text-red-600">{insider.totalSells} sells</span>
                </div>
                <div className={`mt-1 font-bold text-sm ${insider.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {insider.netValue >= 0 ? '+' : ''}{formatCurrency(insider.netValue)}
                </div>
                {insider.currentHoldings !== undefined && (
                  <div className="text-xs text-gray-400 mt-1">
                    Owns: {insider.currentHoldings.toLocaleString()} shares
                  </div>
                )}
              </div>
            ))}
          </div>
          {insiders.length > 8 && (
            <Button
              variant="ghost"
              className="mt-4 w-full"
              onClick={() => setShowAllInsiders(!showAllInsiders)}
            >
              {showAllInsiders ? 'Show less' : `Show all ${insiders.length} insiders`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest Form 4 filings</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500">Insider</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-gray-500">Shares</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-gray-500">Price</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-gray-500">Value</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx, i) => (
                  <TransactionRow key={i} tx={tx} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
