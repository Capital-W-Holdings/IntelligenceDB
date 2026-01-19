'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'

interface RecentFiling {
  accessionNumber: string
  formType: string
  filingDate: string
  company: {
    name: string
    ticker: string | null
    cik: string
  }
}

interface PipelineStatus {
  status: string
  statistics: {
    companies: number
    filings: number
    events: number
    xbrlFacts: number
  }
  recentFilings: RecentFiling[]
}

const FORM_TYPES = ['8-K', '10-K', '10-Q', '10-K/A', '8-K/A']
const EVENT_TYPES = [
  { id: 'earnings', label: 'Earnings Announcements (2.02)' },
  { id: 'acquisition', label: 'Acquisitions/Dispositions (2.01)' },
  { id: 'agreement', label: 'Material Agreements (1.01)' },
  { id: 'executive_change', label: 'Executive Changes (5.02)' },
  { id: 'financing', label: 'Financing Activities (2.03)' },
]

export default function AlertsPage() {
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Alert configuration state (stored in localStorage)
  const [selectedFormTypes, setSelectedFormTypes] = useState<string[]>(['8-K', '10-K'])
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(['earnings', 'acquisition'])
  const [watchedCompanies, setWatchedCompanies] = useState<string>('')

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedFormTypes = localStorage.getItem('alertFormTypes')
    const savedEventTypes = localStorage.getItem('alertEventTypes')
    const savedCompanies = localStorage.getItem('alertWatchedCompanies')

    if (savedFormTypes) setSelectedFormTypes(JSON.parse(savedFormTypes))
    if (savedEventTypes) setSelectedEventTypes(JSON.parse(savedEventTypes))
    if (savedCompanies) setWatchedCompanies(savedCompanies)

    async function fetchStatus() {
      try {
        const response = await fetch('/api/pipeline/status')
        if (response.ok) {
          const data = await response.json()
          setStatus(data)
        }
      } catch (error) {
        console.error('Error fetching status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [])

  const handleSavePreferences = () => {
    localStorage.setItem('alertFormTypes', JSON.stringify(selectedFormTypes))
    localStorage.setItem('alertEventTypes', JSON.stringify(selectedEventTypes))
    localStorage.setItem('alertWatchedCompanies', watchedCompanies)
    alert('Alert preferences saved!')
  }

  const toggleFormType = (formType: string) => {
    setSelectedFormTypes(prev =>
      prev.includes(formType)
        ? prev.filter(f => f !== formType)
        : [...prev, formType]
    )
  }

  const toggleEventType = (eventType: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(eventType)
        ? prev.filter(e => e !== eventType)
        : [...prev, eventType]
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Filing Alerts</h1>
        <p className="mt-2 text-gray-600">
          Configure alerts for new SEC filings from healthcare companies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Type Alerts</CardTitle>
              <CardDescription>
                Select which form types you want to receive alerts for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {FORM_TYPES.map(formType => (
                  <Button
                    key={formType}
                    variant={selectedFormTypes.includes(formType) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleFormType(formType)}
                  >
                    {formType}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8-K Event Alerts</CardTitle>
              <CardDescription>
                Get notified when specific 8-K events are filed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {EVENT_TYPES.map(event => (
                  <label
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEventTypes.includes(event.id)}
                      onChange={() => toggleEventType(event.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span>{event.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Watched Companies</CardTitle>
              <CardDescription>
                Enter CIKs or tickers (comma-separated) to watch specific companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companies">Companies</Label>
                  <Input
                    id="companies"
                    placeholder="ABBV, PFE, JNJ, 0001234567"
                    value={watchedCompanies}
                    onChange={(e) => setWatchedCompanies(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to receive alerts for all healthcare companies
                  </p>
                </div>

                <Button onClick={handleSavePreferences}>
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : status ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status.status === 'running' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
                    <span className="font-medium capitalize">{status.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Companies</p>
                      <p className="text-xl font-semibold">{status.statistics.companies}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Filings</p>
                      <p className="text-xl font-semibold">{status.statistics.filings}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Events</p>
                      <p className="text-xl font-semibold">{status.statistics.events}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">XBRL Facts</p>
                      <p className="text-xl font-semibold">{status.statistics.xbrlFacts}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Unable to load status</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Filings</CardTitle>
              <CardDescription>Latest SEC filings in the database</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : status?.recentFilings && status.recentFilings.length > 0 ? (
                <div className="space-y-3">
                  {status.recentFilings.map(filing => (
                    <Link
                      key={filing.accessionNumber}
                      href={`/filings/${filing.accessionNumber}`}
                      className="block p-2 -mx-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={filing.formType === '8-K' ? 'default' : 'secondary'} className="text-xs">
                          {filing.formType}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDate(filing.filingDate)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {filing.company.name}
                        {filing.company.ticker && (
                          <span className="text-gray-500 ml-1">({filing.company.ticker})</span>
                        )}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No recent filings</p>
              )}

              <Link href="/filings" className="block mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  View All Filings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
