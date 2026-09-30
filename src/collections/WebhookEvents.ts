import type { CollectionConfig } from 'payload'

export const WebhookEvents: CollectionConfig = {
  slug: 'webhook_events',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'type', 'processedAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'type',
      type: 'text',
      required: true,
    },
    {
      name: 'processedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
  ],
}
