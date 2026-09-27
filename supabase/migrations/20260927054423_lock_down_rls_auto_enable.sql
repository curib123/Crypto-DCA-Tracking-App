-- Lock down Supabase's automatic RLS event-trigger helper when it exists.
-- Plain PostgreSQL CI does not include this Supabase-managed helper, so guard the revoke.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END
$$;
