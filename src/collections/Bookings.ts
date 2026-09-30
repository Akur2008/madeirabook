import type { CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'guestEmail',
    defaultColumns: ['property', 'arrivalDate', 'departureDate', 'status', 'amountCents', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  timestamps: true,
  fields: [
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
    },
    {
      name: 'guestTelegramId',
      type: 'number',
      index: true,
    },
    {
      name: 'guestEmail',
      type: 'email',
    },
    {
      name: 'arrivalDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'departureDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'direct',
      options: [
        { label: 'Booking channel', value: 'booking_channel' },
        { label: 'Direct', value: 'direct' },
        { label: 'Owner manual', value: 'owner_manual' },
      ],
    },
    {
      name: 'amountCents',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Сумма в центах (EUR)' },
    },
    {
      name: 'platformFeeCents',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'smoobuBookingId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripeSessionId',
      type: 'text',
      unique: true,
    },
    {
      name: 'stripePaymentIntent',
      type: 'text',
    },
  ],
}
