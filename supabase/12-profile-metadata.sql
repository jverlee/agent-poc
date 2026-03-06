-- 12. Add metadata JSONB column to profiles for extensible user data (phone, company website, etc.)

ALTER TABLE public.profiles
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Update ensure_user_profile RPC to accept optional metadata
CREATE OR REPLACE FUNCTION public.ensure_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ensure_profile$
DECLARE
  new_ws_id uuid;
  ws_slug text;
  user_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN;
  END IF;

  user_name := coalesce(p_full_name, split_part(p_email, '@', 1));
  ws_slug := regexp_replace(lower(split_part(p_email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = ws_slug) LOOP
    ws_slug := ws_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  INSERT INTO public.workspaces (id, name, slug, is_personal, created_by)
  VALUES (gen_random_uuid(), user_name || '''s Workspace', ws_slug, true, p_user_id)
  RETURNING id INTO new_ws_id;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, active_workspace_id, metadata)
  VALUES (p_user_id, p_email, p_full_name, p_avatar_url, new_ws_id, p_metadata);

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_ws_id, p_user_id, 'owner');
END;
$ensure_profile$;
