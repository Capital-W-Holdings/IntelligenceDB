'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, formatPercent } from '@/lib/utils'

interface DiffResult {
  filing1: {
    accessionNumber: string
    formType: string
    filingDate: string
    company: {
      name: string
      ticker: string | null
    }
  }
  filing2: {
    accessionNumber: string
    formType: string
    filingDate: string
    company: {
      name: string
      ticker: string | null
    }
  }
  sections: {
    sectionType: string
    sectionTitle: string
    inFiling1: boolean
    inFiling2: boolean
    wordCount1: number | null
    wordCount2: number | null
    wordCountDiff: number | null
  }[]
  xbrlDiffs: {
    tag: string
    label: string | null
    value1: string | null
    value2: string | null
    unit: string | null
    periodEnd: string | null
    percentChange: number | null
  }[]
  eventDiffs: {
    itemNumber: string
    itemTitle: string
    inFiling1: boolean
    inFiling2: boolean
    eventType1: string | null
    eventType2: string | null
  }[]
}

export default function FilingDiffPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const accessionNumber = params.accessionNumber as string
  const compareWith = searchParams.get('compare')

  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDiff() {
      if (!compareWith) {
        setError('No comparison filing specified. Add ?compare=ACCESSION_NUMBER to the URL.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/filings/${accessionNumber}/diff/${compareWith}`)
        if (response.ok) {
          const data = await response.json()
          setDiff(data)
        } else {
          const errData = await response.json()
          setError(errData.error || 'Failed to load diff')
        }
      } catch (err) {
        console.error('Error fetching diff:', err)
        setError('Failed to fetch filing diff')
      } finally {
        setLoading(false)
      }
    }

    if (accessionNumber) {
      fetchDiff()
    }
  }, [accessionNumber, compareWith])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Comparing filings...</p>
        </div>
      </div>
    )
  }

  if (error || !diff) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || 'Diff not available.'}</p>
          <Link href={`/filings/${accessionNumber}`}>
            <Button className="mt-4">Back to Filing</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Filing Comparison</h1>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <Badge variant="secondary" className="w-fit mb-2">Older Filing</Badge>
              <CardTitle className="text-lg">
                <Link href={`/filings/${diff.filing1.accessionNumber}`} className="hover:underline">
                  {diff.filing1.formType}
                </Link>
              </CardTitle>
              <CardDescription>
                {diff.filing1.company.name}
                {diff.filing1.company.ticker && ` (${diff.filing1.company.ticker})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Filed: {formatDate(diff.filing1.filingDate)}</p>
              <p className="text-xs font-mono text-gray-400">{diff.filing1.accessionNumber}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <Badge variant="default" className="w-fit mb-2">Newer Filing</Badge>
              <CardTitle className="text-lg">
                <Link href={`/filings/${diff.filing2.accessionNumber}`} className="hover:underline">
                  {diff.filing2.formType}
                </Link>
              </CardTitle>
              <CardDescription>
                {diff.filing2.company.name}
                {diff.filing2.company.ticker && ` (${diff.filing2.company.ticker})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Filed: {formatDate(diff.filing2.filingDate)}</p>
              <p className="text-xs font-mono text-gray-400">{diff.filing2.accessionNumber}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* XBRL Diffs */}
      {diff.xbrlDiffs.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Financial Changes</CardTitle>
            <CardDescription>XBRL values that changed between filings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Metric</th>
                    <th className="text-right py-2 px-2">Older Value</th>
                    <th className="text-right py-2 px-2">Newer Value</th>
                    <th className="text-right py-2 px-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.xbrlDiffs.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span>{item.label || item.tag}</span>
                          <span className="text-xs text-gray-400 font-mono">{item.tag}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {item.value1 && item.unit === 'USD'
                          ? formatCurrency(parseFloat(item.value1))
                          : item.value1}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {item.value2 && item.unit === 'USD'
                          ? formatCurrency(parseFloat(item.value2))
                          : item.value2}
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold ${
                        item.percentChange && item.percentChange > 0
                          ? 'text-green-600'
                          : item.percentChange && item.percentChange < 0
                          ? 'text-red-600'
                          : ''
                      }`}>
                        {item.percentChange !== null
                          ? `${item.percentChange > 0 ? '+' : ''}${item.percentChange.toFixed(1)}%`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Diffs */}
      {diff.sections.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Section Changes</CardTitle>
            <CardDescription>Word count changes by section</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Section</th>
                    <th className="text-center py-2 px-2">In Older</th>
                    <th className="text-center py-2 px-2">In Newer</th>
                    <th className="text-right py-2 px-2">Older Words</th>
                    <th className="text-right py-2 px-2">Newer Words</th>
                    <th className="text-right py-2 px-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.sections.map((section, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{section.sectionTitle}</td>
                      <td className="py-2 px-2 text-center">
                        {section.inFiling1 ? (
                          <Badge variant="outline" className="bg-green-50">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50">No</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {section.inFiling2 ? (
                          <Badge variant="outline" className="bg-green-50">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50">No</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {section.wordCount1?.toLocaleString() || '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {section.wordCount2?.toLocaleString() || '-'}
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold ${
                        section.wordCountDiff && section.wordCountDiff > 0
                          ? 'text-green-600'
                          : section.wordCountDiff && section.wordCountDiff < 0
                          ? 'text-red-600'
                          : ''
                      }`}>
                        {section.wordCountDiff !== null
                          ? `${section.wordCountDiff > 0 ? '+' : ''}${section.wordCountDiff.toLocaleString()}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Diffs (for 8-K filings) */}
      {diff.eventDiffs.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Event Comparison</CardTitle>
            <CardDescription>8-K items in each filing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Item</th>
                    <th className="text-left py-2 px-2">Title</th>
                    <th className="text-center py-2 px-2">In Older</th>
                    <th className="text-center py-2 px-2">In Newer</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.eventDiffs.map((event, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-mono">{event.itemNumber}</td>
                      <td className="py-2 px-2">{event.itemTitle}</td>
                      <td className="py-2 px-2 text-center">
                        {event.inFiling1 ? (
                          <Badge variant="outline" className="bg-green-50">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50">No</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {event.inFiling2 ? (
                          <Badge variant="outline" className="bg-green-50">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50">No</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
