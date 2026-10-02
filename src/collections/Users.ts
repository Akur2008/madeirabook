import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Owner', value: 'owner' },
      ],
    },
    {
      name: 'stripeAccountId',
      type: 'text',
      unique: true,
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
    },
    {
      name: 'rnal',
      type: 'text',
    },
    {
      name: 'onboardingToken',
      type: 'text',
      unique: true,
    },
    {
      name: 'telegramId',
      type: 'number',
      unique: true,
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      unique: true,
    },
    {
      name: 'subscriptionStatus',
      type: 'text',
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
    },
    {
      name: 'loginToken',
      type: 'text',
      unique: true,
      admin: { hidden: true },
    },
    {
      name: 'loginTokenExpiresAt',
      type: 'date',
      admin: { hidden: true },
    },
  ],
}
