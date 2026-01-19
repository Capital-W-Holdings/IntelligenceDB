'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface RiskFactorDiff {
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

interface RiskAnalysis {
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

interface Company {
  cik: string
  name: string
  ticker: string | null
}

interface ApiResponse {
  company: Company
  currentFiling?: {
    accessionNumber: string
    year: number
    riskCount: number
  }
  priorFiling?: {
    accessionNumber: string
    year: number
    riskCount: number
  }
  analysis?: RiskAnalysis
  error?: string
}

const severityColors = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  moderate: 'bg-yellow-500',
  low: 'bg-blue-500',
  minimal: 'bg-green-500',
}

const severityLabels = {
  critical: 'Critical Changes',
  high: 'High Significance',
  moderate: 'Moderate Changes',
  low: 'Low Significance',
  minimal: 'Minimal Changes',
}

const changeTypeColors = {
  added: 'bg-red-100 text-red-800 border-red-300',
  removed: 'bg-gray-100 text-gray-800 border-gray-300',
  modified: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  unchanged: 'bg-green-100 text-green-800 border-green-300',
}

const changeTypeLabels = {
  added: 'New Risk',
  removed: 'Removed',
  modified: 'Modified',
  unchanged: 'Unchanged',
}

const categoryIcons: Record<string, string> = {
  regulatory: '📋',
  clinical: '🔬',
  competitive: '🏆',
  financial: '💰',
  operational: '⚙️',
  ip: '📜',
  legal: '⚖️',
  reimbursement: '💳',
  cybersecurity: '🔒',
  general: '📄',
}

function MaterialityBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 8 ? 'bg-red-500' :
            score >= 6 ? 'bg-orange-500' :
            score >= 4 ? 'bg-yellow-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function RiskChangeCard({ change, expanded, onToggle }: {
  change: RiskFactorDiff
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Card className={`border-l-4 ${
      change.changeType === 'added' ? 'border-l-red-500' :
      change.changeType === 'removed' ? 'border-l-gray-500' :
      change.changeType === 'modified' ? 'border-l-yellow-500' :
      'border-l-green-500'
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={changeTypeColors[change.changeType]}>
                {changeTypeLabels[change.changeType]}
              </Badge>
              <Badge variant="outline">
                {categoryIcons[change.category]} {change.category}
              </Badge>
              {change.changePercent && change.changeType === 'modified' && (
                <span className="text-xs text-gray-500">
                  {change.changePercent}% changed
                </span>
              )}
            </div>
            <CardTitle className="text-base font-medium line-clamp-2">
              {change.title}
            </CardTitle>
          </div>
          <div className="w-32">
            {change.materialityScore !== undefined && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Materiality</div>
                <MaterialityBar score={change.materialityScore} />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {change.summary && (
          <p className="text-sm text-gray-600 mb-3">{change.summary}</p>
        )}

        {(change.addedText?.length || change.removedText?.length) ? (
          <div className="space-y-2 mb-3">
            {change.addedText && change.addedText.length > 0 && (
              <div>
                <div className="text-xs font-medium text-green-700 mb-1">Added text:</div>
                <ul className="text-xs space-y-1">
                  {change.addedText.slice(0, 3).map((text, i) => (
                    <li key={i} className="bg-green-50 p-2 rounded border border-green-200 line-clamp-2">
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {change.removedText && change.removedText.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-700 mb-1">Removed text:</div>
                <ul className="text-xs space-y-1">
                  {change.removedText.slice(0, 3).map((text, i) => (
                    <li key={i} className="bg-red-50 p-2 rounded border border-red-200 line-clamp-2">
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-xs"
        >
          {expanded ? 'Show less' : 'Show full content'}
        </Button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {change.diffHtml ? (
              <div>
                <div className="text-xs font-medium mb-2">Diff View (first 2000 chars):</div>
                <div
                  className="text-xs bg-gray-50 p-4 rounded border overflow-auto max-h-96"
                  dangerouslySetInnerHTML={{ __html: change.diffHtml }}
                />
              </div>
            ) : (
              <>
                {change.currentContent && (
                  <div>
                    <div className="text-xs font-medium text-green-700 mb-2">Current Content:</div>
                    <div className="text-xs bg-green-50 p-4 rounded border border-green-200 overflow-auto max-h-48">
                      {change.currentContent.substring(0, 1500)}
                      {change.currentContent.length > 1500 && '...'}
                    </div>
                  </div>
                )}
                {change.priorContent && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-2">Prior Content:</div>
                    <div className="text-xs bg-gray-50 p-4 rounded border overflow-auto max-h-48">
                      {change.priorContent.substring(0, 1500)}
                      {change.priorContent.length > 1500 && '...'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function RiskFactorsPage() {
  const params = useParams()
  const cik = params.cik as string
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterChangeType, setFilterChangeType] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/companies/${cik}/risk-factors`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching risk factor analysis:', error)
      } finally {
        setLoading(false)
      }
    }

    if (cik) {
      fetchData()
    }
  }, [cik])

  const toggleExpanded = (index: number) => {
    const next = new Set(expandedCards)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setExpandedCards(next)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing risk factors between filings...</p>
          <p className="mt-1 text-sm text-gray-500">This may take a moment</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Failed to load risk factor analysis.</p>
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href={`/companies/${cik}`}>
            <Button variant="outline" size="sm">← Back to Company</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{data.company?.name || 'Company'}</CardTitle>
            <CardDescription>Risk Factor Analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{data.error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const analysis = data.analysis!
  const filteredChanges = analysis.changes.filter(c => {
    if (filterCategory && c.category !== filterCategory) return false
    if (filterChangeType && c.changeType !== filterChangeType) return false
    return true
  })

  const categories = Object.keys(analysis.categoryBreakdown || {})

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
          <h1 className="text-3xl font-bold text-gray-900">Risk Factor Analysis</h1>
          <p className="text-gray-600 mt-1">
            {data.company?.name} ({data.company?.ticker})
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Comparing FY{analysis.currentFilingYear} to FY{analysis.priorFilingYear}
          </p>
        </div>

        {/* Overall Severity Badge */}
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-1">Overall Change Severity</div>
          <Badge className={`${severityColors[analysis.overallSeverity]} text-white text-lg px-4 py-1`}>
            {severityLabels[analysis.overallSeverity]}
          </Badge>
        </div>
      </div>

      {/* Key Insights */}
      {analysis.keyInsights.length > 0 && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {analysis.keyInsights.map((insight, i) => (
                <li key={i} className="text-sm">{insight}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{analysis.totalRisks.current}</div>
            <div className="text-sm text-gray-500">Current Risks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{analysis.totalRisks.prior}</div>
            <div className="text-sm text-gray-500">Prior Risks</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700">{analysis.totalRisks.added}</div>
            <div className="text-sm text-red-600">New Risks</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-700">{analysis.totalRisks.modified}</div>
            <div className="text-sm text-yellow-600">Modified</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{analysis.totalRisks.removed}</div>
            <div className="text-sm text-gray-500">Removed</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Changes by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map(cat => {
              const stats = analysis.categoryBreakdown[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    filterCategory === cat
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{categoryIcons[cat]}</span>
                    <span className="text-sm font-medium capitalize">{cat}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {stats.current} risks
                    {stats.added > 0 && <span className="text-red-600"> (+{stats.added})</span>}
                    {stats.removed > 0 && <span className="text-gray-500"> (-{stats.removed})</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-gray-500">Filter by:</span>
        <div className="flex gap-2">
          {(['added', 'modified', 'removed'] as const).map(type => (
            <Badge
              key={type}
              variant={filterChangeType === type ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterChangeType(filterChangeType === type ? null : type)}
            >
              {changeTypeLabels[type]} ({analysis.changes.filter(c => c.changeType === type).length})
            </Badge>
          ))}
        </div>
        {(filterCategory || filterChangeType) && (
          <button
            onClick={() => {
              setFilterCategory(null)
              setFilterChangeType(null)
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Risk Changes List */}
      <div className="space-y-4">
        {filteredChanges.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No changes match the current filters.
            </CardContent>
          </Card>
        ) : (
          filteredChanges.map((change, idx) => (
            <RiskChangeCard
              key={idx}
              change={change}
              expanded={expandedCards.has(idx)}
              onToggle={() => toggleExpanded(idx)}
            />
          ))
        )}
      </div>

      {/* Filing Sources */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Current Filing (FY{data.currentFiling?.year})</div>
              <div className="text-gray-500">{data.currentFiling?.accessionNumber}</div>
              <div className="text-gray-500">{data.currentFiling?.riskCount} risk factors extracted</div>
            </div>
            <div>
              <div className="font-medium">Prior Filing (FY{data.priorFiling?.year})</div>
              <div className="text-gray-500">{data.priorFiling?.accessionNumber}</div>
              <div className="text-gray-500">{data.priorFiling?.riskCount} risk factors extracted</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
