import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'

import { Amenities } from './src/collections/Amenities'
import { Bookings } from './src/collections/Bookings'
import { Locations } from './src/collections/Locations'
import { Media } from './src/collections/Media'
import { Properties } from './src/collections/Properties'
import { Users } from './src/collections/Users'

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  admin: {
    user: Users.slug,
  },
  collections: [Users, Media, Amenities, Locations, Properties, Bookings],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: false,
  }),
})
