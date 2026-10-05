import type { CollectionConfig } from 'payload'

export const HouseRules: CollectionConfig = {
  slug: 'house-rules',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
}
