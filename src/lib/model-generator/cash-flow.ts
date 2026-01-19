import { FinancialDataset, getAnnualValues, NormalizedFact } from '../parser/xbrl-parser'
import { ModelSheet, ModelLineItem, ModelProvenance, CASH_FLOW_ITEMS } from './types'

const SEC_ARCHIVES_BASE = 'https://www.sec.gov/Archives/edgar/data'

/**
 * Build cash flow statement model from XBRL data
 */
export function buildCashFlowStatement(
  dataset: FinancialDataset,
  cik: string,
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

  // Build sections
  const sectionMap = new Map<string, ModelLineItem[]>()

  for (const itemDef of CASH_FLOW_ITEMS) {
    const values = getAnnualValues(dataset, itemDef.standardLabel)

    // Map values to periods
    const periodValues: (number | null)[] = []
    const provenance: (ModelProvenance | null)[] = []

    for (const year of sortedYears) {
      const fact = values.find((v) => v.fiscalYear === year)
      if (fact) {
        periodValues.push(fact.value)
        provenance.push(buildProvenance(fact, cik))
      } else {
        periodValues.push(null)
        provenance.push(null)
      }
    }

    // Only include if we have at least one value
    if (periodValues.some((v) => v !== null)) {
      const item: ModelLineItem = {
        label: itemDef.label,
        standardLabel: itemDef.standardLabel,
        xbrlTag: values[0]?.originalTag || null,
        values: periodValues,
        unit: determineUnit(values),
        provenance,
      }

      if (!sectionMap.has(itemDef.section)) {
        sectionMap.set(itemDef.section, [])
      }
      sectionMap.get(itemDef.section)!.push(item)
    }
  }

  // Convert map to sections array in proper order
  const sectionOrder = ['Operating Activities', 'Investing Activities', 'Financing Activities']
  const sections: { title: string; items: ModelLineItem[] }[] = []

  for (const sectionTitle of sectionOrder) {
    const items = sectionMap.get(sectionTitle)
    if (items && items.length > 0) {
      sections.push({ title: sectionTitle, items })
    }
  }

  // Add net change in cash if we have the data
  const netChange = calculateNetCashChange(sectionMap)
  if (netChange) {
    sections.push({
      title: 'Summary',
      items: [netChange],
    })
  }

  return {
    name: 'Cash Flow Statement',
    headers,
    sections,
  }
}

function buildProvenance(fact: NormalizedFact, cik: string): ModelProvenance {
  const accessionNoDash = fact.accessionNumber?.replace(/-/g, '') || ''
  return {
    accessionNumber: fact.accessionNumber || '',
    filingDate: fact.periodEnd.toISOString().split('T')[0],
    formType: fact.form || '10-K',
    sourceUrl: `${SEC_ARCHIVES_BASE}/${cik}/${accessionNoDash}`,
  }
}

function determineUnit(facts: NormalizedFact[]): string {
  const fact = facts[0]
  if (!fact) return 'USD'

  if (fact.unit === 'USD') {
    const maxValue = Math.max(...facts.map((f) => Math.abs(f.value)))
    if (maxValue >= 1_000_000_000) return 'USD_billions'
    if (maxValue >= 1_000_000) return 'USD_millions'
    return 'USD'
  }

  return fact.unit || 'USD'
}

function calculateNetCashChange(
  sectionMap: Map<string, ModelLineItem[]>
): ModelLineItem | null {
  const operating = sectionMap.get('Operating Activities')?.find(
    (i) => i.standardLabel === 'operating_cash_flow'
  )
  const investing = sectionMap.get('Investing Activities')?.find(
    (i) => i.standardLabel === 'investing_cash_flow'
  )
  const financing = sectionMap.get('Financing Activities')?.find(
    (i) => i.standardLabel === 'financing_cash_flow'
  )

  if (!operating || !investing || !financing) return null

  const values: (number | null)[] = []
  const provenance: (ModelProvenance | null)[] = []

  for (let i = 0; i < operating.values.length; i++) {
    const op = operating.values[i]
    const inv = investing.values[i]
    const fin = financing.values[i]

    if (op !== null && inv !== null && fin !== null) {
      values.push(op + inv + fin)
      provenance.push(operating.provenance[i])
    } else {
      values.push(null)
      provenance.push(null)
    }
  }

  return {
    label: 'Net Change in Cash',
    standardLabel: 'net_cash_change',
    xbrlTag: null,
    values,
    unit: operating.unit,
    provenance,
  }
}
