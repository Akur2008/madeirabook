import type { CollectionConfig } from 'payload'

export const FlightRoutes: CollectionConfig = {
  slug: 'flight-routes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['routeSlug', 'originCity', 'minPrice', 'isIndexable'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'routeSlug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'originCity',
      type: 'text',
      required: true,
    },
    {
      name: 'originIata',
      type: 'text',
      required: true,
    },
    {
      name: 'destinationIata',
      type: 'text',
      defaultValue: 'FNC',
      required: true,
    },
    {
      name: 'minPrice',
      type: 'number',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: '€',
    },
    {
      name: 'affiliateLink',
      type: 'text',
    },
    {
      name: 'isIndexable',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
