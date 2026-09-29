const UPDATED = '2026-09-29';

const CONTACT = 'hello@madeirabook.com';

module.exports = {
  privacy: {
    title: 'Privacy Policy',
    description: 'How Madeirabook collects, uses and protects personal data of '
      + 'guests and property owners under the GDPR.',
    updated: UPDATED,
    body: `
      <p>Madeirabook ("we") operates the booking platform at madeirabook.com for
      apartments and small hotels on Madeira, Portugal. This policy explains what
      personal data we process, why, and what rights you have under the General
      Data Protection Regulation (EU) 2016/679.</p>

      <h2>Data we collect</h2>
      <ul>
        <li><b>Guests:</b> name, email, booking dates, property, payment status.
        Card details are handled by Stripe and never reach our servers.</li>
        <li><b>Property owners:</b> email, RNAL number, Stripe account
        identifier, subscription status.</li>
        <li><b>Subscribers:</b> email address and the page you subscribed from.</li>
        <li><b>Telegram users:</b> Telegram ID and chat ID, if you use our bot or
        mini app.</li>
        <li><b>Technical data:</b> request logs (IP, user agent, timestamps) kept
        for security and debugging.</li>
      </ul>

      <h2>Why we process it</h2>
      <ul>
        <li>Performance of a contract — creating and managing bookings, payouts
        and owner subscriptions.</li>
        <li>Legal obligation — tax and reporting duties in Portugal, including
        DAC7 reporting to the Autoridade Tributária.</li>
        <li>Legitimate interest — fraud prevention, service security, internal
        accounting.</li>
        <li>Consent — the travel guide newsletter, which you can withdraw at any
        time via the unsubscribe link.</li>
      </ul>

      <h2>Processors we use</h2>
      <p>Stripe (payments and Connect payouts), Smoobu (property management
      system), Resend (transactional email), Neon (database hosting), Vercel
      (application hosting), Telegram (bot and mini app). Each acts as a
      processor or independent controller under its own terms.</p>

      <h2>Retention</h2>
      <p>Booking and invoicing records are kept for 10 years, as required by
      Portuguese accounting law. Newsletter data is kept until you unsubscribe.
      Request logs are kept for 30 days.</p>

      <h2>Your rights</h2>
      <p>You may request access, rectification, erasure, restriction,
      portability, or object to processing by writing to
      <a href="mailto:${CONTACT}">${CONTACT}</a>. You may also lodge a complaint
      with the Portuguese data protection authority (CNPD).</p>
    `
  },

  terms: {
    title: 'Terms of Service',
    description: 'Terms governing the use of the Madeirabook booking platform by '
      + 'guests and property owners.',
    updated: UPDATED,
    body: `
      <p>These terms govern the use of madeirabook.com. By booking a stay or
      listing a property you accept them.</p>

      <h2>Role of the platform</h2>
      <p>Madeirabook is an intermediary. The accommodation contract is concluded
      directly between the guest and the property owner, who is the merchant of
      record for the stay and is responsible for issuing fiscal documents under
      Portuguese law.</p>

      <h2>Bookings and prices</h2>
      <p>Prices are taken from the owner's property management system and shown
      inclusive of the platform commission. A booking is confirmed only after a
      successful payment; until then its status is pending and it may expire.</p>

      <h2>Payments</h2>
      <p>Payments are processed by Stripe. Funds are transferred to the owner's
      Stripe Connect account, less the platform commission of up to 12% agreed
      per property.</p>

      <h2>Owner obligations</h2>
      <p>Owners must hold a valid RNAL (Alojamento Local) registration, keep
      availability and pricing accurate, honour confirmed bookings, and comply
      with their own tax obligations. Access to the owner dashboard requires an
      active subscription of €25 per month per unit.</p>

      <h2>Cancellations and refunds</h2>
      <p>Cancellation terms are set by the property and shown before payment.
      Approved refunds are returned to the original payment method; the platform
      commission is refunded proportionally.</p>

      <h2>Liability</h2>
      <p>We are not liable for the condition of the accommodation or for acts of
      guests or owners. Our liability for the service itself is limited to the
      commission received for the affected booking, except where liability cannot
      be limited by law.</p>

      <h2>Governing law</h2>
      <p>Portuguese law applies; the courts of Funchal, Madeira have
      jurisdiction. Questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
    `
  },

  cookies: {
    title: 'Cookie Policy',
    description: 'Cookies used by Madeirabook and how to control them.',
    updated: UPDATED,
    body: `
      <p>We keep cookies to the minimum required to run the service.</p>

      <h2>Strictly necessary</h2>
      <ul>
        <li><code>connect.sid</code> — session cookie for the owner dashboard and
        admin area. Expires after 30 days or on logout.</li>
        <li>Stripe cookies set on the hosted checkout page for fraud prevention;
        see the Stripe privacy policy.</li>
      </ul>

      <h2>Analytics and marketing</h2>
      <p>We do not set analytics, advertising or profiling cookies, so no consent
      banner is required for them.</p>

      <h2>Controlling cookies</h2>
      <p>You can delete or block cookies in your browser settings. Blocking the
      session cookie makes the owner dashboard unusable. Questions:
      <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
    `
  }
};
