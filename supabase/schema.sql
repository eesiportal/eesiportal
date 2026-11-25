/* ============================================================
   EESI Elevators Inc. — Complete Supabase PostgreSQL Schema
   Aligned 100% with frontend queries, RPCs, Storage & Realtime
   Safe to paste and run directly in Supabase SQL Editor
   ============================================================ */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* 1. PROFILES & ROLES */
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  id_no TEXT,
  address TEXT,
  team TEXT,
  phone TEXT,
  area TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_role TEXT NOT NULL DEFAULT 'employee'
    CHECK (app_role IN ('admin', 'representative', 'technician', 'employee')),
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'declined')),
  area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  requested_role TEXT NOT NULL DEFAULT 'employee',
  id_no TEXT,
  address TEXT,
  team TEXT,
  phone TEXT,
  area TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_approval_status_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected', 'declined'));
ALTER TABLE public.registration_requests DROP CONSTRAINT IF EXISTS registration_requests_status_check;
ALTER TABLE public.registration_requests ADD CONSTRAINT registration_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'declined'));

/* 2. OPERATIONS TABLES */
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_name TEXT;

CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  region TEXT DEFAULT 'Visayas',
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'Operational',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'Visayas';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Operational';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.site_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'elevator',
  status TEXT NOT NULL DEFAULT 'Operational',
  brand_model TEXT,
  serial_no TEXT,
  capacity_floors TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.site_units ADD COLUMN IF NOT EXISTS brand_model TEXT;
ALTER TABLE public.site_units ADD COLUMN IF NOT EXISTS serial_no TEXT;
ALTER TABLE public.site_units ADD COLUMN IF NOT EXISTS capacity_floors TEXT;
ALTER TABLE public.site_units ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.site_units ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  region TEXT,
  scheduled_date DATE,
  scheduled_time TEXT,
  time_in TEXT,
  time_out TEXT,
  priority TEXT NOT NULL DEFAULT 'Normal',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS time_in TEXT;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS time_out TEXT;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Normal';
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.service_delivery_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL DEFAULT 'service'
    CHECK (report_type IN ('service', 'delivery')),
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  details TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pms_checklist_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unit_type TEXT NOT NULL DEFAULT 'elevator'
    CHECK (unit_type IN ('elevator', 'escalator')),
  checklist_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items_passed INTEGER NOT NULL DEFAULT 0,
  items_total INTEGER NOT NULL DEFAULT 0,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dtr_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  job TEXT,
  time_in TEXT,
  time_out TEXT,
  overtime_approved BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by TEXT,
  nightshift_repair BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.dtr_entries ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.dtr_entries ADD COLUMN IF NOT EXISTS nightshift_repair BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.dtr_entries ALTER COLUMN overtime_approved SET DEFAULT TRUE;
ALTER TABLE public.dtr_entries ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.dtr_entries ALTER COLUMN job DROP NOT NULL;
ALTER TABLE public.dtr_entries ALTER COLUMN time_in DROP NOT NULL;
ALTER TABLE public.dtr_entries ALTER COLUMN time_out DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.dtr_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('time_in', 'time_out')),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_24 TEXT,
  time_12 TEXT,
  location TEXT,
  unit TEXT,
  note TEXT,
  ai_summary TEXT,
  image_url TEXT,
  dtr_entry_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.dtr_time_logs ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.dtr_time_logs ADD COLUMN IF NOT EXISTS dtr_entry_id TEXT;

CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  basic_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  night_diff_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  night_diff_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  sss NUMERIC(12,2) NOT NULL DEFAULT 0,
  philhealth NUMERIC(12,2) NOT NULL DEFAULT 0,
  pagibig NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_advance NUMERIC(12,2) NOT NULL DEFAULT 0,
  absent NUMERIC(12,2) NOT NULL DEFAULT 0,
  abuloy NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  condition TEXT,
  part TEXT NOT NULL,
  reason TEXT,
  site TEXT,
  specific_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS specific_location TEXT;

CREATE TABLE IF NOT EXISTS public.recommendation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'vacation'
    CHECK (leave_type IN ('sick', 'emergency', 'vacation', 'others')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  calendar_days INTEGER NOT NULL DEFAULT 1,
  workdays INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_leave_type_check CHECK (leave_type IN ('sick', 'emergency', 'vacation', 'others'));
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS calendar_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS workdays INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS review_note TEXT;

/* 3. CHAT, REACTIONS, NOTIFICATIONS, TELEMETRY & PUSH */
CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'direct'
    CHECK (kind IN ('direct', 'group')),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'direct';

CREATE TABLE IF NOT EXISTS public.thread_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(thread_id, user_id)
);
ALTER TABLE public.thread_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.messages (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  body TEXT DEFAULT '',
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  reply_to_id BIGINT REFERENCES public.messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.service_delivery_reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
DECLARE
  v_rep_type TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_notifications' AND column_name = 'report_id'
  ) THEN
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_rep_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'service_delivery_reports' AND a.attname = 'id' AND NOT a.attisdropped;

    IF v_rep_type IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.app_notifications ADD COLUMN report_id %s REFERENCES public.service_delivery_reports(id) ON DELETE CASCADE',
        v_rep_type
      );
    ELSE
      ALTER TABLE public.app_notifications ADD COLUMN report_id TEXT;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_dismissals (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_key TEXT NOT NULL,
  dismissed BOOLEAN NOT NULL DEFAULT TRUE,
  is_read BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notice_key)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_locations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  sender_name TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'text')),
  caption TEXT,
  bg_color TEXT DEFAULT '#1e6cf2',
  bg_style TEXT DEFAULT 'linear-gradient(135deg,#1e6cf2,#0d2549)',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS bg_style TEXT;

/* 4. SECURITY HELPER FUNCTIONS */
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND approval_status = 'approved'
      AND app_role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND approval_status = 'approved'
      AND app_role IN ('admin', 'representative')
  );
$$;

DROP FUNCTION IF EXISTS public.is_thread_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_thread_member(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.is_thread_member(INTEGER) CASCADE;
DO $$
DECLARE
  v_tid_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_tid_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'threads' AND a.attname = 'id' AND NOT a.attisdropped;

  v_tid_type := COALESCE(v_tid_type, 'uuid');

  EXECUTE replace($fn$
    CREATE OR REPLACE FUNCTION public.is_thread_member(p_thread_id __TID_TYPE__)
    RETURNS BOOLEAN
    LANGUAGE SQL
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1 FROM public.thread_members
        WHERE thread_id = p_thread_id AND user_id = auth.uid()
      );
    $body$;
  $fn$, '__TID_TYPE__', v_tid_type);
END $$;

DROP FUNCTION IF EXISTS public.can_comment_recommendation(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_comment_recommendation(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.can_comment_recommendation(INTEGER) CASCADE;
DO $$
DECLARE
  v_rec_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_rec_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'recommendations' AND a.attname = 'id' AND NOT a.attisdropped;

  v_rec_type := COALESCE(v_rec_type, 'uuid');

  EXECUTE replace($fn$
    CREATE OR REPLACE FUNCTION public.can_comment_recommendation(rec_id __REC_ID_TYPE__)
    RETURNS BOOLEAN
    LANGUAGE SQL
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1
        FROM public.recommendations r
        LEFT JOIN public.profiles p ON p.user_id = auth.uid()
        WHERE r.id = rec_id
          AND (
            r.user_id = auth.uid()
            OR public.is_manager()
            OR (
              COALESCE(p.full_name, '') <> ''
              AND (
                COALESCE(r.reason, '') ILIKE ('%' || p.full_name || '%')
                OR COALESCE(r.reason, '') ILIKE ('%@' || p.full_name || '%')
              )
            )
          )
      );
    $body$;
  $fn$, '__REC_ID_TYPE__', v_rec_type);
END $$;

/* 5. RPC FUNCTIONS */
DROP FUNCTION IF EXISTS public.submit_registration_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_registration_request(
  p_user_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_requested_role TEXT DEFAULT 'employee',
  p_id_no TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_team TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, id_no, address, team, phone, area)
  VALUES (p_user_id, p_full_name, p_email, p_id_no, p_address, p_team, p_phone, p_area)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    id_no = COALESCE(EXCLUDED.id_no, public.profiles.id_no),
    address = COALESCE(EXCLUDED.address, public.profiles.address),
    team = COALESCE(EXCLUDED.team, public.profiles.team),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    area = COALESCE(EXCLUDED.area, public.profiles.area),
    updated_at = NOW();

  -- New registrations always start as Employee; Admin/Representative assigns final designation after approval
  INSERT INTO public.user_roles (user_id, app_role, approval_status, area)
  VALUES (p_user_id, 'employee', 'pending', p_area)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.registration_requests (user_id, full_name, email, requested_role, id_no, address, team, phone, area, status)
  VALUES (p_user_id, p_full_name, p_email, 'employee', p_id_no, p_address, p_team, p_phone, p_area, 'pending')
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    requested_role = 'employee',
    id_no = EXCLUDED.id_no,
    address = EXCLUDED.address,
    team = EXCLUDED.team,
    phone = EXCLUDED.phone,
    area = EXCLUDED.area,
    status = 'pending';
END;
$$;

DROP FUNCTION IF EXISTS public.save_push_subscription(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT DEFAULT NULL,
  p_auth TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent, NOW())
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = auth.uid(),
    p256dh = COALESCE(EXCLUDED.p256dh, public.push_subscriptions.p256dh),
    auth = COALESCE(EXCLUDED.auth, public.push_subscriptions.auth),
    user_agent = COALESCE(EXCLUDED.user_agent, public.push_subscriptions.user_agent),
    updated_at = NOW();
END;
$$;

DROP FUNCTION IF EXISTS public.get_or_create_direct_thread(UUID);
CREATE OR REPLACE FUNCTION public.get_or_create_direct_thread(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT t.id INTO v_thread_id
  FROM public.threads t
  JOIN public.thread_members m1 ON m1.thread_id = t.id AND m1.user_id = auth.uid()
  JOIN public.thread_members m2 ON m2.thread_id = t.id AND m2.user_id = other_user_id
  WHERE t.kind = 'direct'
  LIMIT 1;

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  INSERT INTO public.threads (kind, title)
  VALUES ('direct', NULL)
  RETURNING id INTO v_thread_id;

  INSERT INTO public.thread_members (thread_id, user_id)
  VALUES (v_thread_id, auth.uid()), (v_thread_id, other_user_id)
  ON CONFLICT DO NOTHING;

  RETURN v_thread_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_group_thread(TEXT, UUID[]);
CREATE OR REPLACE FUNCTION public.create_group_thread(p_title TEXT, p_member_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
  v_uid UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.threads (kind, title)
  VALUES ('group', COALESCE(NULLIF(TRIM(p_title), ''), 'Team Chat'))
  RETURNING id INTO v_thread_id;

  INSERT INTO public.thread_members (thread_id, user_id)
  VALUES (v_thread_id, auth.uid())
  ON CONFLICT DO NOTHING;

  IF p_member_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_member_ids LOOP
      IF v_uid IS NOT NULL THEN
        INSERT INTO public.thread_members (thread_id, user_id)
        VALUES (v_thread_id, v_uid)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_thread_id;
END;
$$;

DROP FUNCTION IF EXISTS public.react_to_message(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.react_to_message(p_message_id BIGINT, p_emoji TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tid UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT thread_id INTO v_tid FROM public.messages WHERE id = p_message_id;
  IF v_tid IS NULL OR NOT public.is_thread_member(v_tid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji
  ) THEN
    DELETE FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
  ELSE
    INSERT INTO public.message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.mark_thread_messages_delivered(UUID);
CREATE OR REPLACE FUNCTION public.mark_thread_messages_delivered(p_thread_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.thread_members
  SET last_read_at = NOW()
  WHERE thread_id = p_thread_id AND user_id = auth.uid();
END;
$$;

/* 6. ENABLE ROW LEVEL SECURITY & POLICIES */
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_delivery_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_checklist_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtr_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtr_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_locations ENABLE ROW LEVEL SECURITY;

/* Profiles */
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.is_approved_user());
DROP POLICY IF EXISTS profiles_upsert ON public.profiles;
CREATE POLICY profiles_upsert ON public.profiles FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS profiles_manager_insert ON public.profiles;
CREATE POLICY profiles_manager_insert ON public.profiles FOR INSERT WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS profiles_manager_update ON public.profiles;
CREATE POLICY profiles_manager_update ON public.profiles FOR UPDATE
  USING (
    public.is_manager() AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = public.profiles.user_id
        AND ur.app_role IN ('admin', 'representative')
    )
  )
  WITH CHECK (public.is_manager());

/* User roles */
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_approved_user());
DROP POLICY IF EXISTS user_roles_admin ON public.user_roles;
CREATE POLICY user_roles_admin ON public.user_roles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS user_roles_manager_insert ON public.user_roles;
CREATE POLICY user_roles_manager_insert ON public.user_roles FOR INSERT
  WITH CHECK (public.is_manager() AND app_role IN ('employee', 'technician'));
DROP POLICY IF EXISTS user_roles_manager_update ON public.user_roles;
CREATE POLICY user_roles_manager_update ON public.user_roles FOR UPDATE
  USING (public.is_manager() AND app_role IN ('employee', 'technician'))
  WITH CHECK (public.is_manager() AND app_role IN ('employee', 'technician'));

/* Registration requests */
DROP POLICY IF EXISTS reg_req_select ON public.registration_requests;
CREATE POLICY reg_req_select ON public.registration_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin() OR public.is_manager());
DROP POLICY IF EXISTS reg_req_admin ON public.registration_requests;
CREATE POLICY reg_req_admin ON public.registration_requests FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());

/* Announcements */
DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS announcements_manage ON public.announcements;
CREATE POLICY announcements_manage ON public.announcements FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());

/* Sites & Site Units */
DROP POLICY IF EXISTS sites_select ON public.sites;
CREATE POLICY sites_select ON public.sites FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS sites_manage ON public.sites;
CREATE POLICY sites_manage ON public.sites FOR ALL USING (public.is_approved_user()) WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS site_units_select ON public.site_units;
CREATE POLICY site_units_select ON public.site_units FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS site_units_manage ON public.site_units;
CREATE POLICY site_units_manage ON public.site_units FOR ALL USING (public.is_approved_user()) WITH CHECK (public.is_approved_user());

/* Schedules */
DROP POLICY IF EXISTS schedules_select ON public.schedules;
CREATE POLICY schedules_select ON public.schedules FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS schedules_manage ON public.schedules;
CREATE POLICY schedules_manage ON public.schedules FOR ALL USING (public.is_manager() OR auth.uid() = created_by) WITH CHECK (public.is_manager() OR auth.uid() = created_by);

/* Service / Delivery Reports */
DROP POLICY IF EXISTS reports_select ON public.service_delivery_reports;
CREATE POLICY reports_select ON public.service_delivery_reports FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS reports_insert ON public.service_delivery_reports;
CREATE POLICY reports_insert ON public.service_delivery_reports FOR INSERT WITH CHECK (public.is_approved_user());
DROP POLICY IF EXISTS reports_modify ON public.service_delivery_reports;
CREATE POLICY reports_modify ON public.service_delivery_reports FOR UPDATE USING (public.is_manager() OR auth.uid() = created_by) WITH CHECK (public.is_manager() OR auth.uid() = created_by);
DROP POLICY IF EXISTS reports_delete ON public.service_delivery_reports;
CREATE POLICY reports_delete ON public.service_delivery_reports FOR DELETE USING (public.is_manager() OR auth.uid() = created_by);

/* PMS Checklist Records */
DROP POLICY IF EXISTS pms_select ON public.pms_checklist_records;
CREATE POLICY pms_select ON public.pms_checklist_records FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS pms_insert ON public.pms_checklist_records;
CREATE POLICY pms_insert ON public.pms_checklist_records FOR INSERT WITH CHECK (public.is_approved_user());
DROP POLICY IF EXISTS pms_modify ON public.pms_checklist_records;
CREATE POLICY pms_modify ON public.pms_checklist_records FOR DELETE USING (public.is_manager() OR auth.uid() = user_id);

/* DTR Entries (Time In / Time Out slots per employee) */
DROP POLICY IF EXISTS dtr_select ON public.dtr_entries;
CREATE POLICY dtr_select ON public.dtr_entries FOR SELECT USING (public.is_manager() OR auth.uid() = user_id);
DROP POLICY IF EXISTS dtr_insert ON public.dtr_entries;
CREATE POLICY dtr_insert ON public.dtr_entries FOR INSERT WITH CHECK (public.is_approved_user() AND (auth.uid() = user_id OR public.is_manager()));
DROP POLICY IF EXISTS dtr_update ON public.dtr_entries;
CREATE POLICY dtr_update ON public.dtr_entries FOR UPDATE USING (public.is_manager() OR auth.uid() = user_id) WITH CHECK (public.is_manager() OR auth.uid() = user_id);
DROP POLICY IF EXISTS dtr_delete ON public.dtr_entries;
CREATE POLICY dtr_delete ON public.dtr_entries FOR DELETE USING (public.is_manager() OR auth.uid() = user_id);

/* Shared Time In / Out Photo Logs */
DROP POLICY IF EXISTS dtr_time_logs_select ON public.dtr_time_logs;
CREATE POLICY dtr_time_logs_select ON public.dtr_time_logs FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS dtr_time_logs_insert ON public.dtr_time_logs;
CREATE POLICY dtr_time_logs_insert ON public.dtr_time_logs FOR INSERT WITH CHECK (public.is_approved_user() AND auth.uid() = user_id);
DROP POLICY IF EXISTS dtr_time_logs_delete ON public.dtr_time_logs;
CREATE POLICY dtr_time_logs_delete ON public.dtr_time_logs FOR DELETE USING (auth.uid() = user_id OR public.is_manager());

/* Payslips */
DROP POLICY IF EXISTS payslips_select ON public.payslips;
CREATE POLICY payslips_select ON public.payslips FOR SELECT USING (public.is_manager() OR auth.uid() = user_id);
DROP POLICY IF EXISTS payslips_insert ON public.payslips;
CREATE POLICY payslips_insert ON public.payslips FOR INSERT WITH CHECK (public.is_approved_user() AND (public.is_manager() OR auth.uid() = user_id));
DROP POLICY IF EXISTS payslips_update ON public.payslips;
CREATE POLICY payslips_update ON public.payslips FOR UPDATE USING (public.is_manager() OR auth.uid() = user_id) WITH CHECK (public.is_manager() OR auth.uid() = user_id);
DROP POLICY IF EXISTS payslips_delete ON public.payslips;
CREATE POLICY payslips_delete ON public.payslips FOR DELETE USING (public.is_manager() OR auth.uid() = user_id);

/* Notes */
DROP POLICY IF EXISTS notes_select ON public.notes;
CREATE POLICY notes_select ON public.notes FOR SELECT USING (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS notes_manage ON public.notes;
CREATE POLICY notes_manage ON public.notes FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

/* Recommendations & Comments */
DROP POLICY IF EXISTS recs_select ON public.recommendations;
CREATE POLICY recs_select ON public.recommendations FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS recs_insert ON public.recommendations;
CREATE POLICY recs_insert ON public.recommendations FOR INSERT WITH CHECK (public.is_approved_user());
DROP POLICY IF EXISTS recs_modify ON public.recommendations;
CREATE POLICY recs_modify ON public.recommendations FOR ALL USING (public.is_manager() OR auth.uid() = user_id) WITH CHECK (public.is_manager() OR auth.uid() = user_id);

DROP POLICY IF EXISTS rec_comments_select ON public.recommendation_comments;
CREATE POLICY rec_comments_select ON public.recommendation_comments FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS rec_comments_insert ON public.recommendation_comments;
CREATE POLICY rec_comments_insert ON public.recommendation_comments FOR INSERT WITH CHECK (public.is_approved_user() AND auth.uid() = user_id AND public.can_comment_recommendation(recommendation_id));
DROP POLICY IF EXISTS rec_comments_delete ON public.recommendation_comments;
CREATE POLICY rec_comments_delete ON public.recommendation_comments FOR DELETE USING (auth.uid() = user_id OR public.is_manager());

/* Leave Requests */
DROP POLICY IF EXISTS leave_select ON public.leave_requests;
CREATE POLICY leave_select ON public.leave_requests FOR SELECT USING (public.is_manager() OR auth.uid() = user_id);
DROP POLICY IF EXISTS leave_insert ON public.leave_requests;
CREATE POLICY leave_insert ON public.leave_requests FOR INSERT WITH CHECK (public.is_approved_user() AND auth.uid() = user_id);
DROP POLICY IF EXISTS leave_update ON public.leave_requests;
CREATE POLICY leave_update ON public.leave_requests FOR UPDATE
  USING (public.is_manager() OR (auth.uid() = user_id AND status = 'pending'))
  WITH CHECK (public.is_manager() OR (auth.uid() = user_id AND status = 'pending'));
DROP POLICY IF EXISTS leave_delete ON public.leave_requests;
CREATE POLICY leave_delete ON public.leave_requests FOR DELETE
  USING (public.is_manager() OR (auth.uid() = user_id AND status = 'pending'));

/* Threads, Members, Messages, Reactions */
DROP POLICY IF EXISTS threads_select ON public.threads;
CREATE POLICY threads_select ON public.threads FOR SELECT USING (public.is_thread_member(id));
DROP POLICY IF EXISTS threads_manage ON public.threads;
CREATE POLICY threads_manage ON public.threads FOR ALL USING (public.is_thread_member(id)) WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS thread_members_select ON public.thread_members;
CREATE POLICY thread_members_select ON public.thread_members FOR SELECT USING (public.is_thread_member(thread_id));
DROP POLICY IF EXISTS thread_members_manage ON public.thread_members;
CREATE POLICY thread_members_manage ON public.thread_members FOR ALL USING (public.is_thread_member(thread_id)) WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT USING (public.is_thread_member(thread_id));
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (public.is_approved_user() AND auth.uid() = user_id AND public.is_thread_member(thread_id));
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages FOR UPDATE USING (public.is_thread_member(thread_id)) WITH CHECK (public.is_thread_member(thread_id));

DROP POLICY IF EXISTS reactions_select ON public.message_reactions;
CREATE POLICY reactions_select ON public.message_reactions FOR SELECT USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_thread_member(m.thread_id)));
DROP POLICY IF EXISTS reactions_manage ON public.message_reactions;
CREATE POLICY reactions_manage ON public.message_reactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* User Blocks, Notifications, Push, Locations */
DROP POLICY IF EXISTS user_blocks_manage ON public.user_blocks;
CREATE POLICY user_blocks_manage ON public.user_blocks FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS app_notif_manage ON public.app_notifications;
CREATE POLICY app_notif_manage ON public.app_notifications FOR ALL USING (public.is_approved_user()) WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS appr_notif_manage ON public.approval_notifications;
CREATE POLICY appr_notif_manage ON public.approval_notifications FOR ALL USING (public.is_manager() OR auth.uid() = recipient_user_id) WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS notif_dismiss_manage ON public.notification_dismissals;
CREATE POLICY notif_dismiss_manage ON public.notification_dismissals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_sub_manage ON public.push_subscriptions;
CREATE POLICY push_sub_manage ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS emp_loc_select ON public.employee_locations;
CREATE POLICY emp_loc_select ON public.employee_locations FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS emp_loc_upsert ON public.employee_locations;
CREATE POLICY emp_loc_upsert ON public.employee_locations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* Chat Stories / My Day / Reels */
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stories_select ON public.stories;
CREATE POLICY stories_select ON public.stories FOR SELECT USING (public.is_approved_user());
DROP POLICY IF EXISTS stories_insert ON public.stories;
CREATE POLICY stories_insert ON public.stories FOR INSERT WITH CHECK (public.is_approved_user() AND auth.uid() = user_id);
DROP POLICY IF EXISTS stories_delete ON public.stories;
CREATE POLICY stories_delete ON public.stories FOR DELETE USING (auth.uid() = user_id OR public.is_manager());

/* 7. STORAGE BUCKETS & POLICIES */
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', TRUE),
  ('covers', 'covers', TRUE),
  ('reports', 'reports', TRUE),
  ('chat', 'chat', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS storage_public_read ON storage.objects;
CREATE POLICY storage_public_read ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'covers', 'reports', 'chat'));

DROP POLICY IF EXISTS storage_auth_insert ON storage.objects;
CREATE POLICY storage_auth_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('avatars', 'covers', 'reports', 'chat') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS storage_auth_update ON storage.objects;
CREATE POLICY storage_auth_update ON storage.objects FOR UPDATE USING (bucket_id IN ('avatars', 'covers', 'reports', 'chat') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS storage_auth_delete ON storage.objects;
CREATE POLICY storage_auth_delete ON storage.objects FOR DELETE USING (bucket_id IN ('avatars', 'covers', 'reports', 'chat') AND auth.role() = 'authenticated');

/* 8. REALTIME PUBLICATION */
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'announcements',
    'schedules',
    'sites',
    'site_units',
    'service_delivery_reports',
    'pms_checklist_records',
    'dtr_entries',
    'dtr_time_logs',
    'recommendations',
    'recommendation_comments',
    'leave_requests',
    'threads',
    'thread_members',
    'messages',
    'message_reactions',
    'app_notifications',
    'approval_notifications',
    'notification_dismissals',
    'employee_locations',
    'stories',
    'payslips'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

/* 9. PERFORMANCE INDEXES */
CREATE INDEX IF NOT EXISTS idx_schedules_date ON public.schedules (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_site_units_site_id ON public.site_units (site_id);
CREATE INDEX IF NOT EXISTS idx_dtr_entries_user_date ON public.dtr_entries (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_dtr_time_logs_created_at ON public.dtr_time_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dtr_time_logs_user_date ON public.dtr_time_logs (user_id, work_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON public.recommendations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories (expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON public.messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_thread_members_user ON public.thread_members (user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests (user_id, created_at DESC);
ALTER TABLE public.employee_locations ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_employee_locations_updated ON public.employee_locations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created ON public.app_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_date_created ON public.service_delivery_reports (report_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pms_date_created ON public.pms_checklist_records (checklist_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_dismissals_user ON public.notification_dismissals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payslips_user_period ON public.payslips (user_id, period_end DESC, created_at DESC);

/* 10. SEED AYALA MALLS CENTRAL BLOC (AMCB) & 34 UNITS */
DO $$
DECLARE
  v_site_id_text TEXT;
  v_site_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_site_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'sites' AND a.attname = 'id' AND NOT a.attisdropped;

  v_site_type := COALESCE(v_site_type, 'uuid');

  SELECT id::TEXT INTO v_site_id_text
  FROM public.sites
  WHERE LOWER(name) LIKE '%ayala%central bloc%' OR UPPER(TRIM(name)) = 'AMCB'
  LIMIT 1;

  IF v_site_id_text IS NULL THEN
    INSERT INTO public.sites (name, address, city, region)
    VALUES ('Ayala Malls Central Bloc (AMCB)', 'Cebu IT Park, Apas', 'Cebu City', 'Visayas')
    RETURNING id::TEXT INTO v_site_id_text;
  END IF;

  EXECUTE replace($ins$
    INSERT INTO public.site_units (site_id, unit_name, unit_type, status, capacity_floors, notes)
    SELECT $1::__SITE_ID_TYPE__, u.unit_name, u.unit_type, 'Operational', u.capacity_floors, u.notes
    FROM (VALUES
      ('Esc. No. 19 B2-B3', 'escalator', 'B2-B3', 'SEDA SIDE · DOWN'),
      ('Esc. No. 20 B3-B2', 'escalator', 'B3-B2', 'SEDA SIDE · UP'),
      ('Esc. No. 21 B1-B2', 'escalator', 'B1-B2', 'SEDA SIDE · DOWN'),
      ('Esc. No. 22 B2-B1', 'escalator', 'B2-B1', 'SEDA SIDE · UP'),
      ('Esc. No. 3 G-B1', 'escalator', 'G-B1', 'SEDA SIDE · DOWN'),
      ('Esc. No. 4 B1-G', 'escalator', 'B1-G', 'SEDA SIDE · UP'),
      ('Esc. No. 26 2-G', 'escalator', '2-G', 'SEDA SIDE · DOWN · 2 Lgt. Newel Guide Roller (Leftside), 2 Lgt. Newel Guide Roller (Rightside)'),
      ('Esc. No. 25 G-2', 'escalator', 'G-2', 'SEDA SIDE · UP'),
      ('Esc. No. 27 3-2', 'escalator', '3-2', 'SEDA SIDE · DOWN'),
      ('Esc. No. 28 2-3', 'escalator', '2-3', 'SEDA SIDE · UP'),
      ('Esc. No. 17 4-3', 'escalator', '4-3', 'SEDA SIDE · DOWN'),
      ('Esc. No. 18 3-4', 'escalator', '3-4', 'SEDA SIDE · UP'),
      ('Esc. No. 2 B1-B2', 'escalator', 'B1-B2', 'IVILLA SIDE · DOWN'),
      ('Esc. No. 1 B2-B1', 'escalator', 'B2-B1', 'IVILLA SIDE · UP'),
      ('Esc. No. 23 (G-B1)', 'escalator', 'G-B1', 'IVILLA SIDE · DOWN · 1 Lgt. Rubber Handrail (Leftside), 2pcs. Newel Guide Roller (Leftside), 1 Lot. Flywheel (Leftside)'),
      ('Esc. No. 24 B1-G', 'escalator', 'B1-G', 'IVILLA SIDE · UP'),
      ('Esc. No. 6 2-G', 'escalator', '2-G', 'IVILLA SIDE · DOWN'),
      ('Esc. No. 5 G-2', 'escalator', 'G-2', 'IVILLA SIDE · UP'),
      ('Esc. No. 7 3-2', 'escalator', '3-2', 'IVILLA SIDE · DOWN'),
      ('Esc. No. 8 2-3', 'escalator', '2-3', 'IVILLA SIDE · UP'),
      ('Esc. No. 9 4-3', 'escalator', '4-3', 'IVILLA SIDE · DOWN'),
      ('Esc. No. 10 3-4', 'escalator', '3-4', 'IVILLA SIDE · UP'),
      ('Esc. No. 12 5-4', 'escalator', '5-4', 'IVILLA SIDE · DOWN'),
      ('Esc. No. 11 4-5', 'escalator', '4-5', 'IVILLA SIDE · UP'),
      ('PE1', 'elevator', NULL, 'IVILLA SIDE · Passenger Elevator'),
      ('PE2', 'elevator', NULL, 'IVILLA SIDE · Passenger Elevator'),
      ('PE3', 'elevator', NULL, 'IVILLA SIDE · Passenger Elevator'),
      ('Esc. No. 14 2-G', 'escalator', '2-G', 'PADRIGA SIDE · DOWN'),
      ('Esc. No. 13 G-2', 'escalator', 'G-2', 'PADRIGA SIDE · UP'),
      ('Esc. No. 30 3-2', 'escalator', '3-2', 'PADRIGA SIDE · DOWN'),
      ('Esc. No. 29 2-3', 'escalator', '2-3', 'PADRIGA SIDE · UP'),
      ('Esc. No. 16 4-3', 'escalator', '4-3', 'PADRIGA SIDE · DOWN'),
      ('Esc. No. 15 3-4', 'escalator', '3-4', 'PADRIGA SIDE · UP'),
      ('CARGO', 'elevator', NULL, 'PADRIGA SIDE · Cargo Elevator')
    ) AS u(unit_name, unit_type, capacity_floors, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.site_units su
      WHERE su.site_id = $1::__SITE_ID_TYPE__ AND LOWER(TRIM(su.unit_name)) = LOWER(TRIM(u.unit_name))
    );
  $ins$, '__SITE_ID_TYPE__', v_site_type)
  USING v_site_id_text;
END $$;

NOTIFY pgrst, 'reload schema';
