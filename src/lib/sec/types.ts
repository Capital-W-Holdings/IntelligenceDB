// SEC API Response Types

export interface SECCompanySubmissions {
  cik: string
  entityType: string
  sic: string
  sicDescription: string
  name: string
  tickers: string[]
  exchanges: string[]
  ein: string
  description: string
  website: string
  category: string
  fiscalYearEnd: string
  stateOfIncorporation: string
  stateOfIncorporationDescription: string
  addresses: {
    mailing: SECAddress
    business: SECAddress
  }
  filings: {
    recent: SECFilingList
    files: { name: string; filingCount: number; filingFrom: string; filingTo: string }[]
  }
}

export interface SECAddress {
  street1: string
  street2: string | null
  city: string
  stateOrCountry: string
  zipCode: string
  stateOrCountryDescription: string
}

export interface SECFilingList {
  accessionNumber: string[]
  filingDate: string[]
  reportDate: string[]
  acceptanceDateTime: string[]
  act: string[]
  form: string[]
  fileNumber: string[]
  filmNumber: string[]
  items: string[]
  size: number[]
  isXBRL: number[]
  isInlineXBRL: number[]
  primaryDocument: string[]
  primaryDocDescription: string[]
}

export interface SECCompanyFacts {
  cik: number
  entityName: string
  facts: {
    'us-gaap'?: Record<string, SECFactData>
    'dei'?: Record<string, SECFactData>
    [key: string]: Record<string, SECFactData> | undefined
  }
}

export interface SECFactData {
  label: string
  description: string
  units: {
    [key: string]: SECFactUnit[]
  }
}

export interface SECFactUnit {
  end: string
  val: number
  accn: string
  fy: number
  fp: string
  form: string
  filed: string
  frame?: string
  start?: string
  segment?: {
    dimension: string
    value: string
  }
}

export interface SECAtomFeed {
  entries: SECAtomEntry[]
}

export interface SECAtomEntry {
  title: string
  link: string
  updated: string
  category: string
  summary: string
}

// Healthcare SIC codes
export const HEALTHCARE_SIC_CODES: Record<string, string> = {
  // Pharmaceuticals & Biotech
  '2833': 'Medicinal Chemicals & Botanical Products',
  '2834': 'Pharmaceutical Preparations',
  '2835': 'In Vitro & In Vivo Diagnostic Substances',
  '2836': 'Biological Products',

  // Medical Devices & Instruments
  '3841': 'Surgical & Medical Instruments',
  '3842': 'Orthopedic, Prosthetic & Surgical Appliances',
  '3843': 'Dental Equipment & Supplies',
  '3844': 'X-Ray Apparatus & Tubes',
  '3845': 'Electromedical & Electrotherapeutic Apparatus',

  // Healthcare Services
  '5912': 'Drug Stores & Proprietary Stores',
  '6324': 'Hospital & Medical Service Plans',
  '8000': 'Health Services',
  '8011': 'Offices & Clinics Of Doctors Of Medicine',
  '8050': 'Nursing & Personal Care Facilities',
  '8051': 'Skilled Nursing Care Facilities',
  '8060': 'Hospitals',
  '8062': 'General Medical & Surgical Hospitals',
  '8071': 'Medical Laboratories',
  '8082': 'Home Health Care Services',
  '8090': 'Miscellaneous Health & Allied Services',
  '8093': 'Specialty Outpatient Facilities',
  '8099': 'Health & Allied Services',

  // Health IT
  '7370': 'Computer Programming, Data Processing',
  '7371': 'Computer Programming Services',
  '7372': 'Prepackaged Software',
  '7373': 'Computer Integrated Systems Design',
  '7374': 'Computer Processing & Data Preparation',
  '7375': 'Information Retrieval Services',
  '7379': 'Computer Related Services',
}

export function classifySector(sicCode: string): string | null {
  const code = parseInt(sicCode)

  if (code >= 2833 && code <= 2836) return 'Biotech/Pharma'
  if (code >= 3841 && code <= 3845) return 'MedDevice'
  if (code === 5912) return 'Pharmacy'
  if (code === 6324) return 'Payer'
  if (code >= 8000 && code <= 8099) return 'Provider'
  if (code >= 7370 && code <= 7379) return 'HealthIT'

  return null
}

export function isHealthcareSIC(sicCode: string): boolean {
  return sicCode in HEALTHCARE_SIC_CODES || classifySector(sicCode) !== null
}
