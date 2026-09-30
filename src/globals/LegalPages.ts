import type { GlobalConfig } from 'payload'

export const CookiePolicy: GlobalConfig = {
  slug: 'cookie_policy',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'textarea' },
    { name: 'last_updated', type: 'date' },
  ],
}

export const PrivacyPolicy: GlobalConfig = {
  slug: 'privacy_policy',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'textarea' },
    { name: 'last_updated', type: 'date' },
  ],
}

export const TermsOfService: GlobalConfig = {
  slug: 'terms_of_service',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'textarea' },
    { name: 'last_updated', type: 'date' },
  ],
}

export const LegalInfo: GlobalConfig = {
  slug: 'legal_info',
  fields: [
    { name: 'livro_de_reclamacoes_title', type: 'text' },
    { name: 'livro_de_reclamacoes_description', type: 'text' },
    { name: 'livro_de_reclamacoes_link', type: 'text' },
    { name: 'cacram_ral_title', type: 'text' },
    { name: 'cacram_ral_description', type: 'text' },
    { name: 'cacram_ral_link', type: 'text' },
    { name: 'cacram_ral_contact_email', type: 'text' },
    { name: 'cacram_ral_contact_phone', type: 'text' },
    { name: 'company_info_company_name', type: 'text' },
    { name: 'company_info_nif', type: 'text' },
    { name: 'company_info_address', type: 'text' },
    { name: 'company_info_email', type: 'text' },
  ],
}
