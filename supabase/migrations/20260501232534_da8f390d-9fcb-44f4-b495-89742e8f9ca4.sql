REVOKE EXECUTE ON FUNCTION public.get_user_display_name(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_display_name(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;