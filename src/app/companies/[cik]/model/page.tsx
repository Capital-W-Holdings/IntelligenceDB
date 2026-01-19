'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Types
interface ModelProvenance {
  accessionNumber: string
  filingDate: string
  formType: string
  sourceUrl: string
}

interface ModelLineItem {
  label: string
  standardLabel: string
  xbrlTag: string | null
  values: (number | null)[]
  unit: string
  provenance: (ModelProvenance | null)[]
}

interface ModelSection {
  title: string
  items: ModelLineItem[]
}

interface ModelSheet {
  name: string
  headers: string[]
  sections: ModelSection[]
}

interface ModelWorkbook {
  company: {
    cik: string
    name: string
    ticker: string | null
    sector: string | null
  }
  generatedAt: string
  sourceFilings: string[]
  sheets: {
    incomeStatement?: ModelSheet
    balanceSheet?: ModelSheet
    cashFlow?: ModelSheet
    kpis?: ModelSheet
  }
}

interface DataPointContext {
  metric: string
  standardLabel: string
  period: string
  periodIndex: number
  value: number | null
  unit: string
  provenance: ModelProvenance | null
  priorValue: number | null
  change: number | null
  allValues: (number | null)[]
  allPeriods: string[]
  xbrlTag: string | null
}

// Premium color palette
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',
  secondary: '#7c3aed',
  success: '#059669',
  successLight: '#10b981',
  warning: '#d97706',
  danger: '#dc2626',
  dangerLight: '#ef4444',
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  chart: ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#c026d3'],
}

// Formatting utilities
function formatValue(value: number | null, unit: string, opts?: { compact?: boolean; showSign?: boolean }): string {
  if (value === null || value === undefined) return '—'
  const { compact = false, showSign = false } = opts || {}

  const absValue = Math.abs(value)
  const isNegative = value < 0
  let formatted: string

  if (unit === 'percent') {
    formatted = `${absValue.toFixed(1)}%`
  } else if (unit === 'ratio') {
    formatted = absValue.toFixed(2) + 'x'
  } else if (unit === 'months') {
    formatted = `${absValue.toFixed(0)} mo`
  } else if (unit === 'USD' || unit === 'USD_billions' || unit === 'USD_millions') {
    if (absValue >= 1_000_000_000) {
      formatted = compact ? `$${(absValue / 1_000_000_000).toFixed(1)}B` : `$${(absValue / 1_000_000_000).toFixed(2)}B`
    } else if (absValue >= 1_000_000) {
      formatted = compact ? `$${(absValue / 1_000_000).toFixed(0)}M` : `$${(absValue / 1_000_000).toFixed(1)}M`
    } else if (absValue >= 1_000) {
      formatted = `$${(absValue / 1_000).toFixed(0)}K`
    } else {
      formatted = `$${absValue.toFixed(0)}`
    }
  } else if (unit === 'shares') {
    if (absValue >= 1_000_000_000) {
      formatted = `${(absValue / 1_000_000_000).toFixed(2)}B`
    } else if (absValue >= 1_000_000) {
      formatted = `${(absValue / 1_000_000).toFixed(0)}M`
    } else {
      formatted = absValue.toLocaleString()
    }
  } else {
    formatted = absValue.toLocaleString()
  }

  if (showSign && !isNegative && value > 0) {
    formatted = '+' + formatted
  }

  return isNegative ? `(${formatted})` : formatted
}

function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  } else if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  return `$${value.toLocaleString()}`
}

// Interactive chart dot component
function InteractiveDot(props: {
  cx?: number
  cy?: number
  payload?: Record<string, unknown>
  onClick?: (data: Record<string, unknown>) => void
  isActive?: boolean
  [key: string]: unknown
}) {
  const { cx, cy, payload, onClick, isActive } = props
  if (!cx || !cy || cy === null) return null

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={isActive ? 8 : 6}
        fill="white"
        stroke={COLORS.primary}
        strokeWidth={2}
        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        onClick={() => onClick?.({ ...payload })}
        onMouseEnter={(e) => {
          (e.target as SVGCircleElement).setAttribute('r', '8')
        }}
        onMouseLeave={(e) => {
          (e.target as SVGCircleElement).setAttribute('r', isActive ? '8' : '6')
        }}
      />
      {isActive && (
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill={COLORS.primary}
          fillOpacity={0.2}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
}

// Premium tooltip
function PremiumTooltip({
  active,
  payload,
  label,
  onPointClick,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string; payload: Record<string, unknown> }>
  label?: string
  onPointClick?: (data: Record<string, unknown>) => void
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-neutral-200 rounded-xl shadow-2xl p-4 min-w-[200px]">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
        <span className="text-sm font-semibold text-neutral-900">{label}</span>
        <button
          onClick={() => payload[0] && onPointClick?.({ ...payload[0].payload, period: label })}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View Details
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="space-y-2">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-neutral-600">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {formatLargeNumber(entry.value || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Metric card with premium styling
function MetricCard({
  title,
  value,
  change,
  unit,
  trend,
  subtitle,
  onClick,
}: {
  title: string
  value: number | null
  change: number | null
  unit: string
  trend?: 'up' | 'down' | 'neutral'
  subtitle?: string
  onClick?: () => void
}) {
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-neutral-500'
  const trendBg = trend === 'up' ? 'bg-emerald-50' : trend === 'down' ? 'bg-rose-50' : 'bg-neutral-100'
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  return (
    <div
      onClick={onClick}
      className={`relative group bg-white rounded-2xl border border-neutral-200/60 p-6 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-[13px] font-medium text-neutral-500 tracking-wide">{title}</span>
        {onClick && (
          <svg className="w-4 h-4 text-neutral-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-neutral-400 mb-3">{subtitle}</p>}
      <div className="text-[28px] font-bold text-neutral-900 tracking-tight mb-2">
        {formatValue(value, unit, { compact: true })}
      </div>
      {change !== null && (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${trendBg} ${trendColor}`}>
          <span>{trendIcon}</span>
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-neutral-400 font-normal">YoY</span>
        </div>
      )}
    </div>
  )
}

// Data point detail modal
function DataPointModal({
  context,
  model,
  onClose,
}: {
  context: DataPointContext
  model: ModelWorkbook
  onClose: () => void
}) {
  const [activeView, setActiveView] = useState<'overview' | 'filing' | 'history'>('overview')

  // Calculate additional metrics
  const yoyChange = context.change
  const avgValue = useMemo(() => {
    const validValues = context.allValues.filter((v): v is number => v !== null)
    return validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null
  }, [context.allValues])

  const maxValue = useMemo(() => {
    const validValues = context.allValues.filter((v): v is number => v !== null)
    return validValues.length > 0 ? Math.max(...validValues) : null
  }, [context.allValues])

  const minValue = useMemo(() => {
    const validValues = context.allValues.filter((v): v is number => v !== null)
    return validValues.length > 0 ? Math.min(...validValues) : null
  }, [context.allValues])

  // Calculate trend
  const trendData = useMemo(() => {
    return context.allPeriods.map((period, i) => ({
      period,
      value: context.allValues[i],
      isSelected: i === context.periodIndex,
    }))
  }, [context])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-neutral-900">{context.metric}</h2>
                <Badge variant="outline" className="text-xs font-mono bg-neutral-100">
                  {context.period}
                </Badge>
              </div>
              {context.xbrlTag && (
                <p className="text-xs font-mono text-neutral-400">{context.xbrlTag}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-neutral-100 transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-1 mt-4">
            {(['overview', 'filing', 'history'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === view
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeView === 'overview' && (
            <div className="space-y-8">
              {/* Primary value display */}
              <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
                <p className="text-sm font-medium text-neutral-500 mb-2">Value for {context.period}</p>
                <p className="text-5xl font-bold text-neutral-900 tracking-tight">
                  {formatValue(context.value, context.unit)}
                </p>
                {yoyChange !== null && (
                  <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full ${
                    yoyChange >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    <span className="font-semibold">{yoyChange >= 0 ? '↑' : '↓'} {Math.abs(yoyChange).toFixed(1)}%</span>
                    <span className="text-sm opacity-75">vs prior year</span>
                  </div>
                )}
              </div>

              {/* Mini trend chart */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-4">Historical Trend</h3>
                <div className="h-40 bg-neutral-50 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="modalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke={COLORS.neutral[400]} />
                      <YAxis tick={{ fontSize: 11 }} stroke={COLORS.neutral[400]} tickFormatter={(v) => formatValue(v, context.unit, { compact: true })} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        fill="url(#modalGradient)"
                        dot={(props: { cx?: number; cy?: number; payload?: { isSelected?: boolean } }) => {
                          const { cx, cy, payload } = props
                          if (!cx || !cy) return <g />
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={payload?.isSelected ? 6 : 4}
                              fill={payload?.isSelected ? COLORS.primary : 'white'}
                              stroke={COLORS.primary}
                              strokeWidth={2}
                            />
                          )
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Statistics grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-neutral-500 mb-1">5Y Average</p>
                  <p className="text-lg font-bold text-neutral-900">{formatValue(avgValue, context.unit, { compact: true })}</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-neutral-500 mb-1">5Y High</p>
                  <p className="text-lg font-bold text-emerald-600">{formatValue(maxValue, context.unit, { compact: true })}</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-neutral-500 mb-1">5Y Low</p>
                  <p className="text-lg font-bold text-rose-600">{formatValue(minValue, context.unit, { compact: true })}</p>
                </div>
              </div>
            </div>
          )}

          {activeView === 'filing' && (
            <div className="space-y-6">
              {context.provenance ? (
                <>
                  <div className="bg-blue-50 rounded-2xl p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600 mb-1">Source Filing</p>
                        <p className="text-xl font-bold text-neutral-900">{context.provenance.formType}</p>
                        <p className="text-sm text-neutral-600 mt-1">Filed: {new Date(context.provenance.filingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      <Link
                        href={`/filings/${context.provenance.accessionNumber}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        View Filing
                      </Link>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 mb-3">Filing Details</h3>
                    <div className="bg-neutral-50 rounded-xl divide-y divide-neutral-200">
                      <div className="flex justify-between p-4">
                        <span className="text-sm text-neutral-600">Accession Number</span>
                        <span className="text-sm font-mono text-neutral-900">{context.provenance.accessionNumber}</span>
                      </div>
                      <div className="flex justify-between p-4">
                        <span className="text-sm text-neutral-600">Form Type</span>
                        <span className="text-sm font-medium text-neutral-900">{context.provenance.formType}</span>
                      </div>
                      <div className="flex justify-between p-4">
                        <span className="text-sm text-neutral-600">Period End</span>
                        <span className="text-sm text-neutral-900">{context.period}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 mb-3">Related Filings</h3>
                    <div className="space-y-2">
                      {model.sourceFilings.slice(0, 5).map((accession) => (
                        <Link
                          key={accession}
                          href={`/filings/${accession}`}
                          className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors"
                        >
                          <span className="text-sm font-mono text-neutral-700">{accession}</span>
                          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-600">No filing information available for this data point</p>
                </div>
              )}
            </div>
          )}

          {activeView === 'history' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-700">Period-by-Period Breakdown</h3>
              <div className="bg-neutral-50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Period</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Value</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Change</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {context.allPeriods.map((period, i) => {
                      const val = context.allValues[i]
                      const priorVal = context.allValues[i - 1]
                      const pctChange = val !== null && priorVal !== null && priorVal !== 0
                        ? ((val - priorVal) / Math.abs(priorVal)) * 100
                        : null

                      return (
                        <tr
                          key={period}
                          className={`${i === context.periodIndex ? 'bg-blue-50' : 'hover:bg-white'} transition-colors`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {i === context.periodIndex && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                              <span className={`text-sm font-medium ${i === context.periodIndex ? 'text-blue-700' : 'text-neutral-900'}`}>
                                {period}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-mono font-medium text-neutral-900">
                              {formatValue(val, context.unit)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pctChange !== null && (
                              <span className={`text-sm font-medium ${pctChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {context.provenance ? (
                              <span className="text-xs text-neutral-500">{context.provenance.formType}</span>
                            ) : (
                              <span className="text-xs text-neutral-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-neutral-100 bg-neutral-50 flex justify-between items-center">
          <p className="text-xs text-neutral-500">
            Data sourced from SEC EDGAR via XBRL
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {context.provenance && (
              <Link href={`/filings/${context.provenance.accessionNumber}`}>
                <Button size="sm">View Source Filing</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Premium chart component
function PremiumRevenueChart({
  data,
  headers,
  onDataPointClick,
}: {
  data: ModelSheet
  headers: string[]
  onDataPointClick: (context: DataPointContext) => void
}) {
  const chartData = useMemo(() => {
    const revenue = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'revenue')
    const netIncome = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'net_income')
    const grossProfit = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'gross_profit')

    return headers.map((h, i) => ({
      period: h,
      periodIndex: i,
      revenue: revenue?.values[i] ? revenue.values[i]! / 1_000_000_000 : null,
      revenueRaw: revenue?.values[i],
      netIncome: netIncome?.values[i] ? netIncome.values[i]! / 1_000_000_000 : null,
      netIncomeRaw: netIncome?.values[i],
      grossProfit: grossProfit?.values[i] ? grossProfit.values[i]! / 1_000_000_000 : null,
      grossProfitRaw: grossProfit?.values[i],
      revenueProvenance: revenue?.provenance[i],
      netIncomeProvenance: netIncome?.provenance[i],
    }))
  }, [data, headers])

  const handlePointClick = (chartPayload: Record<string, unknown>, metricKey: string) => {
    const revenueItem = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'revenue')
    const netIncomeItem = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'net_income')

    const item = metricKey === 'revenue' ? revenueItem : netIncomeItem
    if (!item) return

    const periodIndex = chartPayload.periodIndex as number

    onDataPointClick({
      metric: item.label,
      standardLabel: item.standardLabel,
      period: chartPayload.period as string,
      periodIndex,
      value: item.values[periodIndex],
      unit: 'USD',
      provenance: item.provenance[periodIndex],
      priorValue: item.values[periodIndex - 1] ?? null,
      change: item.values[periodIndex] !== null && item.values[periodIndex - 1] !== null && item.values[periodIndex - 1] !== 0
        ? ((item.values[periodIndex]! - item.values[periodIndex - 1]!) / Math.abs(item.values[periodIndex - 1]!)) * 100
        : null,
      allValues: item.values,
      allPeriods: headers,
      xbrlTag: item.xbrlTag,
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/60 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Revenue & Profitability</h3>
          <p className="text-sm text-neutral-500 mt-0.5">Click any data point for detailed analysis</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-neutral-600">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-neutral-600">Gross Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-neutral-600">Net Income</span>
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.neutral[200]} vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: COLORS.neutral[500] }}
              tickLine={false}
              axisLine={{ stroke: COLORS.neutral[200] }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: COLORS.neutral[500] }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}B`}
            />
            <Tooltip content={<PremiumTooltip onPointClick={(d) => handlePointClick(d, 'revenue')} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              fill="url(#revenueGrad)"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={(props) => (
                <InteractiveDot
                  {...props}
                  onClick={(d) => handlePointClick(d, 'revenue')}
                />
              )}
              activeDot={{ r: 8, stroke: COLORS.primary, strokeWidth: 2, fill: 'white' }}
            />
            <Bar
              dataKey="grossProfit"
              name="Gross Profit"
              fill={COLORS.success}
              radius={[4, 4, 0, 0]}
              onClick={(d) => handlePointClick(d as unknown as Record<string, unknown>, 'grossProfit')}
              style={{ cursor: 'pointer' }}
            />
            <Line
              type="monotone"
              dataKey="netIncome"
              name="Net Income"
              stroke={COLORS.secondary}
              strokeWidth={3}
              dot={(props) => (
                <InteractiveDot
                  {...props}
                  onClick={(d) => handlePointClick(d, 'netIncome')}
                />
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Premium margin chart
function PremiumMarginChart({
  data,
  onDataPointClick,
}: {
  data: ModelSheet
  onDataPointClick: (context: DataPointContext) => void
}) {
  const chartData = useMemo(() => {
    const items: Record<string, ModelLineItem> = {}
    data.sections.forEach(section => {
      section.items.forEach(item => {
        items[item.standardLabel] = item
      })
    })

    return data.headers.map((h, i) => ({
      period: h,
      periodIndex: i,
      operatingMargin: items.operating_margin?.values[i],
      netMargin: items.net_margin?.values[i],
      ebitdaMargin: items.ebitda_margin?.values[i],
    }))
  }, [data])

  const handlePointClick = (d: Record<string, unknown>, metric: string) => {
    const item = data.sections.flatMap(s => s.items).find(i => i.standardLabel === metric)
    if (!item) return

    const periodIndex = d.periodIndex as number

    onDataPointClick({
      metric: item.label,
      standardLabel: item.standardLabel,
      period: d.period as string,
      periodIndex,
      value: item.values[periodIndex],
      unit: 'percent',
      provenance: item.provenance[periodIndex],
      priorValue: item.values[periodIndex - 1] ?? null,
      change: null,
      allValues: item.values,
      allPeriods: data.headers,
      xbrlTag: null,
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/60 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-neutral-900">Margin Analysis</h3>
        <p className="text-sm text-neutral-500 mt-0.5">Profitability trends over time</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.neutral[200]} vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: COLORS.neutral[500] }}
              tickLine={false}
              axisLine={{ stroke: COLORS.neutral[200] }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: COLORS.neutral[500] }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<PremiumTooltip onPointClick={(d) => handlePointClick(d, 'operating_margin')} />} />
            <Line
              type="monotone"
              dataKey="operatingMargin"
              name="Operating Margin"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={(props) => <InteractiveDot {...props} onClick={(d) => handlePointClick(d, 'operating_margin')} />}
            />
            <Line
              type="monotone"
              dataKey="netMargin"
              name="Net Margin"
              stroke={COLORS.secondary}
              strokeWidth={2}
              dot={(props) => <InteractiveDot {...props} onClick={(d) => handlePointClick(d, 'net_margin')} />}
            />
            {chartData[0]?.ebitdaMargin !== undefined && (
              <Line
                type="monotone"
                dataKey="ebitdaMargin"
                name="EBITDA Margin"
                stroke={COLORS.warning}
                strokeWidth={2}
                dot={(props) => <InteractiveDot {...props} onClick={(d) => handlePointClick(d, 'ebitda_margin')} />}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Cash flow chart
function PremiumCashFlowChart({
  data,
  onDataPointClick,
}: {
  data: ModelSheet
  onDataPointClick: (context: DataPointContext) => void
}) {
  const chartData = useMemo(() => {
    const operating = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'operating_cash_flow')
    const investing = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'investing_cash_flow')
    const financing = data.sections.flatMap(s => s.items).find(i => i.standardLabel === 'financing_cash_flow')

    return data.headers.map((h, i) => ({
      period: h,
      periodIndex: i,
      operating: operating?.values[i] ? operating.values[i]! / 1_000_000_000 : 0,
      investing: investing?.values[i] ? investing.values[i]! / 1_000_000_000 : 0,
      financing: financing?.values[i] ? financing.values[i]! / 1_000_000_000 : 0,
    }))
  }, [data])

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/60 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-neutral-900">Cash Flow Statement</h3>
        <p className="text-sm text-neutral-500 mt-0.5">Operating, investing, and financing activities</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.neutral[200]} vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: COLORS.neutral[500] }}
              tickLine={false}
              axisLine={{ stroke: COLORS.neutral[200] }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: COLORS.neutral[500] }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}B`}
            />
            <Tooltip content={<PremiumTooltip />} />
            <ReferenceLine y={0} stroke={COLORS.neutral[300]} />
            <Bar dataKey="operating" name="Operating" fill={COLORS.success} radius={[4, 4, 0, 0]} />
            <Bar dataKey="investing" name="Investing" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
            <Bar dataKey="financing" name="Financing" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// KPI sparkline card
function KPISparklineCard({
  item,
  headers,
  onClick,
}: {
  item: ModelLineItem
  headers: string[]
  onClick: () => void
}) {
  const chartData = headers.map((h, i) => ({
    period: h,
    value: item.values[i],
  })).filter(d => d.value !== null)

  const latestValue = item.values[item.values.length - 1]
  const priorValue = item.values[item.values.length - 2]
  const change = latestValue !== null && priorValue !== null && priorValue !== 0
    ? ((latestValue - priorValue) / Math.abs(priorValue)) * 100
    : null

  const isPositiveGood = !item.label.toLowerCase().includes('debt')
  const trend = change !== null ? (change > 0 ? (isPositiveGood ? 'up' : 'down') : (isPositiveGood ? 'down' : 'up')) : 'neutral'

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-neutral-200/60 p-5 cursor-pointer hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-neutral-700 group-hover:text-blue-600 transition-colors">{item.label}</h4>
        </div>
        {change !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-emerald-50 text-emerald-600' :
            trend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-neutral-100 text-neutral-600'
          }`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-neutral-900 mb-3">
        {formatValue(latestValue, item.unit, { compact: true })}
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`kpi-${item.standardLabel}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={COLORS.primary}
              strokeWidth={1.5}
              fill={`url(#kpi-${item.standardLabel})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Financial table
function FinancialTable({
  sheet,
  onRowClick,
}: {
  sheet: ModelSheet
  onRowClick: (item: ModelLineItem, periodIndex: number) => void
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sheet.sections.map(s => s.title)))

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left py-4 px-5 text-xs font-semibold text-neutral-500 uppercase tracking-wider sticky left-0 bg-neutral-50 min-w-[200px]">
                Line Item
              </th>
              {sheet.headers.map(header => (
                <th key={header} className="text-right py-4 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider min-w-[100px]">
                  {header}
                </th>
              ))}
              <th className="text-right py-4 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider min-w-[80px]">
                YoY
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.sections.map((section, sIdx) => (
              <React.Fragment key={sIdx}>
                <tr
                  className="bg-neutral-50/50 cursor-pointer hover:bg-neutral-100/50 transition-colors border-b border-neutral-100"
                  onClick={() => {
                    setExpandedSections(prev => {
                      const next = new Set(prev)
                      if (next.has(section.title)) next.delete(section.title)
                      else next.add(section.title)
                      return next
                    })
                  }}
                >
                  <td colSpan={sheet.headers.length + 2} className="py-3 px-5">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-neutral-400 transition-transform ${expandedSections.has(section.title) ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-semibold text-neutral-800">{section.title}</span>
                      <span className="text-xs text-neutral-400">({section.items.length})</span>
                    </div>
                  </td>
                </tr>
                {expandedSections.has(section.title) && section.items.map((item, iIdx) => {
                  const latestIdx = item.values.length - 1
                  const priorIdx = item.values.length - 2
                  const change = item.values[latestIdx] !== null && item.values[priorIdx] !== null && item.values[priorIdx] !== 0
                    ? ((item.values[latestIdx]! - item.values[priorIdx]!) / Math.abs(item.values[priorIdx]!)) * 100
                    : null

                  return (
                    <tr key={`${sIdx}-${iIdx}`} className="border-b border-neutral-100 hover:bg-blue-50/30 transition-colors group">
                      <td className="py-3 px-5 sticky left-0 bg-white group-hover:bg-blue-50/30 transition-colors">
                        <span className="font-medium text-neutral-800">{item.label}</span>
                      </td>
                      {item.values.map((value, vIdx) => (
                        <td
                          key={vIdx}
                          className="py-3 px-4 text-right cursor-pointer hover:bg-blue-100/50 rounded transition-colors"
                          onClick={() => onRowClick(item, vIdx)}
                        >
                          <span className={`font-mono text-sm ${value !== null && value < 0 ? 'text-rose-600' : 'text-neutral-900'}`}>
                            {formatValue(value, item.unit)}
                          </span>
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right">
                        {change !== null && (
                          <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Main page component
export default function CompanyModelPage() {
  const params = useParams()
  const cik = params.cik as string

  const [model, setModel] = useState<ModelWorkbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [dataPointModal, setDataPointModal] = useState<DataPointContext | null>(null)

  useEffect(() => {
    async function fetchModel() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/companies/${cik}/model?periods=5`)
        if (response.ok) {
          const data = await response.json()
          setModel(data)
        } else {
          const errData = await response.json()
          setError(errData.error || 'Failed to load model')
        }
      } catch (err) {
        console.error('Error fetching model:', err)
        setError('Failed to fetch financial model')
      } finally {
        setLoading(false)
      }
    }

    if (cik) fetchModel()
  }, [cik])

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      const response = await fetch(`/api/export/model?cik=${cik}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${model?.company.ticker || model?.company.name?.replace(/\s+/g, '_') || 'model'}_financial_model.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Error downloading:', err)
    } finally {
      setDownloading(false)
    }
  }, [cik, model])

  const handleTableRowClick = useCallback((item: ModelLineItem, periodIndex: number) => {
    if (!model?.sheets.incomeStatement) return

    const headers = model.sheets.incomeStatement.headers

    setDataPointModal({
      metric: item.label,
      standardLabel: item.standardLabel,
      period: headers[periodIndex],
      periodIndex,
      value: item.values[periodIndex],
      unit: item.unit,
      provenance: item.provenance[periodIndex],
      priorValue: item.values[periodIndex - 1] ?? null,
      change: item.values[periodIndex] !== null && item.values[periodIndex - 1] !== null && item.values[periodIndex - 1] !== 0
        ? ((item.values[periodIndex]! - item.values[periodIndex - 1]!) / Math.abs(item.values[periodIndex - 1]!)) * 100
        : null,
      allValues: item.values,
      allPeriods: headers,
      xbrlTag: item.xbrlTag,
    })
  }, [model])

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    if (!model?.sheets.incomeStatement) return null

    const findItem = (label: string) =>
      model.sheets.incomeStatement!.sections.flatMap(s => s.items).find(i => i.standardLabel === label)

    const revenue = findItem('revenue')
    const netIncome = findItem('net_income')
    const grossProfit = findItem('gross_profit')

    const getLatest = (item: ModelLineItem | undefined) => item?.values[item.values.length - 1] ?? null
    const getPrior = (item: ModelLineItem | undefined) => item?.values[item.values.length - 2] ?? null

    const calcChange = (item: ModelLineItem | undefined) => {
      const curr = getLatest(item)
      const prev = getPrior(item)
      if (curr === null || prev === null || prev === 0) return null
      return ((curr - prev) / Math.abs(prev)) * 100
    }

    const revLatest = getLatest(revenue)
    const gpLatest = getLatest(grossProfit)
    const niLatest = getLatest(netIncome)
    const revChange = calcChange(revenue)
    const niChange = calcChange(netIncome)

    return {
      revenue: { value: revLatest, change: revChange, trend: (revChange ?? 0) >= 0 ? 'up' as const : 'down' as const },
      netIncome: { value: niLatest, change: niChange, trend: (niChange ?? 0) >= 0 ? 'up' as const : 'down' as const },
      grossMargin: { value: revLatest && gpLatest ? (gpLatest / revLatest) * 100 : null, change: null, trend: 'neutral' as const },
      netMargin: { value: revLatest && niLatest ? (niLatest / revLatest) * 100 : null, change: null, trend: 'neutral' as const },
    }
  }, [model])

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">Building Financial Model</h3>
          <p className="text-neutral-500">Parsing XBRL data from SEC EDGAR...</p>
        </div>
      </div>
    )
  }

  if (error || !model) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-neutral-50">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Unable to Generate Model</h2>
          <p className="text-neutral-600 mb-6">{error || 'No XBRL data available for this company'}</p>
          <Link href={`/companies/${cik}`}>
            <Button size="lg">Back to Company</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
                <Link href={`/companies/${cik}`} className="hover:text-blue-600 transition-colors">
                  {model.company.name}
                </Link>
                <span>/</span>
                <span className="text-neutral-900 font-medium">Financial Model</span>
              </div>
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-neutral-900">
                  {model.company.ticker || model.company.name}
                </h1>
                {model.company.sector && (
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{model.company.sector}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500">
                {model.sourceFilings.length} source filings
              </span>
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="bg-neutral-900 hover:bg-neutral-800"
              >
                {downloading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Exporting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export to Excel
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        {summaryMetrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Revenue"
              subtitle="Latest FY"
              value={summaryMetrics.revenue.value}
              change={summaryMetrics.revenue.change}
              unit="USD"
              trend={summaryMetrics.revenue.trend}
              onClick={() => {
                const item = model.sheets.incomeStatement?.sections.flatMap(s => s.items).find(i => i.standardLabel === 'revenue')
                if (item) handleTableRowClick(item, item.values.length - 1)
              }}
            />
            <MetricCard
              title="Net Income"
              subtitle="Latest FY"
              value={summaryMetrics.netIncome.value}
              change={summaryMetrics.netIncome.change}
              unit="USD"
              trend={summaryMetrics.netIncome.trend}
              onClick={() => {
                const item = model.sheets.incomeStatement?.sections.flatMap(s => s.items).find(i => i.standardLabel === 'net_income')
                if (item) handleTableRowClick(item, item.values.length - 1)
              }}
            />
            <MetricCard
              title="Gross Margin"
              value={summaryMetrics.grossMargin.value}
              change={null}
              unit="percent"
              trend="neutral"
            />
            <MetricCard
              title="Net Margin"
              value={summaryMetrics.netMargin.value}
              change={null}
              unit="percent"
              trend="neutral"
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-neutral-200 p-1 rounded-xl mb-8">
            <TabsTrigger value="overview" className="rounded-lg px-6 data-[state=active]:bg-neutral-900 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="income" className="rounded-lg px-6 data-[state=active]:bg-neutral-900 data-[state=active]:text-white">
              Income Statement
            </TabsTrigger>
            <TabsTrigger value="balance" className="rounded-lg px-6 data-[state=active]:bg-neutral-900 data-[state=active]:text-white">
              Balance Sheet
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="rounded-lg px-6 data-[state=active]:bg-neutral-900 data-[state=active]:text-white">
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="kpis" className="rounded-lg px-6 data-[state=active]:bg-neutral-900 data-[state=active]:text-white">
              KPIs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                {model.sheets.incomeStatement && (
                  <PremiumRevenueChart
                    data={model.sheets.incomeStatement}
                    headers={model.sheets.incomeStatement.headers}
                    onDataPointClick={setDataPointModal}
                  />
                )}
              </div>
              <div className="lg:col-span-2">
                {model.sheets.kpis && (
                  <PremiumMarginChart data={model.sheets.kpis} onDataPointClick={setDataPointModal} />
                )}
              </div>
            </div>

            {model.sheets.cashFlow && (
              <PremiumCashFlowChart data={model.sheets.cashFlow} onDataPointClick={setDataPointModal} />
            )}

            {model.sheets.kpis && (
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Key Performance Indicators</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {model.sheets.kpis.sections.flatMap(section =>
                    section.items.slice(0, 8).map(item => (
                      <KPISparklineCard
                        key={item.standardLabel}
                        item={item}
                        headers={model.sheets.kpis!.headers}
                        onClick={() => handleTableRowClick(item, item.values.length - 1)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="income">
            {model.sheets.incomeStatement && (
              <FinancialTable sheet={model.sheets.incomeStatement} onRowClick={handleTableRowClick} />
            )}
          </TabsContent>

          <TabsContent value="balance">
            {model.sheets.balanceSheet && (
              <FinancialTable sheet={model.sheets.balanceSheet} onRowClick={handleTableRowClick} />
            )}
          </TabsContent>

          <TabsContent value="cashflow">
            {model.sheets.cashFlow && (
              <FinancialTable sheet={model.sheets.cashFlow} onRowClick={handleTableRowClick} />
            )}
          </TabsContent>

          <TabsContent value="kpis">
            {model.sheets.kpis && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {model.sheets.kpis.sections.flatMap(section =>
                    section.items.map(item => (
                      <KPISparklineCard
                        key={item.standardLabel}
                        item={item}
                        headers={model.sheets.kpis!.headers}
                        onClick={() => handleTableRowClick(item, item.values.length - 1)}
                      />
                    ))
                  )}
                </div>
                <FinancialTable sheet={model.sheets.kpis} onRowClick={handleTableRowClick} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Data Point Modal */}
      {dataPointModal && (
        <DataPointModal
          context={dataPointModal}
          model={model}
          onClose={() => setDataPointModal(null)}
        />
      )}
    </div>
  )
}
