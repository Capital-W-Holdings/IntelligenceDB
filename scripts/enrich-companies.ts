#!/usr/bin/env npx tsx
/**
 * Company Enrichment Script
 *
 * Extracts company information from 10-K filings:
 * - Business overview from Item 1
 * - Calculates healthcare KPIs from XBRL data
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'

interface SimpleKPIs {
  cashRunwayMonths?: number
  rAndDIntensity?: number
  grossMargin?: number
  netMargin?: number
  debtToEquity?: number
  currentRatio?: number
}

function calculateSimpleKPIs(
  facts: Map<string, number>,
  sector: string | null
): SimpleKPIs {
  const kpis: SimpleKPIs = {}

  const revenue = facts.get('revenue')
  const netIncome = facts.get('net_income')
  const cash = facts.get('cash_and_equivalents')
  const rAndD = facts.get('r_and_d_expense')
  const grossProfit = facts.get('gross_profit')
  const totalDebt = facts.get('long_term_debt') || facts.get('total_debt')
  const equity = facts.get('stockholders_equity')
  const operatingCashFlow = facts.get('operating_cash_flow')
  const currentAssets = facts.get('current_assets')
  const currentLiabilities = facts.get('current_liabilities')

  // R&D Intensity (Biotech focus)
  if (revenue && rAndD && revenue > 0) {
    kpis.rAndDIntensity = rAndD / revenue
  }

  // Cash Runway (for cash-burning companies)
  if (cash && operatingCashFlow && operatingCashFlow < 0) {
    const quarterlyBurn = Math.abs(operatingCashFlow) / 4
    kpis.cashRunwayMonths = (cash / quarterlyBurn) * 3
  }

  // Gross Margin
  if (revenue && grossProfit && revenue > 0) {
    kpis.grossMargin = grossProfit / revenue
  }

  // Net Margin
  if (revenue && netIncome && revenue > 0) {
    kpis.netMargin = netIncome / revenue
  }

  // Debt to Equity
  if (totalDebt && equity && equity > 0) {
    kpis.debtToEquity = totalDebt / equity
  }

  // Current Ratio
  if (currentAssets && currentLiabilities && currentLiabilities > 0) {
    kpis.currentRatio = currentAssets / currentLiabilities
  }

  return kpis
}

async function enrichCompanies() {
  console.log('============================================================')
  console.log('Company Enrichment')
  console.log('============================================================\n')

  // Get all companies with 10-K filings
  const companies = await prisma.company.findMany({
    include: {
      filings: {
        where: {
          formType: { in: ['10-K', '10-K/A'] }
        },
        orderBy: { filingDate: 'desc' },
        take: 1,
        include: {
          sections: true,
          xbrlFacts: {
            take: 1000,
          },
        }
      }
    }
  })

  console.log(`Found ${companies.length} companies to enrich\n`)

  let enriched = 0
  let metricsCalculated = 0

  for (const company of companies) {
    const filing = company.filings[0]
    if (!filing) continue

    console.log(`Processing: ${company.name} (${company.ticker || company.cik})`)

    // Extract business overview from Item 1
    const businessSection = filing.sections.find(s =>
      s.sectionType === 'item1' || s.sectionTitle.toLowerCase().includes('business')
    )

    let businessOverview: string | null = null
    if (businessSection) {
      // Extract first 2000 chars as overview
      businessOverview = businessSection.rawText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000)

      if (businessOverview.length === 2000) {
        businessOverview = businessOverview.substring(0, businessOverview.lastIndexOf(' ')) + '...'
      }
    }

    // Build facts map from XBRL
    const facts = new Map<string, number>()

    for (const fact of filing.xbrlFacts) {
      const value = parseFloat(fact.value)
      if (isNaN(value)) continue

      const tag = fact.tag.toLowerCase()
      const label = (fact.label || '').toLowerCase()

      // Map common XBRL tags
      if (tag.includes('revenue') || tag === 'revenues' || label.includes('revenue')) {
        if (!facts.has('revenue')) facts.set('revenue', value)
      }
      if (tag.includes('cashandcashequivalent') || label.includes('cash and cash equivalent')) {
        if (!facts.has('cash_and_equivalents')) facts.set('cash_and_equivalents', value)
      }
      if (tag.includes('researchanddevelopment') || label.includes('r&d') || label.includes('research and development')) {
        if (!facts.has('r_and_d_expense')) facts.set('r_and_d_expense', value)
      }
      if (tag === 'netincomeloss' || tag.includes('netincome')) {
        if (!facts.has('net_income')) facts.set('net_income', value)
      }
      if (tag === 'assets' && !tag.includes('current')) {
        if (!facts.has('total_assets')) facts.set('total_assets', value)
      }
      if (tag === 'liabilities' && !tag.includes('current')) {
        if (!facts.has('total_liabilities')) facts.set('total_liabilities', value)
      }
      if (tag.includes('stockholdersequity') || tag.includes('shareholdersequity')) {
        if (!facts.has('stockholders_equity')) facts.set('stockholders_equity', value)
      }
      if (tag.includes('grossprofit')) {
        if (!facts.has('gross_profit')) facts.set('gross_profit', value)
      }
      if (tag.includes('longtermdebt')) {
        if (!facts.has('long_term_debt')) facts.set('long_term_debt', value)
      }
      if (tag.includes('currentassets') && !tag.includes('non')) {
        if (!facts.has('current_assets')) facts.set('current_assets', value)
      }
      if (tag.includes('currentliabilities') && !tag.includes('non')) {
        if (!facts.has('current_liabilities')) facts.set('current_liabilities', value)
      }
      if (tag.includes('operatingcashflow') || (tag.includes('cashflow') && tag.includes('operating'))) {
        if (!facts.has('operating_cash_flow')) facts.set('operating_cash_flow', value)
      }
    }

    // Calculate KPIs
    const kpis = calculateSimpleKPIs(facts, company.sector)

    // Determine fiscal period
    const period = `FY${filing.periodEndDate?.getFullYear() || filing.filingDate.getFullYear()}`

    // Store metrics
    const metricsToStore: Array<{ name: string; value: number; unit?: string }> = []

    if (kpis.cashRunwayMonths !== undefined && kpis.cashRunwayMonths > 0) {
      metricsToStore.push({ name: 'cash_runway_months', value: kpis.cashRunwayMonths, unit: 'months' })
    }
    if (kpis.rAndDIntensity !== undefined) {
      metricsToStore.push({ name: 'r_and_d_intensity', value: kpis.rAndDIntensity * 100, unit: 'percent' })
    }
    if (kpis.grossMargin !== undefined) {
      metricsToStore.push({ name: 'gross_margin', value: kpis.grossMargin * 100, unit: 'percent' })
    }
    if (kpis.netMargin !== undefined) {
      metricsToStore.push({ name: 'net_margin', value: kpis.netMargin * 100, unit: 'percent' })
    }
    if (kpis.debtToEquity !== undefined) {
      metricsToStore.push({ name: 'debt_to_equity', value: kpis.debtToEquity, unit: 'ratio' })
    }
    if (kpis.currentRatio !== undefined) {
      metricsToStore.push({ name: 'current_ratio', value: kpis.currentRatio, unit: 'ratio' })
    }

    // Also store raw financial metrics
    const revenue = facts.get('revenue')
    const netIncome = facts.get('net_income')
    const cash = facts.get('cash_and_equivalents')

    if (revenue) {
      metricsToStore.push({ name: 'revenue', value: revenue, unit: 'USD' })
    }
    if (netIncome) {
      metricsToStore.push({ name: 'net_income', value: netIncome, unit: 'USD' })
    }
    if (cash) {
      metricsToStore.push({ name: 'cash_and_equivalents', value: cash, unit: 'USD' })
    }

    // Save metrics to database
    for (const metric of metricsToStore) {
      try {
        await prisma.companyMetric.upsert({
          where: {
            companyId_metricName_period: {
              companyId: company.id,
              metricName: metric.name,
              period: period,
            }
          },
          update: {
            value: metric.value,
            unit: metric.unit,
            sourceFiling: filing.accessionNumber,
            calculatedAt: new Date(),
          },
          create: {
            companyId: company.id,
            metricName: metric.name,
            period: period,
            periodEnd: filing.periodEndDate,
            value: metric.value,
            unit: metric.unit,
            sourceFiling: filing.accessionNumber,
          }
        })
        metricsCalculated++
      } catch (error) {
        // Ignore duplicate errors
      }
    }

    // Update company with enrichment data
    await prisma.company.update({
      where: { id: company.id },
      data: {
        businessOverview: businessOverview || company.businessOverview,
        lastEnrichedAt: new Date(),
      }
    })

    enriched++
    console.log(`  ✓ Enriched with ${metricsToStore.length} metrics`)
  }

  console.log('\n============================================================')
  console.log('Enrichment Complete!')
  console.log('============================================================')
  console.log(`Companies enriched: ${enriched}`)
  console.log(`Metrics calculated: ${metricsCalculated}`)
}

// Run
enrichCompanies()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
