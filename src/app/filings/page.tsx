'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface Filing {
  accessionNumber: string
  formType: string
  filingDate: string
  primaryDocument: string | null
  company: {
    cik: string
    name: string
    ticker: string | null
  }
  _count?: {
    events: number
  }
}

const FORM_TYPES = [
  { value: 'all', label: 'All' },
  { value: '8-K', label: '8-K' },
  { value: '10-K', label: '10-K' },
  { value: '10-Q', label: '10-Q' },
]

export default function FilingsPage() {
  const [filings, setFilings] = useState<Filing[]>([])
  const [loading, setLoading] = useState(true)
  const [formType, setFormType] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    async function fetchFilings() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '25',
        })
        if (formType !== 'all') params.set('formType', formType)
        if (dateFrom) params.set('from', dateFrom)
        if (dateTo) params.set('to', dateTo)

        const response = await fetch(`/api/filings?${params}`)
        const data = await response.json()
        setFilings(data.filings || [])
        setTotalPages(data.totalPages || 1)
      } catch (error) {
        console.error('Error fetching filings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFilings()
  }, [formType, dateFrom, dateTo, page])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Filings</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Browse SEC filings from healthcare companies
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
            {FORM_TYPES.map((ft) => (
              <Button
                key={ft.value}
                variant={formType === ft.value ? 'default' : 'outline'}
                size="sm"
                className="flex-shrink-0 h-9"
                onClick={() => {
                  setFormType(ft.value)
                  setPage(1)
                }}
              >
                {ft.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">From:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="flex-1 h-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">To:</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="flex-1 h-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filings List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading filings...</p>
        </div>
      ) : filings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No filings found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 sm:space-y-3">
            {filings.map((filing) => (
              <Link key={filing.accessionNumber} href={`/filings/${filing.accessionNumber}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50">
                  <CardContent className="py-3 sm:py-4 px-3 sm:px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <Badge
                          variant={
                            filing.formType === '8-K'
                              ? 'default'
                              : filing.formType === '10-K'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="w-14 sm:w-16 justify-center flex-shrink-0 text-xs"
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
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-mono text-gray-500">
                            {filing.accessionNumber}
                          </p>
                          {filing._count && filing._count.events > 0 && (
                            <p className="text-xs text-gray-500">
                              {filing._count.events} event{filing._count.events !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 sm:hidden" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 sm:mt-8">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="h-10 px-4"
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="h-10 px-4"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
