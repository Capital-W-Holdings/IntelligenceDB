'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, truncate } from '@/lib/utils'

interface FilingSection {
  id: string
  sectionType: string
  content: string
}

interface FilingEvent {
  id: string
  itemNumber: string
  itemTitle: string
  summary: string | null
  eventType: string | null
  eventDate: string | null
}

interface XBRLFact {
  id: string
  concept: string
  value: string
  unitRef: string | null
  period: string | null
  contextRef: string | null
}

interface RiskFactor {
  id: string
  title: string
  content: string
  riskCategory: string | null
}

interface Filing {
  accessionNumber: string
  formType: string
  filingDate: string
  periodOfReport: string | null
  filingUrl: string
  primaryDocument: string | null
  company: {
    cik: string
    name: string
    ticker: string | null
    sector: string | null
  }
  sections: FilingSection[]
  events: FilingEvent[]
  xbrlFacts: XBRLFact[]
  riskFactors: RiskFactor[]
}

export default function FilingDetailPage() {
  const params = useParams()
  const accessionNumber = params.accessionNumber as string
  const [filing, setFiling] = useState<Filing | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'events' | 'xbrl' | 'sections' | 'risks'>('events')

  useEffect(() => {
    async function fetchFiling() {
      setLoading(true)
      try {
        const response = await fetch(`/api/filings/${accessionNumber}`)
        if (response.ok) {
          const data = await response.json()
          setFiling(data)
          // Set default tab based on filing type
          if (data.formType === '8-K' && data.events.length > 0) {
            setActiveTab('events')
          } else if (data.xbrlFacts.length > 0) {
            setActiveTab('xbrl')
          } else if (data.sections.length > 0) {
            setActiveTab('sections')
          }
        }
      } catch (error) {
        console.error('Error fetching filing:', error)
      } finally {
        setLoading(false)
      }
    }

    if (accessionNumber) {
      fetchFiling()
    }
  }, [accessionNumber])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading filing...</p>
        </div>
      </div>
    )
  }

  if (!filing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Filing not found.</p>
          <Link href="/filings">
            <Button className="mt-4">Back to Filings</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant={
                  filing.formType === '8-K'
                    ? 'default'
                    : filing.formType === '10-K'
                    ? 'secondary'
                    : 'outline'
                }
                className="text-lg"
              >
                {filing.formType}
              </Badge>
              <Link href={`/companies/${filing.company.cik}`} className="hover:underline">
                <h1 className="text-2xl font-bold text-gray-900">
                  {filing.company.name}
                  {filing.company.ticker && (
                    <span className="ml-2 font-mono text-gray-500">
                      ({filing.company.ticker})
                    </span>
                  )}
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-4 text-gray-600 text-sm">
              <span>Filed: {formatDate(filing.filingDate)}</span>
              {filing.periodOfReport && (
                <span>Period: {formatDate(filing.periodOfReport)}</span>
              )}
              <span className="font-mono">{filing.accessionNumber}</span>
            </div>
          </div>
          <a
            href={filing.filingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <Button variant="outline">View on SEC</Button>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {filing.events.length > 0 && (
            <button
              onClick={() => setActiveTab('events')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'events'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Events ({filing.events.length})
            </button>
          )}
          {filing.xbrlFacts.length > 0 && (
            <button
              onClick={() => setActiveTab('xbrl')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'xbrl'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              XBRL Facts ({filing.xbrlFacts.length})
            </button>
          )}
          {filing.sections.length > 0 && (
            <button
              onClick={() => setActiveTab('sections')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sections'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sections ({filing.sections.length})
            </button>
          )}
          {filing.riskFactors.length > 0 && (
            <button
              onClick={() => setActiveTab('risks')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'risks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Risk Factors ({filing.riskFactors.length})
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {filing.events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Item {event.itemNumber}: {event.itemTitle}
                    </CardTitle>
                    {event.eventType && (
                      <Badge variant="secondary" className="mt-1">
                        {event.eventType}
                      </Badge>
                    )}
                  </div>
                  {event.eventDate && (
                    <span className="text-sm text-gray-500">
                      {formatDate(event.eventDate)}
                    </span>
                  )}
                </div>
              </CardHeader>
              {event.summary && (
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{event.summary}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'xbrl' && (
        <Card>
          <CardHeader>
            <CardTitle>XBRL Financial Facts</CardTitle>
            <CardDescription>Extracted financial data from XBRL filing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Concept</th>
                    <th className="text-right py-2 px-2">Value</th>
                    <th className="text-left py-2 px-2">Period</th>
                    <th className="text-left py-2 px-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {filing.xbrlFacts.slice(0, 100).map((fact) => (
                    <tr key={fact.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">{fact.concept}</td>
                      <td className="py-2 px-2 text-right">
                        {fact.unitRef === 'USD'
                          ? formatCurrency(parseFloat(fact.value))
                          : fact.value}
                      </td>
                      <td className="py-2 px-2 text-gray-500">{fact.period || '-'}</td>
                      <td className="py-2 px-2 text-gray-500">{fact.unitRef || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filing.xbrlFacts.length > 100 && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Showing first 100 of {filing.xbrlFacts.length} facts
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'sections' && (
        <div className="space-y-4">
          {filing.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-lg">{section.sectionType}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-gray-700">
                    {truncate(section.content, 2000)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="space-y-4">
          {filing.riskFactors.map((risk) => (
            <Card key={risk.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{risk.title}</CardTitle>
                  {risk.riskCategory && (
                    <Badge variant="secondary">{risk.riskCategory}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {truncate(risk.content, 1000)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
