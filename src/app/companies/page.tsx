'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Company {
  cik: string
  name: string
  ticker: string | null
  sector: string | null
  _count?: {
    filings: number
  }
}

const SECTORS = [
  { value: 'all', label: 'All Sectors' },
  { value: 'Biotech/Pharma', label: 'Biotech/Pharma' },
  { value: 'Medical Devices', label: 'Medical Devices' },
  { value: 'Healthcare Services', label: 'Healthcare Services' },
  { value: 'Payers', label: 'Payers' },
]

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    async function fetchCompanies() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
        })
        if (search) params.set('search', search)
        if (sector !== 'all') params.set('sector', sector)

        const response = await fetch(`/api/companies?${params}`)
        const data = await response.json()
        setCompanies(data.companies || [])
        setTotalPages(data.totalPages || 1)
      } catch (error) {
        console.error('Error fetching companies:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()
  }, [search, sector, page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Companies</h1>
        <p className="text-gray-600">
          Browse healthcare companies by sector and view their SEC filings
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by name or ticker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {SECTORS.map((s) => (
              <Button
                key={s.value}
                type="button"
                variant={sector === s.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSector(s.value)
                  setPage(1)
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </form>
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading companies...</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No companies found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <Link key={company.cik} href={`/companies/${company.cik}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
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
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      {company.sector && (
                        <Badge variant="secondary">{company.sector}</Badge>
                      )}
                      {company._count && (
                        <span className="text-sm text-gray-500">
                          {company._count.filings} filings
                        </span>
                      )}
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
