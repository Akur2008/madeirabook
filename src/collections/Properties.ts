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
      required: false,
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      unique: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      maxLength: 300,
      admin: { description: 'Короткое описание до 300 символов для карточки на главной' },
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
      name: 'smoobuId',
      type: 'text',
      unique: true,
      index: true,
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'commissionPercent',
      type: 'number',
      defaultValue: 12,
      min: 0,
      max: 100,
    },
    {
      name: 'chargesEnabled',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'pmsPropertyId',
      type: 'text',
    },
    {
      name: 'pricePerNight',
      type: 'number',
      required: false,
    },
    {
      name: 'cleaningFee',
      type: 'number',
    },
    {
      name: 'sizeM2',
      type: 'number',
      admin: { description: 'Площадь в м²' },
    },
    {
      name: 'bedrooms',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'Количество спален' },
    },
    {
      name: 'bathrooms',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'Количество ванных комнат' },
    },
    {
      name: 'maxGuests',
      type: 'number',
      defaultValue: 2,
      admin: { description: 'Максимум гостей' },
    },
    {
      name: 'checkInTime',
      type: 'text',
      defaultValue: '15:00',
      admin: { description: 'Время заезда' },
    },
    {
      name: 'checkOutTime',
      type: 'text',
      defaultValue: '11:00',
      admin: { description: 'Время выезда' },
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
      name: 'houseRules',
      type: 'relationship',
      relationTo: 'house-rules',
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
