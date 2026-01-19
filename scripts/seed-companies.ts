/**
 * Seed Healthcare Companies
 *
 * This script fetches healthcare companies from SEC and adds them to your database.
 * Run with: npx tsx scripts/seed-companies.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Top healthcare companies by market cap (CIKs)
const HEALTHCARE_COMPANIES = [
  // Big Pharma
  { cik: '0000078003', ticker: 'PFE', name: 'Pfizer Inc.', sector: 'Pharma' },
  { cik: '0000310158', ticker: 'MRK', name: 'Merck & Co., Inc.', sector: 'Pharma' },
  { cik: '0000064803', ticker: 'ABBV', name: 'AbbVie Inc.', sector: 'Pharma' },
  { cik: '0001800406', ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Pharma' },
  { cik: '0000018230', ticker: 'BMY', name: 'Bristol-Myers Squibb Company', sector: 'Pharma' },
  { cik: '0001551152', ticker: 'AMGN', name: 'Amgen Inc.', sector: 'Biotech' },
  { cik: '0000885725', ticker: 'GILD', name: 'Gilead Sciences, Inc.', sector: 'Biotech' },

  // Biotech
  { cik: '0001099800', ticker: 'BIIB', name: 'Biogen Inc.', sector: 'Biotech' },
  { cik: '0001682852', ticker: 'MRNA', name: 'Moderna, Inc.', sector: 'Biotech' },
  { cik: '0001024305', ticker: 'VRTX', name: 'Vertex Pharmaceuticals', sector: 'Biotech' },
  { cik: '0001110803', ticker: 'REGN', name: 'Regeneron Pharmaceuticals', sector: 'Biotech' },

  // Medical Devices
  { cik: '0000885590', ticker: 'ISRG', name: 'Intuitive Surgical, Inc.', sector: 'MedDevice' },
  { cik: '0001163302', ticker: 'BSX', name: 'Boston Scientific Corporation', sector: 'MedDevice' },
  { cik: '0000066740', ticker: 'MMM', name: '3M Company', sector: 'MedDevice' },
  { cik: '0000813672', ticker: 'ABT', name: 'Abbott Laboratories', sector: 'MedDevice' },
  { cik: '0000318154', ticker: 'MDT', name: 'Medtronic plc', sector: 'MedDevice' },

  // Healthcare Services
  { cik: '0000731766', ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Payer' },
  { cik: '0001122304', ticker: 'CVS', name: 'CVS Health Corporation', sector: 'HealthIT' },
  { cik: '0000804328', ticker: 'HCA', name: 'HCA Healthcare, Inc.', sector: 'Provider' },
  { cik: '0001593034', ticker: 'HUM', name: 'Humana Inc.', sector: 'Payer' },

  // Health IT
  { cik: '0001136893', ticker: 'VEEV', name: 'Veeva Systems Inc.', sector: 'HealthIT' },
]

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set')
    console.log('\nTo set it, create a .env file with:')
    console.log('DATABASE_URL="postgresql://user:password@host:5432/database"')
    process.exit(1)
  }

  console.log('🔌 Connecting to database...')

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('📊 Seeding healthcare companies...\n')

    let added = 0
    let skipped = 0

    for (const company of HEALTHCARE_COMPANIES) {
      // Check if already exists
      const existing = await prisma.company.findUnique({
        where: { cik: company.cik }
      })

      if (existing) {
        console.log(`  ⏭️  ${company.ticker} - Already exists`)
        skipped++
        continue
      }

      // Create company
      await prisma.company.create({
        data: {
          cik: company.cik,
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          sicCode: '2834', // Pharmaceutical Preparations (default)
          sicDescription: 'Healthcare',
        }
      })

      console.log(`  ✅ ${company.ticker} - ${company.name}`)
      added++
    }

    console.log(`\n✨ Done! Added ${added} companies, skipped ${skipped} existing.`)
    console.log('\nYou can now:')
    console.log('  1. Visit http://localhost:3000/search to find companies')
    console.log('  2. Click on a company to see the intelligence dashboard')
    console.log('  3. The scores will be calculated live from SEC XBRL data')

  } catch (error) {
    console.error('❌ Error seeding companies:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
