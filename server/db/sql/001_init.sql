-- SNEPMI Mini App: initial schema.
-- Mirrors the data model of the original site bundle (blogger records,
-- lead form fields) and adds the storage the site never had: leads,
-- settings and uploaded photography.

CREATE TABLE IF NOT EXISTS bloggers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  nickname        text,
  image_url       text,
  social_url      text,
  platform        text,
  social_links    jsonb NOT NULL DEFAULT '[]'::jsonb,
  followers       integer,
  average_views   integer,
  topics          jsonb NOT NULL DEFAULT '[]'::jsonb,
  formats         jsonb NOT NULL DEFAULT '[]'::jsonb,
  price           numeric(12, 2),
  description     text,
  audience        text,
  geography       text,
  image_kind      text NOT NULL DEFAULT 'photo' CHECK (image_kind IN ('photo', 'cutout')),
  published       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  category        text CHECK (category IN ('large', 'medium', 'small', 'unassigned')),
  featured_first  boolean NOT NULL DEFAULT false,
  rkn_registered  boolean,
  ad_contact      text,
  ad_terms        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ad_restrictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bloggers_published_idx ON bloggers (published, sort_order);

CREATE TABLE IF NOT EXISTS leads (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  company        text NOT NULL,
  contact        text NOT NULL,
  social_url     text,
  task           text NOT NULL,
  blogger_ids    jsonb NOT NULL DEFAULT '[]'::jsonb,
  blogger_names  jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget         text,
  launch_date    text,
  consent        boolean NOT NULL DEFAULT false,
  source         text NOT NULL DEFAULT 'mini_app',
  tg_user_id     bigint,
  tg_username    text,
  status         text NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'in_work', 'contacted', 'done', 'rejected')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status, created_at DESC);

-- One row: the site configuration the bundle kept in a hard-coded object.
CREATE TABLE IF NOT EXISTS settings (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  telegram        text,
  email           text,
  leads_ready     boolean NOT NULL DEFAULT false,
  privacy_url     text,
  operator        text,
  admin_user_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Admin uploads live in the database: Render's free disk is wiped on redeploy.
CREATE TABLE IF NOT EXISTS media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text NOT NULL,
  content_type text NOT NULL,
  byte_size    integer NOT NULL,
  data         bytea NOT NULL,
  created_by   bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);
