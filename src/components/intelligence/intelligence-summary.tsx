'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface IntelligenceSummaryProps {
  cik: string
  earningsQuality?: {
    overallRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    piotroskiFScore?: number
    altmanZ?: { score: number; interpretation: string }
    beneishM?: { score: number; interpretation: string }
  }
  riskFactors?: {
    totalChanges: number
    added: number
    severity: 'critical' | 'high' | 'moderate' | 'low' | 'minimal'
  }
  insiderTrading?: {
    sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed'
    sentimentScore: number
    recentBuys: number
    recentSells: number
    netValue: number
  }
  events8K?: {
    totalEvents: number
    highAlertCount: number
    avgMateriality: number
  }
}

const ratingColors = {
  excellent: 'bg-green-100 text-green-800 border-green-300',
  good: 'bg-blue-100 text-blue-800 border-blue-300',
  fair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  poor: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
}

const sentimentColors = {
  bullish: 'bg-green-100 text-green-800',
  bearish: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-600',
  mixed: 'bg-yellow-100 text-yellow-800',
}

const sentimentEmoji = {
  bullish: '📈',
  bearish: '📉',
  neutral: '➖',
  mixed: '📊',
}

const severityColors = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-white',
  low: 'bg-blue-500 text-white',
  minimal: 'bg-green-500 text-white',
}

function ScoreCircle({ score, max, label, color }: { score: number; max: number; label: string; color: string }) {
  const percentage = (score / max) * 100
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke="#e5e7eb"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{score}</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  )
}

export function IntelligenceSummary({
  cik,
  earningsQuality,
  riskFactors,
  insiderTrading,
  events8K,
}: IntelligenceSummaryProps) {
  const formatCurrency = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1e9) return `${value >= 0 ? '+' : '-'}$${(abs / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `${value >= 0 ? '+' : '-'}$${(abs / 1e6).toFixed(1)}M`
    if (abs >= 1e3) return `${value >= 0 ? '+' : '-'}$${(abs / 1e3).toFixed(0)}K`
    return `${value >= 0 ? '+' : '-'}$${abs.toFixed(0)}`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Earnings Quality Card */}
      <Link href={`/companies/${cik}/intelligence`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                Earnings Quality
              </CardTitle>
              <span className="text-lg">🎯</span>
            </div>
          </CardHeader>
          <CardContent>
            {earningsQuality ? (
              <>
                <Badge className={`${ratingColors[earningsQuality.overallRating]} mb-3`}>
                  {earningsQuality.overallRating.charAt(0).toUpperCase() + earningsQuality.overallRating.slice(1)}
                </Badge>
                <div className="flex justify-around">
                  {earningsQuality.piotroskiFScore !== undefined && (
                    <ScoreCircle
                      score={earningsQuality.piotroskiFScore}
                      max={9}
                      label="Piotroski"
                      color={earningsQuality.piotroskiFScore >= 7 ? '#22c55e' : earningsQuality.piotroskiFScore >= 4 ? '#eab308' : '#ef4444'}
                    />
                  )}
                  {earningsQuality.altmanZ && (
                    <ScoreCircle
                      score={Math.round(earningsQuality.altmanZ.score * 10) / 10}
                      max={5}
                      label="Altman Z"
                      color={earningsQuality.altmanZ.interpretation === 'safe' ? '#22c55e' : earningsQuality.altmanZ.interpretation === 'gray' ? '#eab308' : '#ef4444'}
                    />
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Click to analyze</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Risk Factors Card */}
      <Link href={`/companies/${cik}/risk-factors`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                Risk Factors
              </CardTitle>
              <span className="text-lg">⚠️</span>
            </div>
          </CardHeader>
          <CardContent>
            {riskFactors ? (
              <>
                <Badge className={severityColors[riskFactors.severity]}>
                  {riskFactors.severity.charAt(0).toUpperCase() + riskFactors.severity.slice(1)} Changes
                </Badge>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-red-600">+{riskFactors.added}</div>
                    <div className="text-xs text-gray-500">New Risks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{riskFactors.totalChanges}</div>
                    <div className="text-xs text-gray-500">Total Changes</div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Click to analyze</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Insider Trading Card */}
      <Link href={`/companies/${cik}/insiders`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                Insider Trading
              </CardTitle>
              <span className="text-lg">👔</span>
            </div>
          </CardHeader>
          <CardContent>
            {insiderTrading ? (
              <>
                <Badge className={sentimentColors[insiderTrading.sentiment]}>
                  {sentimentEmoji[insiderTrading.sentiment]} {insiderTrading.sentiment.charAt(0).toUpperCase() + insiderTrading.sentiment.slice(1)}
                </Badge>
                <div className="mt-3">
                  <div className={`text-xl font-bold ${insiderTrading.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(insiderTrading.netValue)}
                  </div>
                  <div className="text-xs text-gray-500">Net (30 days)</div>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span className="text-green-600">{insiderTrading.recentBuys} buys</span>
                    <span className="text-red-600">{insiderTrading.recentSells} sells</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Click to analyze</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* 8-K Events Card */}
      <Link href={`/companies/${cik}/events`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                8-K Events
              </CardTitle>
              <span className="text-lg">📰</span>
            </div>
          </CardHeader>
          <CardContent>
            {events8K ? (
              <>
                {events8K.highAlertCount > 0 ? (
                  <Badge className="bg-red-100 text-red-800">
                    {events8K.highAlertCount} High Alert
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-600">
                    Normal Activity
                  </Badge>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold">{events8K.totalEvents}</div>
                    <div className="text-xs text-gray-500">Recent Events</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{events8K.avgMateriality.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">Avg Materiality</div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Click to analyze</p>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
