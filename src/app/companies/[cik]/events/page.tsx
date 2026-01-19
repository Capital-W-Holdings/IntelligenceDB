'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface EventEntities {
  people: Array<{ name: string; title?: string }>
  amounts: Array<{ value: number; unit: string; context: string }>
  drugs: Array<{ name: string; context: string }>
}

interface EventAnalysis {
  primaryCategory: string
  subCategory?: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  materialityScore: number
  summary: string
  keyPoints: string[]
  investorImplications: string[]
  relatedRisks: string[]
  entities: EventEntities
}

interface SmartEvent {
  id: string
  accessionNumber: string
  filingDate: string
  itemNumber: string
  itemTitle: string
  analysis: EventAnalysis
  textPreview: string
}

interface Company {
  cik: string
  name: string
  ticker: string | null
}

interface ApiResponse {
  company: Company
  totalEvents: number
  categoryDistribution: Record<string, number>
  averageMateriality: number
  highAlertCount: number
  events: SmartEvent[]
  error?: string
}

const categoryColors: Record<string, string> = {
  clinical: 'bg-purple-100 text-purple-800 border-purple-300',
  regulatory: 'bg-blue-100 text-blue-800 border-blue-300',
  financial: 'bg-green-100 text-green-800 border-green-300',
  executive: 'bg-orange-100 text-orange-800 border-orange-300',
  legal: 'bg-red-100 text-red-800 border-red-300',
  strategic: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  operational: 'bg-gray-100 text-gray-800 border-gray-300',
  governance: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  other: 'bg-gray-100 text-gray-600 border-gray-300',
}

const categoryIcons: Record<string, string> = {
  clinical: '🔬',
  regulatory: '📋',
  financial: '💰',
  executive: '👔',
  legal: '⚖️',
  strategic: '🎯',
  operational: '⚙️',
  governance: '🏛️',
  other: '📄',
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  neutral: 'bg-gray-400',
  mixed: 'bg-yellow-500',
}

function MaterialityGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 8) return 'bg-red-500'
    if (score >= 6) return 'bg-orange-500'
    if (score >= 4) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor()}`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className={`text-sm font-bold ${score >= 8 ? 'text-red-600' : score >= 6 ? 'text-orange-600' : ''}`}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

function EventCard({ event, expanded, onToggle }: {
  event: SmartEvent
  expanded: boolean
  onToggle: () => void
}) {
  const analysis = event.analysis

  const formatAmount = (amount: { value: number; unit: string }) => {
    if (amount.value >= 1e9) return `$${(amount.value / 1e9).toFixed(1)}B`
    if (amount.value >= 1e6) return `$${(amount.value / 1e6).toFixed(1)}M`
    return `$${amount.value.toLocaleString()}`
  }

  return (
    <Card className={`transition-all ${analysis.materialityScore >= 8 ? 'border-red-300 shadow-md' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={categoryColors[analysis.primaryCategory]}>
                {categoryIcons[analysis.primaryCategory]} {analysis.primaryCategory}
              </Badge>
              {analysis.subCategory && (
                <Badge variant="outline">{analysis.subCategory}</Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Item {event.itemNumber}
              </Badge>
              <div className={`w-2 h-2 rounded-full ${sentimentColors[analysis.sentiment]}`} title={`Sentiment: ${analysis.sentiment}`} />
            </div>
            <CardTitle className="text-base font-medium">
              {event.itemTitle}
            </CardTitle>
            <CardDescription className="mt-1">
              {formatDate(event.filingDate)} · {event.accessionNumber}
            </CardDescription>
          </div>
          <div className="w-32 text-right">
            <div className="text-xs text-gray-500 mb-1">Materiality</div>
            <MaterialityGauge score={analysis.materialityScore} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <p className="text-sm text-gray-700 mb-4">{analysis.summary}</p>

        {/* Quick Stats Row */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          {analysis.entities.amounts.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-gray-500">💵</span>
              <span className="font-medium">
                {analysis.entities.amounts.map(a => formatAmount(a)).join(', ')}
              </span>
            </div>
          )}
          {analysis.entities.people.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-gray-500">👤</span>
              <span className="font-medium">
                {analysis.entities.people.map(p => p.name).join(', ')}
              </span>
            </div>
          )}
          {analysis.entities.drugs.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-gray-500">💊</span>
              <span className="font-medium">
                {analysis.entities.drugs.map(d => d.name).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Key Points */}
        {analysis.keyPoints.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-1">Key Points</div>
            <ul className="text-sm space-y-1">
              {analysis.keyPoints.slice(0, expanded ? undefined : 3).map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {expanded && (
          <>
            {/* Investor Implications */}
            {analysis.investorImplications.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-700 mb-1">Investor Implications</div>
                <ul className="text-sm text-blue-800 space-y-1">
                  {analysis.investorImplications.map((impl, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span>→</span>
                      {impl}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Risks */}
            {analysis.relatedRisks.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Related Risk Areas</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.relatedRisks.map((risk, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                      ⚠️ {risk}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Text Preview */}
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs font-medium text-gray-500 mb-2">Filing Text Preview</div>
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border max-h-48 overflow-y-auto">
                {event.textPreview}
              </div>
            </div>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="mt-2 text-xs"
        >
          {expanded ? 'Show less' : 'Show details'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SmartEventsPage() {
  const params = useParams()
  const cik = params.cik as string
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterMinMateriality, setFilterMinMateriality] = useState<number>(0)

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams()
        params.set('limit', '30')
        if (filterCategory) params.set('category', filterCategory)
        if (filterMinMateriality > 0) params.set('minMateriality', filterMinMateriality.toString())

        const response = await fetch(`/api/companies/${cik}/smart-events?${params}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching smart events:', error)
      } finally {
        setLoading(false)
      }
    }

    if (cik) {
      fetchData()
    }
  }, [cik, filterCategory, filterMinMateriality])

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedCards)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedCards(next)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing 8-K events...</p>
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
            {data?.error || 'Failed to load smart events analysis.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const categories = Object.keys(data.categoryDistribution || {})

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
          <h1 className="text-3xl font-bold text-gray-900">Smart Events Analysis</h1>
          <p className="text-gray-600 mt-1">
            {data.company?.name} ({data.company?.ticker})
          </p>
          <p className="text-sm text-gray-500 mt-1">
            AI-enhanced 8-K categorization with materiality scoring
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.totalEvents}</div>
            <div className="text-sm text-gray-500">Total Events</div>
          </CardContent>
        </Card>
        <Card className={data.highAlertCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${data.highAlertCount > 0 ? 'text-red-600' : ''}`}>
              {data.highAlertCount}
            </div>
            <div className={`text-sm ${data.highAlertCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
              High Alert Events
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.averageMateriality}</div>
            <div className="text-sm text-gray-500">Avg Materiality</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{categories.length}</div>
            <div className="text-sm text-gray-500">Categories</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Events by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  filterCategory === cat
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{categoryIcons[cat]}</span>
                <span className="capitalize">{cat}</span>
                <Badge variant="secondary" className="ml-2">
                  {data.categoryDistribution[cat]}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Materiality Filter */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-gray-500">Min Materiality:</span>
        <div className="flex gap-2">
          {[0, 5, 7, 8].map(level => (
            <Badge
              key={level}
              variant={filterMinMateriality === level ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterMinMateriality(filterMinMateriality === level ? 0 : level)}
            >
              {level === 0 ? 'All' : `≥ ${level}`}
            </Badge>
          ))}
        </div>
        {(filterCategory || filterMinMateriality > 0) && (
          <button
            onClick={() => {
              setFilterCategory(null)
              setFilterMinMateriality(0)
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {data.events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No events match the current filters.
            </CardContent>
          </Card>
        ) : (
          data.events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              expanded={expandedCards.has(event.id)}
              onToggle={() => toggleExpanded(event.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
