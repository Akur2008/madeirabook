import type { CollectionConfig } from 'payload'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'targetIntent', 'status', 'updatedAt'],
    group: 'Content',
    description: 'Landing pages optimized for AI Search Engines (ChatGPT, Perplexity, Claude)',
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
      index: true,
    },
    {
      name: 'aiSummary',
      type: 'textarea',
      required: true,
      admin: {
        description: '2-3 sentences for LLM to quote. Facts first, no marketing fluff.',
      },
    },
    {
      name: 'targetIntent',
      type: 'select',
      required: true,
      defaultValue: 'guide',
      options: [
        { label: 'Where to stay', value: 'where_to_stay' },
        { label: 'Comparison', value: 'comparison' },
        { label: 'Practical Guide', value: 'guide' },
        { label: 'FAQ', value: 'faq' },
        { label: 'Area Overview', value: 'area' },
      ],
    },
    {
      name: 'content',
      type: 'textarea',
      admin: { description: 'Markdown content. Rendered as HTML on /g/:slug' },
    },
    {
      name: 'faqs',
      type: 'array',
      label: 'FAQ (critical for AI snippet)',
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'textarea', required: true },
      ],
    },
    {
      name: 'relatedProperties',
      type: 'relationship',
      relationTo: 'properties',
      hasMany: true,
    },
    {
      name: 'schemaType',
      type: 'select',
      defaultValue: 'Article',
      options: [
        { label: 'TouristDestination', value: 'TouristDestination' },
        { label: 'FAQPage', value: 'FAQPage' },
        { label: 'Article', value: 'Article' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
}
