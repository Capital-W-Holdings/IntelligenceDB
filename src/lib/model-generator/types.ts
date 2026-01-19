export interface ModelCompanyInfo {
  cik: string
  name: string
  ticker: string | null
  sector: string | null
}

export interface ModelProvenance {
  accessionNumber: string
  filingDate: string
  formType: string
  sourceUrl: string
}

export interface ModelLineItem {
  label: string
  standardLabel: string
  xbrlTag: string | null
  values: (number | null)[]
  unit: string
  provenance: (ModelProvenance | null)[]
}

export interface ModelSheet {
  name: string
  headers: string[] // Period headers: ["FY2022", "FY2023", "FY2024"]
  sections: {
    title: string
    items: ModelLineItem[]
  }[]
}

export interface ModelWorkbook {
  company: ModelCompanyInfo
  generatedAt: string
  sourceFilings: string[] // accession numbers
  sheets: {
    incomeStatement?: ModelSheet
    balanceSheet?: ModelSheet
    cashFlow?: ModelSheet
    kpis?: ModelSheet
    segment?: ModelSheet
  }
}

// Standard Income Statement line items
export const INCOME_STATEMENT_ITEMS = [
  { label: 'Total Revenue', standardLabel: 'revenue', section: 'Revenue' },
  { label: 'Cost of Revenue', standardLabel: 'cost_of_revenue', section: 'Costs' },
  { label: 'Gross Profit', standardLabel: 'gross_profit', section: 'Profit' },
  { label: 'R&D Expense', standardLabel: 'r_and_d_expense', section: 'Operating Expenses' },
  { label: 'SG&A Expense', standardLabel: 'sg_and_a_expense', section: 'Operating Expenses' },
  { label: 'Operating Expenses', standardLabel: 'operating_expenses', section: 'Operating Expenses' },
  { label: 'Operating Income', standardLabel: 'operating_income', section: 'Profit' },
  { label: 'Pre-tax Income', standardLabel: 'pretax_income', section: 'Profit' },
  { label: 'Net Income', standardLabel: 'net_income', section: 'Profit' },
  { label: 'EPS (Basic)', standardLabel: 'eps_basic', section: 'Per Share' },
  { label: 'EPS (Diluted)', standardLabel: 'eps_diluted', section: 'Per Share' },
  { label: 'Shares Outstanding (Basic)', standardLabel: 'weighted_avg_shares_basic', section: 'Per Share' },
  { label: 'Shares Outstanding (Diluted)', standardLabel: 'weighted_avg_shares_diluted', section: 'Per Share' },
]

// Standard Balance Sheet line items
export const BALANCE_SHEET_ITEMS = [
  { label: 'Cash & Equivalents', standardLabel: 'cash_and_equivalents', section: 'Current Assets' },
  { label: 'Short-term Investments', standardLabel: 'short_term_investments', section: 'Current Assets' },
  { label: 'Accounts Receivable', standardLabel: 'accounts_receivable', section: 'Current Assets' },
  { label: 'Inventory', standardLabel: 'inventory', section: 'Current Assets' },
  { label: 'Total Current Assets', standardLabel: 'current_assets', section: 'Current Assets' },
  { label: 'PP&E (Net)', standardLabel: 'ppe_net', section: 'Non-Current Assets' },
  { label: 'Goodwill', standardLabel: 'goodwill', section: 'Non-Current Assets' },
  { label: 'Intangible Assets', standardLabel: 'intangible_assets', section: 'Non-Current Assets' },
  { label: 'Total Assets', standardLabel: 'total_assets', section: 'Total' },
  { label: 'Accounts Payable', standardLabel: 'accounts_payable', section: 'Current Liabilities' },
  { label: 'Total Current Liabilities', standardLabel: 'current_liabilities', section: 'Current Liabilities' },
  { label: 'Long-term Debt', standardLabel: 'long_term_debt', section: 'Non-Current Liabilities' },
  { label: 'Total Liabilities', standardLabel: 'total_liabilities', section: 'Total' },
  { label: 'Stockholders Equity', standardLabel: 'stockholders_equity', section: 'Equity' },
]

// Standard Cash Flow line items
export const CASH_FLOW_ITEMS = [
  { label: 'Net Income', standardLabel: 'net_income', section: 'Operating Activities' },
  { label: 'Operating Cash Flow', standardLabel: 'operating_cash_flow', section: 'Operating Activities' },
  { label: 'Investing Cash Flow', standardLabel: 'investing_cash_flow', section: 'Investing Activities' },
  { label: 'Financing Cash Flow', standardLabel: 'financing_cash_flow', section: 'Financing Activities' },
]

// Standard KPI line items (calculated)
export const KPI_ITEMS = [
  // Growth metrics
  { label: 'Revenue Growth (YoY)', standardLabel: 'revenue_growth_yoy', section: 'Growth' },
  { label: 'Net Income Growth (YoY)', standardLabel: 'net_income_growth_yoy', section: 'Growth' },
  // Profitability margins
  { label: 'Gross Margin', standardLabel: 'gross_margin', section: 'Margins' },
  { label: 'Operating Margin', standardLabel: 'operating_margin', section: 'Margins' },
  { label: 'Net Margin', standardLabel: 'net_margin', section: 'Margins' },
  { label: 'EBITDA Margin', standardLabel: 'ebitda_margin', section: 'Margins' },
  // Returns
  { label: 'Return on Assets (ROA)', standardLabel: 'return_on_assets', section: 'Returns' },
  { label: 'Return on Equity (ROE)', standardLabel: 'return_on_equity', section: 'Returns' },
  // Healthcare/Biotech specific
  { label: 'R&D Intensity', standardLabel: 'r_and_d_intensity', section: 'Biotech' },
  { label: 'R&D to Operating Expense', standardLabel: 'r_and_d_to_opex', section: 'Biotech' },
  { label: 'Cash Runway (Months)', standardLabel: 'cash_runway_months', section: 'Biotech' },
  // Liquidity
  { label: 'Current Ratio', standardLabel: 'current_ratio', section: 'Liquidity' },
  { label: 'Quick Ratio', standardLabel: 'quick_ratio', section: 'Liquidity' },
  { label: 'Cash to Assets', standardLabel: 'cash_to_assets', section: 'Liquidity' },
  // Leverage
  { label: 'Debt to Equity', standardLabel: 'debt_to_equity', section: 'Leverage' },
  { label: 'Debt to Assets', standardLabel: 'debt_to_assets', section: 'Leverage' },
  // Cash Flow
  { label: 'Free Cash Flow', standardLabel: 'free_cash_flow', section: 'Cash Flow' },
  { label: 'FCF Margin', standardLabel: 'fcf_margin', section: 'Cash Flow' },
]
