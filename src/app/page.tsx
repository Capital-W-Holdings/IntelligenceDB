import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
          Healthcare Filings Intelligence
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-2">
          Real-time SEC filings analysis for healthcare companies. Extract financial
          data, track corporate events, and generate spreadsheet models.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
        <Card className="flex flex-col">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Companies</CardTitle>
            <CardDescription>
              Browse healthcare companies by sector
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <p className="text-sm text-gray-600 mb-4 flex-1">
              Filter by Biotech/Pharma, Medical Devices, Healthcare Services,
              Payers, and more.
            </p>
            <Link href="/companies">
              <Button className="w-full h-11 text-base">Browse Companies</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Filings</CardTitle>
            <CardDescription>
              Search SEC filings (8-K, 10-K, 10-Q)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <p className="text-sm text-gray-600 mb-4 flex-1">
              View extracted sections, XBRL facts, and healthcare-specific
              events from recent filings.
            </p>
            <Link href="/filings">
              <Button className="w-full h-11 text-base">View Filings</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Search</CardTitle>
            <CardDescription>
              Full-text search across filings
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <p className="text-sm text-gray-600 mb-4 flex-1">
              Search for FDA approvals, clinical trial results, acquisitions,
              and other healthcare events.
            </p>
            <Link href="/search">
              <Button className="w-full h-11 text-base">Search Filings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-start space-x-3 p-2 sm:p-0">
            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 text-green-500 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-sm sm:text-base">XBRL Extraction</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Automatic extraction of financial facts from XBRL filings
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-2 sm:p-0">
            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 text-green-500 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-sm sm:text-base">Healthcare KPIs</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Sector-specific metrics: cash runway, R&D intensity, MLR
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-2 sm:p-0">
            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 text-green-500 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-sm sm:text-base">Excel Export</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Generate financial models with full data provenance
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-2 sm:p-0">
            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 text-green-500 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-sm sm:text-base">Event Classification</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Auto-detect FDA approvals, clinical trials, M&A events
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
