'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { ChevronRight, Search } from 'lucide-react'

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
  'Phase 3',
  'revenue',
  'guidance',
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Search</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Search companies, filings, and events
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="FDA approvals, clinical trials..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 sm:h-12 text-base"
            />
          </div>
          <Button type="submit" disabled={loading || query.length < 2} className="h-11 sm:h-12 px-4 sm:px-6">
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </form>

        {!searched && (
          <div className="mt-4">
            <p className="text-xs sm:text-sm text-gray-500 mb-2">Try searching for:</p>
            <div className="flex flex-wrap gap-2">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
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
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            Found {totalResults} result{totalResults !== 1 ? 's' : ''} for &quot;{query}&quot;
          </p>

          {/* Companies */}
          {results.companies.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
                Companies ({results.companies.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {results.companies.map((company) => (
                  <Link key={company.cik} href={`/companies/${company.cik}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full active:bg-gray-50">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">{company.name}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                              {company.ticker && (
                                <span className="font-mono font-bold text-gray-900">
                                  {company.ticker}
                                </span>
                              )}
                              {company.ticker && ' · '}
                              CIK: {company.cik}
                            </CardDescription>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 sm:hidden" />
                        </div>
                      </CardHeader>
                      {company.sector && (
                        <CardContent className="p-3 sm:p-4 pt-0">
                          <Badge variant="secondary" className="text-xs">{company.sector}</Badge>
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
            <div className="mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
                Filings ({results.filings.length})
              </h2>
              <div className="space-y-2 sm:space-y-3">
                {results.filings.map((filing) => (
                  <Link key={filing.accessionNumber} href={`/filings/${filing.accessionNumber}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50">
                      <CardContent className="py-3 sm:py-4 px-3 sm:px-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                            <Badge
                              variant={filing.formType === '8-K' ? 'default' : 'secondary'}
                              className="text-xs flex-shrink-0"
                            >
                              {filing.formType}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm sm:text-base truncate">{filing.company.name}</p>
                              <p className="text-xs sm:text-sm text-gray-500">
                                {filing.company.ticker && (
                                  <span className="font-mono">{filing.company.ticker} · </span>
                                )}
                                {formatDate(filing.filingDate)}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 sm:hidden" />
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
            <div className="mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
                Events ({results.events.length})
              </h2>
              <div className="space-y-3 sm:space-y-4">
                {results.events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/filings/${event.filing.accessionNumber}`}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm sm:text-base line-clamp-2">{event.itemTitle}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm mt-1">
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
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {event.eventType && (
                              <Badge variant="secondary" className="text-xs">{event.eventType}</Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-gray-400 sm:hidden" />
                          </div>
                        </div>
                      </CardHeader>
                      {event.summary && (
                        <CardContent className="p-3 sm:p-4 pt-0">
                          <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">
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
                Try searching for different terms.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
