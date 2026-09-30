import type { CollectionConfig } from 'payload'

export const CommissionHistory: CollectionConfig = {
  slug: 'commission_history',
  admin: {
    defaultColumns: ['property', 'oldPercent', 'newPercent', 'changedBy', 'changedAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
    },
    {
      name: 'oldPercent',
      type: 'number',
    },
    {
      name: 'newPercent',
      type: 'number',
    },
    {
      name: 'changedBy',
      type: 'text',
      required: true,
    },
    {
      name: 'changedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
  ],
}
