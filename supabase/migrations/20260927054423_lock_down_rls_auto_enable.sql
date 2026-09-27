-- Lock down Supabase's automatic RLS event-trigger helper so it cannot be invoked through exposed API roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
