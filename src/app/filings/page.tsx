'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

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
  { value: 'all', label: 'All Types' },
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Filings</h1>
        <p className="text-gray-600">
          Browse SEC filings from healthcare companies
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {FORM_TYPES.map((ft) => (
              <Button
                key={ft.value}
                variant={formType === ft.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFormType(ft.value)
                  setPage(1)
                }}
              >
                {ft.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500">From:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="w-40"
            />
            <span className="text-sm text-gray-500">To:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="w-40"
            />
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
          <div className="space-y-3">
            {filings.map((filing) => (
              <Link key={filing.accessionNumber} href={`/filings/${filing.accessionNumber}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={
                            filing.formType === '8-K'
                              ? 'default'
                              : filing.formType === '10-K'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="w-16 justify-center"
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
                      <div className="text-right">
                        <p className="text-sm font-mono text-gray-500">
                          {filing.accessionNumber}
                        </p>
                        {filing._count && filing._count.events > 0 && (
                          <p className="text-sm text-gray-500">
                            {filing._count.events} event{filing._count.events !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
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
