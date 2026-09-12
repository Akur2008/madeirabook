-- ============ OWNERS ============
CREATE TABLE IF NOT EXISTS owners (
  id                 SERIAL PRIMARY KEY,
  email              TEXT UNIQUE NOT NULL,
  stripe_account_id  TEXT UNIQUE,
  stripe_customer_id TEXT,
  password_hash      TEXT,
  rnal               TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============ PROPERTIES ============
CREATE TABLE IF NOT EXISTS properties (
  id                  SERIAL PRIMARY KEY,
  smoobu_id           TEXT UNIQUE NOT NULL,
  owner_id            INT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  commission_percent  NUMERIC(5,2) NOT NULL DEFAULT 12
                      CHECK (commission_percent >= 0 AND commission_percent <= 100),
  charges_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  pms                 TEXT NOT NULL DEFAULT 'smoobu',
  type                TEXT NOT NULL DEFAULT 'apartment'
                      CHECK (type IN ('apartment', 'hotel_room')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);

-- ============ WEBHOOK IDEMPOTENCY ============
CREATE TABLE IF NOT EXISTS webhook_events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  processed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============ COMMISSION AUDIT ============
CREATE TABLE IF NOT EXISTS commission_history (
  id           SERIAL PRIMARY KEY,
  property_id  INT NOT NULL REFERENCES properties(id),
  old_percent  NUMERIC(5,2),
  new_percent  NUMERIC(5,2),
  changed_by   TEXT NOT NULL,
  changed_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============ BOOKINGS ============
CREATE TABLE IF NOT EXISTS bookings (
  id                     SERIAL PRIMARY KEY,
  property_id            INT NOT NULL REFERENCES properties(id),
  smoobu_booking_id      TEXT,
  stripe_session_id      TEXT UNIQUE,
  stripe_payment_intent  TEXT,
  amount_cents           INT NOT NULL,
  platform_fee_cents     INT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','paid','cancelled','refunded')),
  source                 TEXT NOT NULL DEFAULT 'direct'
                         CHECK (source IN ('booking_channel','direct','owner_manual')),
  guest_email            TEXT,
  arrival_date           DATE,
  departure_date         DATE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_smoobu ON bookings(smoobu_booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ============ SUBSCRIPTIONS (Шаг 5) ============
CREATE TABLE IF NOT EXISTS subscription_plans (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  stripe_price_id  TEXT NOT NULL UNIQUE,
  amount_cents     INT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'eur',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_subscriptions (
  id                     SERIAL PRIMARY KEY,
  owner_id               INT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status                 TEXT NOT NULL,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_owner_subs_owner ON owner_subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_subs_status ON owner_subscriptions(status);

-- ============ BILLING NOTICES (Шаг 5) ============
CREATE TABLE IF NOT EXISTS billing_notices (
  id            SERIAL PRIMARY KEY,
  booking_id    INT NOT NULL REFERENCES bookings(id),
  property_id   INT NOT NULL REFERENCES properties(id),
  owner_id      INT NOT NULL REFERENCES owners(id),
  amount_cents  INT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'eur',
  status        TEXT NOT NULL DEFAULT 'pending_accountant_signoff'
                CHECK (status IN ('pending_accountant_signoff','accountant_completed')),
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  completed_by  TEXT,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_billing_notices_status ON billing_notices(status);
