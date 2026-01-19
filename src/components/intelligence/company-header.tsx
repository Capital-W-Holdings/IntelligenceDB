'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface CompanyHeaderProps {
  company: {
    cik: string
    name: string
    ticker?: string | null
    sector?: string | null
  }
  showBackButton?: boolean
}

const NAV_ITEMS = [
  { href: '', label: 'Overview', icon: '📊' },
  { href: '/intelligence', label: 'Scores', icon: '🎯' },
  { href: '/risk-factors', label: 'Risks', icon: '⚠️' },
  { href: '/events', label: '8-K Events', icon: '📰' },
  { href: '/insiders', label: 'Insiders', icon: '👔' },
  { href: '/model', label: 'Model', icon: '📈' },
]

export function CompanyHeader({ company, showBackButton = true }: CompanyHeaderProps) {
  const pathname = usePathname()
  const basePath = `/companies/${company.cik}`

  const isActive = (href: string) => {
    if (href === '') {
      return pathname === basePath
    }
    return pathname === `${basePath}${href}`
  }

  return (
    <div className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Company Info Row */}
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Link href="/search">
                <Button variant="ghost" size="sm" className="gap-1 text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                  Search
                </Button>
              </Link>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
                {company.ticker && (
                  <Badge variant="outline" className="font-mono text-sm">
                    {company.ticker}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>CIK: {company.cik}</span>
                {company.sector && (
                  <>
                    <span>•</span>
                    <Badge variant="secondary" className="text-xs">{company.sector}</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Link href={`/api/export/model?cik=${company.cik}`} target="_blank">
              <Button size="sm" variant="outline" className="gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Excel
              </Button>
            </Link>
            <Link href={`/api/companies/${company.cik}/report`} target="_blank">
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                Full Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={`${basePath}${item.href}`}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
