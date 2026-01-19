'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, formatPercent } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'

interface CompanyMetrics {
  id: string
  revenue: number | null
  netIncome: number | null
  totalAssets: number | null
  cashAndEquivalents: number | null
  rdExpense: number | null
  grossMargin: number | null
  operatingMargin: number | null
  cashRunwayMonths: number | null
  rdIntensity: number | null
}

interface Filing {
  accessionNumber: string
  formType: string
  filingDate: string
  primaryDocument: string | null
}

interface Company {
  cik: string
  name: string
  ticker: string | null
  sector: string | null
  sicCode: string | null
  sicDescription: string | null
  filings: Filing[]
  metrics: CompanyMetrics[]
}

interface IntelligenceData {
  earningsQuality?: {
    overallRating: string
    piotroskiFScore?: number
    altmanZ?: { score: number; interpretation: string }
  }
}

const NAV_ITEMS = [
  { href: '', label: 'Overview', icon: '📊', description: 'Company overview' },
  { href: '/intelligence', label: 'Scores', icon: '🎯', description: 'Financial health' },
  { href: '/risk-factors', label: 'Risks', icon: '⚠️', description: 'Risk analysis' },
  { href: '/events', label: '8-K', icon: '📰', description: 'Material events' },
  { href: '/insiders', label: 'Insiders', icon: '👔', description: 'Form 4 trades' },
  { href: '/model', label: 'Model', icon: '📈', description: 'Financial model' },
]

export default function CompanyDetailPage() {
  const params = useParams()
  const cik = params.cik as string
  const [company, setCompany] = useState<Company | null>(null)
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadingReport, setDownloadingReport] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [companyRes, summaryRes] = await Promise.all([
          fetch(`/api/companies/${cik}`),
          fetch(`/api/companies/${cik}/summary`).catch(() => null),
        ])

        if (companyRes.ok) {
          const companyData = await companyRes.json()
          setCompany(companyData)
        }

        if (summaryRes?.ok) {
          const summaryData = await summaryRes.json()
          setIntelligence({ earningsQuality: summaryData.earningsQuality })
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (cik) {
      fetchData()
    }
  }, [cik])

  const handleDownloadModel = async () => {
    setDownloading(true)
    try {
      const response = await fetch(`/api/export/model?cik=${cik}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${company?.ticker || company?.name}_financial_model.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading model:', error)
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadReport = async () => {
    setDownloadingReport(true)
    try {
      window.open(`/api/companies/${cik}/report`, '_blank')
    } finally {
      setDownloadingReport(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading company data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Not Found</h1>
            <p className="text-gray-600 mb-6">We couldn&apos;t find a company with CIK {cik}</p>
            <Link href="/search">
              <Button>Search Companies</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const latestMetrics = company.metrics?.[0]
  const ratingColors: Record<string, string> = {
    excellent: 'bg-green-100 text-green-800 border-green-300',
    good: 'bg-blue-100 text-blue-800 border-blue-300',
    fair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    poor: 'bg-orange-100 text-orange-800 border-orange-300',
    critical: 'bg-red-100 text-red-800 border-red-300',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="bg-white border-b shadow-sm sticky top-14 sm:top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 sm:py-4">
            {/* Mobile Header */}
            <div className="flex flex-col gap-3 sm:hidden">
              <div className="flex items-center justify-between">
                <Link href="/companies" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadReport}
                    disabled={downloadingReport}
                    className="h-8 px-2"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownloadModel}
                    disabled={downloading}
                    className="h-8 px-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-gray-900 truncate max-w-[200px]">{company.name}</h1>
                  {company.ticker && (
                    <Badge variant="outline" className="font-mono text-xs">{company.ticker}</Badge>
                  )}
                  {intelligence?.earningsQuality && (
                    <Badge className={`text-xs ${ratingColors[intelligence.earningsQuality.overallRating] || 'bg-gray-100'}`}>
                      {intelligence.earningsQuality.overallRating.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  CIK: {company.cik}
                  {company.sector && ` • ${company.sector}`}
                </div>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/companies" className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
                    {company.ticker && (
                      <Badge variant="outline" className="font-mono">{company.ticker}</Badge>
                    )}
                    {intelligence?.earningsQuality && (
                      <Badge className={ratingColors[intelligence.earningsQuality.overallRating] || 'bg-gray-100'}>
                        {intelligence.earningsQuality.overallRating.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>CIK: {company.cik}</span>
                    {company.sector && (
                      <>
                        <span>•</span>
                        <span>{company.sector}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadReport}
                  disabled={downloadingReport}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Report
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadModel}
                  disabled={downloading}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  {downloading ? 'Generating...' : 'Excel Model'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Intelligence Navigation Cards - Horizontal scroll on mobile */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Intelligence Tools</h2>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
            {NAV_ITEMS.map((item, index) => (
              <Link
                key={item.href}
                href={`/companies/${cik}${item.href}`}
                className={`
                  flex-shrink-0 w-[100px] sm:w-auto block p-3 sm:p-4 rounded-xl border-2 transition-all hover:shadow-md active:scale-95
                  ${index === 0
                    ? 'bg-blue-50 border-blue-200 hover:border-blue-400'
                    : 'bg-white border-gray-200 hover:border-blue-300'
                  }
                `}
              >
                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{item.icon}</div>
                <div className="font-medium text-xs sm:text-sm text-gray-900">{item.label}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 line-clamp-2 hidden sm:block">{item.description}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Financial Snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Key Metrics */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Financial Snapshot</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Latest reported metrics</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                {latestMetrics ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Revenue</div>
                      <div className="text-lg sm:text-2xl font-bold">
                        {latestMetrics.revenue ? formatCurrency(latestMetrics.revenue) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Net Income</div>
                      <div className={`text-lg sm:text-2xl font-bold ${latestMetrics.netIncome && latestMetrics.netIncome < 0 ? 'text-red-600' : ''}`}>
                        {latestMetrics.netIncome ? formatCurrency(latestMetrics.netIncome) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Cash</div>
                      <div className="text-lg sm:text-2xl font-bold">
                        {latestMetrics.cashAndEquivalents ? formatCurrency(latestMetrics.cashAndEquivalents) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Total Assets</div>
                      <div className="text-lg sm:text-2xl font-bold">
                        {latestMetrics.totalAssets ? formatCurrency(latestMetrics.totalAssets) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Gross Margin</div>
                      <div className="text-base sm:text-lg font-semibold">
                        {latestMetrics.grossMargin ? formatPercent(latestMetrics.grossMargin * 100) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Operating Margin</div>
                      <div className="text-base sm:text-lg font-semibold">
                        {latestMetrics.operatingMargin ? formatPercent(latestMetrics.operatingMargin * 100) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">R&D Intensity</div>
                      <div className="text-base sm:text-lg font-semibold">
                        {latestMetrics.rdIntensity ? formatPercent(latestMetrics.rdIntensity * 100) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">Cash Runway</div>
                      <div className={`text-base sm:text-lg font-semibold ${latestMetrics.cashRunwayMonths && latestMetrics.cashRunwayMonths < 12 ? 'text-red-600' : ''}`}>
                        {latestMetrics.cashRunwayMonths ? `${latestMetrics.cashRunwayMonths.toFixed(0)}mo` : 'N/A'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <p className="text-sm">No financial metrics available.</p>
                    <Link href={`/companies/${cik}/intelligence`}>
                      <Button variant="outline" size="sm" className="mt-4">
                        Run Intelligence Analysis
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Scores */}
          <div>
            <Card className="h-full">
              <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Quick Scores</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Health indicators</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                {intelligence?.earningsQuality ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium">Overall Rating</span>
                      <Badge className={`text-xs ${ratingColors[intelligence.earningsQuality.overallRating] || 'bg-gray-100'}`}>
                        {intelligence.earningsQuality.overallRating.toUpperCase()}
                      </Badge>
                    </div>
                    {intelligence.earningsQuality.piotroskiFScore !== undefined && (
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs sm:text-sm font-medium">Piotroski F</span>
                        <span className={`font-bold text-sm ${intelligence.earningsQuality.piotroskiFScore >= 7 ? 'text-green-600' : intelligence.earningsQuality.piotroskiFScore >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {intelligence.earningsQuality.piotroskiFScore}/9
                        </span>
                      </div>
                    )}
                    {intelligence.earningsQuality.altmanZ && (
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs sm:text-sm font-medium">Altman Z</span>
                        <span className={`font-bold text-sm ${intelligence.earningsQuality.altmanZ.interpretation === 'safe' ? 'text-green-600' : intelligence.earningsQuality.altmanZ.interpretation === 'gray' ? 'text-yellow-600' : 'text-red-600'}`}>
                          {intelligence.earningsQuality.altmanZ.score.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <Link href={`/companies/${cik}/intelligence`}>
                      <Button variant="outline" size="sm" className="w-full mt-2 h-9">
                        View All Scores
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-4 sm:py-6 text-gray-500">
                    <div className="text-2xl sm:text-3xl mb-2">🎯</div>
                    <p className="text-xs sm:text-sm mb-3 sm:mb-4">Run analysis to see scores</p>
                    <Link href={`/companies/${cik}/intelligence`}>
                      <Button size="sm" className="h-9">Analyze Now</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Filings */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Recent SEC Filings</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Latest regulatory filings</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">{company.filings.length} filings</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {company.filings.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-sm">No filings found for this company.</p>
            ) : (
              <div className="divide-y">
                {company.filings.slice(0, 10).map((filing) => (
                  <Link
                    key={filing.accessionNumber}
                    href={`/filings/${filing.accessionNumber}`}
                    className="flex items-center justify-between py-3 px-4 sm:py-3 sm:-mx-0 sm:px-0 hover:bg-gray-50 sm:hover:bg-transparent transition-colors group active:bg-gray-100"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <Badge
                        className={`text-xs ${
                          filing.formType.includes('10-K') ? 'bg-purple-100 text-purple-800' :
                          filing.formType.includes('10-Q') ? 'bg-blue-100 text-blue-800' :
                          filing.formType.includes('8-K') ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {filing.formType}
                      </Badge>
                      <span className="text-xs sm:text-sm text-gray-600">
                        {formatDate(filing.filingDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono hidden sm:inline">
                        {filing.accessionNumber}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
