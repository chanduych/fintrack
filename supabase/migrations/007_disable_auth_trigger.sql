-- Disable the problematic auth trigger
-- We'll handle user initialization from the client side instead

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Keep the function for reference but it won't be called automatically
COMMENT ON FUNCTION public.handle_new_user IS 'User initialization function - disabled trigger, handled client-side';
