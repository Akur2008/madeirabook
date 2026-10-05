import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'

import { Amenities } from './src/collections/Amenities.ts'
import { HouseRules } from './src/collections/HouseRules.ts'
import { Bookings } from './src/collections/Bookings.ts'
import { CommissionHistory } from './src/collections/CommissionHistory.ts'
import { Locations } from './src/collections/Locations.ts'
import { Media } from './src/collections/Media.ts'
import { Properties } from './src/collections/Properties.ts'
import { Subscribers } from './src/collections/Subscribers.ts'
import { FlightRoutes } from './src/payload/collections/FlightRoutes.ts'
import { Guides } from './src/collections/Guides.ts'
import { Users } from './src/collections/Users.ts'
import { WebhookEvents } from './src/collections/WebhookEvents.ts'
import { CookiePolicy, PrivacyPolicy, TermsOfService, LegalInfo } from './src/globals/LegalPages.ts'

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'local-dev-secret',
  admin: { user: Users.slug },
  collections: [
    Users,
    Media,
    Amenities,
    HouseRules,
    Locations,
    Properties,
    Bookings,
    WebhookEvents,
    CommissionHistory,
    Subscribers,
    FlightRoutes,
    Guides,
  ],
  globals: [CookiePolicy, PrivacyPolicy, TermsOfService, LegalInfo],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    push: false,
  }),
})
