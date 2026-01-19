'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

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
  { value: 'all', label: 'All' },
  { value: 'Biotech/Pharma', label: 'Biotech' },
  { value: 'Medical Devices', label: 'Devices' },
  { value: 'Healthcare Services', label: 'Services' },
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Companies</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Browse healthcare companies by sector
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <form onSubmit={handleSearch} className="space-y-3 sm:space-y-0 sm:flex sm:gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by name or ticker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
            {SECTORS.map((s) => (
              <Button
                key={s.value}
                type="button"
                variant={sector === s.value ? 'default' : 'outline'}
                size="sm"
                className="flex-shrink-0 h-9 px-3"
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
          {/* Mobile: List view, Desktop: Grid view */}
          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {companies.map((company) => (
              <Link key={company.cik} href={`/companies/${company.cik}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full active:bg-gray-50">
                  <CardHeader className="pb-2 p-3 sm:p-4 sm:pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <CardTitle className="text-base sm:text-lg truncate">{company.name}</CardTitle>
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
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 sm:hidden" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    <div className="flex items-center justify-between">
                      {company.sector && (
                        <Badge variant="secondary" className="text-xs">{company.sector}</Badge>
                      )}
                      {company._count && (
                        <span className="text-xs sm:text-sm text-gray-500">
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
