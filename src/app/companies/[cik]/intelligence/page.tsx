'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface BeneishMScoreResult {
  mScore: number
  probability: number
  interpretation: 'high_risk' | 'moderate_risk' | 'low_risk'
  components: Record<string, number>
  flags: string[]
}

interface AltmanZScoreResult {
  zScore: number
  interpretation: 'safe' | 'gray_zone' | 'distress'
  probability: number
  components: Record<string, number>
  flags: string[]
}

interface AccrualsQualityResult {
  totalAccruals: number
  accrualsRatio: number
  interpretation: 'high_quality' | 'moderate_quality' | 'low_quality'
  cashConversion: number
  flags: string[]
}

interface CashRunwayResult {
  runwayMonths: number
  interpretation: 'critical' | 'concerning' | 'adequate' | 'strong'
  quarterlyBurnRate: number
  cashPosition: number
  dilutionRisk: 'high' | 'medium' | 'low'
  flags: string[]
}

interface PiotroskiFScoreResult {
  score: number
  interpretation: 'strong' | 'moderate' | 'weak'
  components: {
    profitability: number
    leverage: number
    efficiency: number
  }
  details: Record<string, boolean>
}

interface IntelligenceData {
  company: {
    cik: string
    name: string
    ticker: string | null
    sector: string | null
  }
  fiscalYear: number
  overallRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  redFlags: string[]
  greenFlags: string[]
  scores: {
    beneishMScore?: BeneishMScoreResult
    altmanZScore?: AltmanZScoreResult
    accrualsQuality?: AccrualsQualityResult
    cashRunway?: CashRunwayResult
    piotroskiFScore?: PiotroskiFScoreResult
    dataQuality?: {
      hasCurrentYearData: boolean
      hasPriorYearData: boolean
      availableMetrics: number
    }
  }
  financialInputs: {
    revenue: number
    netIncome: number
    totalAssets: number
    totalLiabilities: number
    cash: number
    operatingCashFlow: number
  }
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`
  }
  return `$${value.toLocaleString()}`
}

function ScoreGauge({
  value,
  min,
  max,
  thresholds,
  label,
  interpretation,
}: {
  value: number
  min: number
  max: number
  thresholds: { value: number; color: string }[]
  label: string
  interpretation: string
}) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  let color = 'bg-neutral-300'
  for (const t of thresholds) {
    if (value >= t.value) color = t.color
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-neutral-600">{label}</span>
        <span className="text-2xl font-bold text-neutral-900">{value.toFixed(2)}</span>
      </div>
      <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">{interpretation}</p>
    </div>
  )
}

function FlagsList({ flags, type }: { flags: string[]; type: 'red' | 'green' }) {
  if (flags.length === 0) return null

  return (
    <div className="space-y-2">
      {flags.map((flag, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 p-3 rounded-lg ${
            type === 'red' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          <span className="mt-0.5">
            {type === 'red' ? '⚠️' : '✓'}
          </span>
          <span className="text-sm">{flag}</span>
        </div>
      ))}
    </div>
  )
}

function ScoreCard({
  title,
  description,
  children,
  interpretation,
  interpretationColor,
}: {
  title: string
  description: string
  children: React.ReactNode
  interpretation?: string
  interpretationColor?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {interpretation && (
            <Badge className={interpretationColor || 'bg-neutral-100 text-neutral-700'}>
              {interpretation}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function IntelligencePage() {
  const params = useParams()
  const cik = params.cik as string

  const [data, setData] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/companies/${cik}/intelligence`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        } else {
          setError('Failed to load intelligence data')
        }
      } catch (err) {
        setError('Error fetching data')
      } finally {
        setLoading(false)
      }
    }

    if (cik) fetchData()
  }, [cik])

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">Analyzing Financials</h3>
          <p className="text-neutral-500">Calculating intelligence scores from SEC filings...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-neutral-50">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Unable to Load Data</h2>
            <p className="text-neutral-600 mb-6">{error}</p>
            <Link href={`/companies/${cik}`}>
              <Button>Back to Company</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ratingColors: Record<string, string> = {
    excellent: 'bg-emerald-500 text-white',
    good: 'bg-emerald-100 text-emerald-800',
    fair: 'bg-amber-100 text-amber-800',
    poor: 'bg-orange-100 text-orange-800',
    critical: 'bg-rose-500 text-white',
  }

  const interpretationColors: Record<string, string> = {
    safe: 'bg-emerald-100 text-emerald-800',
    gray_zone: 'bg-amber-100 text-amber-800',
    distress: 'bg-rose-100 text-rose-800',
    high_risk: 'bg-rose-100 text-rose-800',
    moderate_risk: 'bg-amber-100 text-amber-800',
    low_risk: 'bg-emerald-100 text-emerald-800',
    high_quality: 'bg-emerald-100 text-emerald-800',
    moderate_quality: 'bg-amber-100 text-amber-800',
    low_quality: 'bg-rose-100 text-rose-800',
    strong: 'bg-emerald-100 text-emerald-800',
    moderate: 'bg-amber-100 text-amber-800',
    weak: 'bg-rose-100 text-rose-800',
    critical: 'bg-rose-100 text-rose-800',
    concerning: 'bg-orange-100 text-orange-800',
    adequate: 'bg-amber-100 text-amber-800',
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
                <Link href={`/companies/${cik}`} className="hover:text-blue-600 transition-colors">
                  {data.company.name}
                </Link>
                <span>/</span>
                <span className="text-neutral-900 font-medium">Intelligence</span>
              </div>
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-neutral-900">
                  Earnings Quality & Risk Analysis
                </h1>
                {data.company.ticker && (
                  <Badge variant="outline" className="font-mono">
                    {data.company.ticker}
                  </Badge>
                )}
              </div>
              <p className="text-neutral-500 mt-1">
                FY{data.fiscalYear} Analysis
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500 mb-2">Overall Rating</p>
              <Badge className={`text-lg px-4 py-2 ${ratingColors[data.overallRating]}`}>
                {data.overallRating.charAt(0).toUpperCase() + data.overallRating.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Flags */}
        {(data.redFlags.length > 0 || data.greenFlags.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.redFlags.length > 0 && (
              <Card className="border-rose-200 bg-rose-50/50">
                <CardHeader>
                  <CardTitle className="text-rose-800 flex items-center gap-2">
                    <span>⚠️</span> Red Flags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FlagsList flags={data.redFlags} type="red" />
                </CardContent>
              </Card>
            )}
            {data.greenFlags.length > 0 && (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardHeader>
                  <CardTitle className="text-emerald-800 flex items-center gap-2">
                    <span>✓</span> Positive Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FlagsList flags={data.greenFlags} type="green" />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Beneish M-Score */}
          {data.scores.beneishMScore && (
            <ScoreCard
              title="Beneish M-Score"
              description="Probability of earnings manipulation"
              interpretation={data.scores.beneishMScore.interpretation.replace('_', ' ')}
              interpretationColor={interpretationColors[data.scores.beneishMScore.interpretation]}
            >
              <div className="space-y-4">
                <ScoreGauge
                  value={data.scores.beneishMScore.mScore}
                  min={-4}
                  max={0}
                  thresholds={[
                    { value: -4, color: 'bg-emerald-500' },
                    { value: -2.22, color: 'bg-amber-500' },
                    { value: -1.78, color: 'bg-rose-500' },
                  ]}
                  label="M-Score"
                  interpretation={`${(data.scores.beneishMScore.probability * 100).toFixed(0)}% manipulation probability`}
                />
                <div className="text-xs text-neutral-500">
                  <p>{'>'} -1.78 = High Risk | {'<'} -2.22 = Low Risk</p>
                </div>
                {data.scores.beneishMScore.flags.length > 0 && (
                  <div className="border-t pt-3 mt-3 space-y-1">
                    {data.scores.beneishMScore.flags.map((flag, i) => (
                      <p key={i} className="text-xs text-amber-700">{flag}</p>
                    ))}
                  </div>
                )}
              </div>
            </ScoreCard>
          )}

          {/* Altman Z-Score */}
          {data.scores.altmanZScore && (
            <ScoreCard
              title="Altman Z-Score"
              description="Bankruptcy risk assessment"
              interpretation={data.scores.altmanZScore.interpretation.replace('_', ' ')}
              interpretationColor={interpretationColors[data.scores.altmanZScore.interpretation]}
            >
              <div className="space-y-4">
                <ScoreGauge
                  value={data.scores.altmanZScore.zScore}
                  min={0}
                  max={5}
                  thresholds={[
                    { value: 0, color: 'bg-rose-500' },
                    { value: 1.81, color: 'bg-amber-500' },
                    { value: 2.99, color: 'bg-emerald-500' },
                  ]}
                  label="Z-Score"
                  interpretation={`${(data.scores.altmanZScore.probability * 100).toFixed(0)}% distress probability`}
                />
                <div className="text-xs text-neutral-500">
                  <p>{'>'} 2.99 = Safe | 1.81-2.99 = Gray | {'<'} 1.81 = Distress</p>
                </div>
                {data.scores.altmanZScore.flags.length > 0 && (
                  <div className="border-t pt-3 mt-3 space-y-1">
                    {data.scores.altmanZScore.flags.map((flag, i) => (
                      <p key={i} className="text-xs text-rose-700">{flag}</p>
                    ))}
                  </div>
                )}
              </div>
            </ScoreCard>
          )}

          {/* Piotroski F-Score */}
          {data.scores.piotroskiFScore && (
            <ScoreCard
              title="Piotroski F-Score"
              description="Financial strength indicator"
              interpretation={data.scores.piotroskiFScore.interpretation}
              interpretationColor={interpretationColors[data.scores.piotroskiFScore.interpretation]}
            >
              <div className="space-y-4">
                <div className="text-center py-4">
                  <span className="text-5xl font-bold text-neutral-900">
                    {data.scores.piotroskiFScore.score}
                  </span>
                  <span className="text-2xl text-neutral-400">/9</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-neutral-100 rounded-lg p-2">
                    <p className="text-neutral-500">Profitability</p>
                    <p className="font-bold">{data.scores.piotroskiFScore.components.profitability}/4</p>
                  </div>
                  <div className="bg-neutral-100 rounded-lg p-2">
                    <p className="text-neutral-500">Leverage</p>
                    <p className="font-bold">{data.scores.piotroskiFScore.components.leverage}/3</p>
                  </div>
                  <div className="bg-neutral-100 rounded-lg p-2">
                    <p className="text-neutral-500">Efficiency</p>
                    <p className="font-bold">{data.scores.piotroskiFScore.components.efficiency}/2</p>
                  </div>
                </div>
              </div>
            </ScoreCard>
          )}

          {/* Accruals Quality */}
          {data.scores.accrualsQuality && (
            <ScoreCard
              title="Accruals Quality"
              description="Earnings sustainability analysis"
              interpretation={data.scores.accrualsQuality.interpretation.replace(/_/g, ' ')}
              interpretationColor={interpretationColors[data.scores.accrualsQuality.interpretation]}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Cash Conversion</p>
                    <p className={`text-xl font-bold ${
                      data.scores.accrualsQuality.cashConversion >= 1 ? 'text-emerald-600' :
                      data.scores.accrualsQuality.cashConversion >= 0.7 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {(data.scores.accrualsQuality.cashConversion * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-neutral-400">OCF / Net Income</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Accruals Ratio</p>
                    <p className={`text-xl font-bold ${
                      data.scores.accrualsQuality.accrualsRatio < 0.05 ? 'text-emerald-600' :
                      data.scores.accrualsQuality.accrualsRatio < 0.10 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {(data.scores.accrualsQuality.accrualsRatio * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-neutral-400">Accruals / Assets</p>
                  </div>
                </div>
                {data.scores.accrualsQuality.flags.length > 0 && (
                  <div className="border-t pt-3 mt-3 space-y-1">
                    {data.scores.accrualsQuality.flags.map((flag, i) => (
                      <p key={i} className="text-xs text-amber-700">{flag}</p>
                    ))}
                  </div>
                )}
              </div>
            </ScoreCard>
          )}

          {/* Cash Runway */}
          {data.scores.cashRunway && (
            <ScoreCard
              title="Cash Runway"
              description="Months until financing needed"
              interpretation={data.scores.cashRunway.interpretation}
              interpretationColor={interpretationColors[data.scores.cashRunway.interpretation]}
            >
              <div className="space-y-4">
                <div className="text-center py-4">
                  <span className={`text-5xl font-bold ${
                    data.scores.cashRunway.runwayMonths >= 24 ? 'text-emerald-600' :
                    data.scores.cashRunway.runwayMonths >= 12 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {data.scores.cashRunway.runwayMonths}
                  </span>
                  <span className="text-2xl text-neutral-400"> months</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">Cash Position</p>
                    <p className="font-bold">{formatCurrency(data.scores.cashRunway.cashPosition)}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">Quarterly Burn</p>
                    <p className="font-bold text-rose-600">
                      ({formatCurrency(data.scores.cashRunway.quarterlyBurnRate)})
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-neutral-50 rounded-lg p-3">
                  <span className="text-sm text-neutral-600">Dilution Risk</span>
                  <Badge className={
                    data.scores.cashRunway.dilutionRisk === 'high' ? 'bg-rose-100 text-rose-800' :
                    data.scores.cashRunway.dilutionRisk === 'medium' ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-800'
                  }>
                    {data.scores.cashRunway.dilutionRisk}
                  </Badge>
                </div>
                {data.scores.cashRunway.flags.length > 0 && (
                  <div className="border-t pt-3 mt-3 space-y-1">
                    {data.scores.cashRunway.flags.map((flag, i) => (
                      <p key={i} className="text-xs text-amber-700">{flag}</p>
                    ))}
                  </div>
                )}
              </div>
            </ScoreCard>
          )}

          {/* Key Financials */}
          <ScoreCard
            title="Key Financials"
            description={`FY${data.fiscalYear} snapshot`}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Revenue</span>
                <span className="font-bold">{formatCurrency(data.financialInputs.revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Net Income</span>
                <span className={`font-bold ${data.financialInputs.netIncome < 0 ? 'text-rose-600' : ''}`}>
                  {formatCurrency(data.financialInputs.netIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Total Assets</span>
                <span className="font-bold">{formatCurrency(data.financialInputs.totalAssets)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Cash</span>
                <span className="font-bold">{formatCurrency(data.financialInputs.cash)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-neutral-600">Operating Cash Flow</span>
                <span className={`font-bold ${data.financialInputs.operatingCashFlow < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(data.financialInputs.operatingCashFlow)}
                </span>
              </div>
            </div>
          </ScoreCard>
        </div>

        {/* Data Quality Notice */}
        {data.scores.dataQuality && (
          <Card className="bg-neutral-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-neutral-600">Data Quality:</span>
                  <Badge variant="outline">
                    {data.scores.dataQuality.availableMetrics} metrics available
                  </Badge>
                  {data.scores.dataQuality.hasPriorYearData ? (
                    <Badge className="bg-emerald-100 text-emerald-800">Prior year data available</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Limited historical data</Badge>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  Data sourced from SEC EDGAR XBRL filings
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4">
          <Link href={`/companies/${cik}`}>
            <Button variant="outline">← Back to Company</Button>
          </Link>
          <Link href={`/companies/${cik}/model`}>
            <Button>View Financial Model →</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
