import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient(): PrismaClient {
  // Create a PostgreSQL connection pool
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    // During build time, DATABASE_URL might not be set
    // Return a proxy that will throw on actual usage
    console.warn('DATABASE_URL not set - database operations will fail')
    return new Proxy({} as PrismaClient, {
      get(_, prop) {
        if (prop === 'then') return undefined // For promise detection
        return () => {
          throw new Error('DATABASE_URL environment variable is not set')
        }
      },
    })
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Required for Supabase
    },
    max: 5, // Limit pool size for serverless
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  globalForPrisma.pool = pool

  // Create the Prisma adapter
  const adapter = new PrismaPg(pool)

  // Create and return the Prisma client with the adapter
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Lazy initialization - only create when first accessed
let _prisma: PrismaClient | undefined

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!_prisma) {
      _prisma = globalForPrisma.prisma ?? createPrismaClient()
      if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = _prisma
      }
    }
    return (_prisma as unknown as Record<string, unknown>)[prop as string]
  },
})

export default prisma
