import type { CollectionConfig } from 'payload'

export const Properties: CollectionConfig = {
  slug: 'properties',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'brand', 'location', 'pricePerNight', 'status'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'brand',
      type: 'select',
      required: true,
      defaultValue: 'madeirabook',
      options: [
        { label: 'Madeirabook', value: 'madeirabook' },
        { label: 'Madeira Oasis', value: 'madeiraoasis' },
        { label: 'Both', value: 'both' },
      ],
    },
    {
      name: 'pmsPropertyId',
      type: 'text',
    },
    {
      name: 'pricePerNight',
      type: 'number',
      required: true,
    },
    {
      name: 'cleaningFee',
      type: 'number',
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
    },
    {
      name: 'amenities',
      type: 'relationship',
      relationTo: 'amenities',
      hasMany: true,
    },
    {
      name: 'media',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'audioTracks',
      type: 'array',
      fields: [
        {
          name: 'audio',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
}
