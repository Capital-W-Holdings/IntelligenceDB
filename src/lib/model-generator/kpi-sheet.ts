import { FinancialDataset, getAnnualValues, getLatestValue } from '../parser/xbrl-parser'
import { ModelSheet, ModelLineItem, ModelProvenance, KPI_ITEMS } from './types'

const SEC_ARCHIVES_BASE = 'https://www.sec.gov/Archives/edgar/data'

/**
 * Build KPI sheet with calculated metrics from XBRL data
 */
export function buildKPISheet(
  dataset: FinancialDataset,
  cik: string,
  sector: string,
  periods: number = 5
): ModelSheet {
  // Get unique fiscal years from the dataset
  const years = new Set<number>()
  for (const period of dataset.periods) {
    if (period.fiscalPeriod === 'FY' && period.fiscalYear) {
      years.add(period.fiscalYear)
    }
  }

  // Sort and take most recent periods
  const sortedYears = Array.from(years).sort((a, b) => a - b).slice(-periods)
  const headers = sortedYears.map((y) => `FY${y}`)

  const sections: { title: string; items: ModelLineItem[] }[] = []
  const sectionMap = new Map<string, ModelLineItem[]>()

  // Calculate each KPI for each year
  for (const itemDef of KPI_ITEMS) {
    // Skip sector-specific KPIs if not applicable
    if (itemDef.section === 'Biotech' && !isBiotechSector(sector)) continue

    const kpiValues = calculateKPIForYears(dataset, itemDef.standardLabel, sortedYears, cik)

    if (kpiValues.values.some((v) => v !== null)) {
      const item: ModelLineItem = {
        label: itemDef.label,
        standardLabel: itemDef.standardLabel,
        xbrlTag: null, // KPIs are calculated, not from XBRL tags
        values: kpiValues.values,
        unit: kpiValues.unit,
        provenance: kpiValues.provenance,
      }

      if (!sectionMap.has(itemDef.section)) {
        sectionMap.set(itemDef.section, [])
      }
      sectionMap.get(itemDef.section)!.push(item)
    }
  }

  // Convert map to sections array
  const sectionOrder = ['Growth', 'Margins', 'Returns', 'Biotech', 'Liquidity', 'Leverage', 'Cash Flow']
  for (const sectionTitle of sectionOrder) {
    const items = sectionMap.get(sectionTitle)
    if (items && items.length > 0) {
      sections.push({ title: sectionTitle, items })
    }
  }

  return {
    name: 'Key Performance Indicators',
    headers,
    sections,
  }
}

function isBiotechSector(sector: string): boolean {
  const biotechSectors = [
    'Biotech/Pharma',
    'Biotech',
    'Pharma',
    'MedDevice',
    'Medical Devices',
    'Pharmaceuticals',
    'Healthcare Services',
  ]
  return biotechSectors.some(s => sector?.toLowerCase().includes(s.toLowerCase()))
}

interface KPICalculationResult {
  values: (number | null)[]
  unit: string
  provenance: (ModelProvenance | null)[]
}

function calculateKPIForYears(
  dataset: FinancialDataset,
  kpiLabel: string,
  years: number[],
  cik: string
): KPICalculationResult {
  const values: (number | null)[] = []
  const provenance: (ModelProvenance | null)[] = []
  let unit = 'percent'

  // Get time series for needed metrics
  const revenue = getAnnualValues(dataset, 'revenue')
  const grossProfit = getAnnualValues(dataset, 'gross_profit')
  const operatingIncome = getAnnualValues(dataset, 'operating_income')
  const netIncome = getAnnualValues(dataset, 'net_income')
  const rAndD = getAnnualValues(dataset, 'r_and_d_expense')
  const cash = getAnnualValues(dataset, 'cash_and_equivalents')
  const operatingCashFlow = getAnnualValues(dataset, 'operating_cash_flow')
  const investingCashFlow = getAnnualValues(dataset, 'investing_cash_flow')
  const currentAssets = getAnnualValues(dataset, 'current_assets')
  const currentLiabilities = getAnnualValues(dataset, 'current_liabilities')
  const longTermDebt = getAnnualValues(dataset, 'long_term_debt')
  const equity = getAnnualValues(dataset, 'stockholders_equity')
  const totalAssets = getAnnualValues(dataset, 'total_assets')
  const inventory = getAnnualValues(dataset, 'inventory')
  const operatingExpenses = getAnnualValues(dataset, 'operating_expenses')
  const depreciation = getAnnualValues(dataset, 'depreciation')

  for (let i = 0; i < years.length; i++) {
    const year = years[i]
    let value: number | null = null
    let prov: ModelProvenance | null = null

    switch (kpiLabel) {
      case 'revenue_growth_yoy': {
        const current = revenue.find((f) => f.fiscalYear === year)
        const prior = revenue.find((f) => f.fiscalYear === year - 1)
        if (current && prior && prior.value > 0) {
          value = ((current.value - prior.value) / prior.value) * 100
          prov = buildProvenance(current, cik)
        }
        break
      }

      case 'gross_margin': {
        const rev = revenue.find((f) => f.fiscalYear === year)
        const gp = grossProfit.find((f) => f.fiscalYear === year)
        if (rev && gp && rev.value > 0) {
          value = (gp.value / rev.value) * 100
          prov = buildProvenance(rev, cik)
        }
        break
      }

      case 'operating_margin': {
        const rev = revenue.find((f) => f.fiscalYear === year)
        const op = operatingIncome.find((f) => f.fiscalYear === year)
        if (rev && op && rev.value > 0) {
          value = (op.value / rev.value) * 100
          prov = buildProvenance(rev, cik)
        }
        break
      }

      case 'net_margin': {
        const rev = revenue.find((f) => f.fiscalYear === year)
        const ni = netIncome.find((f) => f.fiscalYear === year)
        if (rev && ni && rev.value > 0) {
          value = (ni.value / rev.value) * 100
          prov = buildProvenance(rev, cik)
        }
        break
      }

      case 'r_and_d_intensity': {
        const rev = revenue.find((f) => f.fiscalYear === year)
        const rd = rAndD.find((f) => f.fiscalYear === year)
        if (rev && rd && rev.value > 0) {
          value = (rd.value / rev.value) * 100
          prov = buildProvenance(rd, cik)
        }
        break
      }

      case 'cash_runway_months': {
        const cashVal = cash.find((f) => f.fiscalYear === year)
        const ocf = operatingCashFlow.find((f) => f.fiscalYear === year)
        if (cashVal && ocf && ocf.value < 0) {
          const quarterlyBurn = Math.abs(ocf.value) / 4
          value = (cashVal.value / quarterlyBurn) * 3
          prov = buildProvenance(cashVal, cik)
          unit = 'months'
        }
        break
      }

      case 'current_ratio': {
        const ca = currentAssets.find((f) => f.fiscalYear === year)
        const cl = currentLiabilities.find((f) => f.fiscalYear === year)
        if (ca && cl && cl.value > 0) {
          value = ca.value / cl.value
          prov = buildProvenance(ca, cik)
          unit = 'ratio'
        }
        break
      }

      case 'debt_to_equity': {
        const debt = longTermDebt.find((f) => f.fiscalYear === year)
        const eq = equity.find((f) => f.fiscalYear === year)
        if (debt && eq && eq.value > 0) {
          value = debt.value / eq.value
          prov = buildProvenance(debt, cik)
          unit = 'ratio'
        }
        break
      }

      case 'net_income_growth_yoy': {
        const current = netIncome.find((f) => f.fiscalYear === year)
        const prior = netIncome.find((f) => f.fiscalYear === year - 1)
        if (current && prior && Math.abs(prior.value) > 0) {
          value = ((current.value - prior.value) / Math.abs(prior.value)) * 100
          prov = buildProvenance(current, cik)
        }
        break
      }

      case 'ebitda_margin': {
        const rev = revenue.find((f) => f.fiscalYear === year)
        const op = operatingIncome.find((f) => f.fiscalYear === year)
        const depr = depreciation.find((f) => f.fiscalYear === year)
        if (rev && op && rev.value > 0) {
          const ebitda = op.value + (depr?.value || 0)
          value = (ebitda / rev.value) * 100
          prov = buildProvenance(rev, cik)
        }
        break
      }

      case 'return_on_assets': {
        const ni = netIncome.find((f) => f.fiscalYear === year)
        const assets = totalAssets.find((f) => f.fiscalYear === year)
        if (ni && assets && assets.value > 0) {
          value = (ni.value / assets.value) * 100
          prov = buildProvenance(ni, cik)
        }
        break
      }

      case 'return_on_equity': {
        const ni = netIncome.find((f) => f.fiscalYear === year)
        const eq = equity.find((f) => f.fiscalYear === year)
        if (ni && eq && eq.value > 0) {
          value = (ni.value / eq.value) * 100
          prov = buildProvenance(ni, cik)
        }
        break
      }

      case 'r_and_d_to_opex': {
        const rd = rAndD.find((f) => f.fiscalYear === year)
        const opex = operatingExpenses.find((f) => f.fiscalYear === year)
        if (rd && opex && opex.value > 0) {
          value = (rd.value / opex.value) * 100
          prov = buildProvenance(rd, cik)
        }
        break
      }

      case 'quick_ratio': {
        const ca = currentAssets.find((f) => f.fiscalYear === year)
        const inv = inventory.find((f) => f.fiscalYear === year)
        const cl = currentLiabilities.find((f) => f.fiscalYear === year)
        if (ca && cl && cl.value > 0) {
          const quickAssets = ca.value - (inv?.value || 0)
          value = quickAssets / cl.value
          prov = buildProvenance(ca, cik)
          unit = 'ratio'
        }
        break
      }

      case 'cash_to_assets': {
        const cashVal = cash.find((f) => f.fiscalYear === year)
        const assets = totalAssets.find((f) => f.fiscalYear === year)
        if (cashVal && assets && assets.value > 0) {
          value = (cashVal.value / assets.value) * 100
          prov = buildProvenance(cashVal, cik)
        }
        break
      }

      case 'debt_to_assets': {
        const debt = longTermDebt.find((f) => f.fiscalYear === year)
        const assets = totalAssets.find((f) => f.fiscalYear === year)
        if (debt && assets && assets.value > 0) {
          value = (debt.value / assets.value) * 100
          prov = buildProvenance(debt, cik)
        }
        break
      }

      case 'free_cash_flow': {
        const ocf = operatingCashFlow.find((f) => f.fiscalYear === year)
        const icf = investingCashFlow.find((f) => f.fiscalYear === year)
        if (ocf) {
          // FCF = Operating Cash Flow + Investing Cash Flow (capex is typically negative)
          value = ocf.value + (icf?.value || 0)
          prov = buildProvenance(ocf, cik)
          unit = 'USD'
        }
        break
      }

      case 'fcf_margin': {
        const ocf = operatingCashFlow.find((f) => f.fiscalYear === year)
        const icf = investingCashFlow.find((f) => f.fiscalYear === year)
        const rev = revenue.find((f) => f.fiscalYear === year)
        if (ocf && rev && rev.value > 0) {
          const fcf = ocf.value + (icf?.value || 0)
          value = (fcf / rev.value) * 100
          prov = buildProvenance(ocf, cik)
        }
        break
      }
    }

    values.push(value)
    provenance.push(prov)
  }

  return { values, unit, provenance }
}

function buildProvenance(fact: { accessionNumber?: string; periodEnd: Date; form?: string }, cik: string): ModelProvenance {
  const accessionNoDash = fact.accessionNumber?.replace(/-/g, '') || ''
  return {
    accessionNumber: fact.accessionNumber || '',
    filingDate: fact.periodEnd.toISOString().split('T')[0],
    formType: fact.form || '10-K',
    sourceUrl: `${SEC_ARCHIVES_BASE}/${cik}/${accessionNoDash}`,
  }
}
