'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface SearchResults {
  companies: Array<{
    cik: string
    name: string
    ticker: string | null
    sector: string | null
  }>
  filings: Array<{
    accessionNumber: string
    formType: string
    filingDate: string
    company: {
      cik: string
      name: string
      ticker: string | null
    }
  }>
  events: Array<{
    id: string
    itemTitle: string
    summary: string | null
    eventType: string | null
    eventDate: string | null
    filing: {
      accessionNumber: string
      formType: string
      filingDate: string
      company: {
        cik: string
        name: string
        ticker: string | null
      }
    }
  }>
}

const SEARCH_SUGGESTIONS = [
  'FDA approval',
  'clinical trial',
  'acquisition',
  'merger',
  'Phase 3',
  'revenue',
  'guidance',
  'executive',
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(searchQuery?: string) {
    const q = searchQuery || query
    if (!q || q.length < 2) return

    setLoading(true)
    setSearched(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch()
  }

  const totalResults =
    (results?.companies.length || 0) +
    (results?.filings.length || 0) +
    (results?.events.length || 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search</h1>
        <p className="text-gray-600">
          Search across companies, filings, and healthcare events
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <Input
            type="text"
            placeholder="Search for FDA approvals, clinical trials, acquisitions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-lg"
          />
          <Button type="submit" disabled={loading || query.length < 2}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </form>

        {!searched && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Try searching for:</p>
            <div className="flex flex-wrap gap-2">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery(suggestion)
                    handleSearch(suggestion)
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Searching...</p>
        </div>
      ) : searched && results ? (
        <>
          <p className="text-gray-600 mb-6">
            Found {totalResults} result{totalResults !== 1 ? 's' : ''} for &quot;{query}&quot;
          </p>

          {/* Companies */}
          {results.companies.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Companies ({results.companies.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.companies.map((company) => (
                  <Link key={company.cik} href={`/companies/${company.cik}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        <CardDescription>
                          {company.ticker && (
                            <span className="font-mono font-bold text-gray-900">
                              {company.ticker}
                            </span>
                          )}
                          {company.ticker && ' · '}
                          CIK: {company.cik}
                        </CardDescription>
                      </CardHeader>
                      {company.sector && (
                        <CardContent>
                          <Badge variant="secondary">{company.sector}</Badge>
                        </CardContent>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Filings */}
          {results.filings.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Filings ({results.filings.length})
              </h2>
              <div className="space-y-3">
                {results.filings.map((filing) => (
                  <Link key={filing.accessionNumber} href={`/filings/${filing.accessionNumber}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Badge
                              variant={filing.formType === '8-K' ? 'default' : 'secondary'}
                            >
                              {filing.formType}
                            </Badge>
                            <div>
                              <p className="font-medium">{filing.company.name}</p>
                              <p className="text-sm text-gray-500">
                                {filing.company.ticker && (
                                  <span className="font-mono">{filing.company.ticker} · </span>
                                )}
                                Filed {formatDate(filing.filingDate)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {results.events.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Events ({results.events.length})
              </h2>
              <div className="space-y-4">
                {results.events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/filings/${event.filing.accessionNumber}`}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{event.itemTitle}</CardTitle>
                            <CardDescription>
                              {event.filing.company.name}
                              {event.filing.company.ticker && (
                                <span className="font-mono ml-1">
                                  ({event.filing.company.ticker})
                                </span>
                              )}
                              {' · '}
                              {event.filing.formType}
                              {' · '}
                              {formatDate(event.filing.filingDate)}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {event.eventType && (
                              <Badge variant="secondary">{event.eventType}</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {event.summary && (
                        <CardContent>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {event.summary}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No results found for &quot;{query}&quot;.</p>
              <p className="text-sm text-gray-500 mt-2">
                Try searching for different terms or check your spelling.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
