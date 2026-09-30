import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'

import { Bookings } from './src/collections/Bookings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  collections: [Bookings],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: false,
  }),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
