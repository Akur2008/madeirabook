import type { CollectionConfig } from 'payload'

export const Amenities: CollectionConfig = {
  slug: 'amenities',
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
    },
    {
      name: 'icon',
      type: 'text',
    },
  ],
}
