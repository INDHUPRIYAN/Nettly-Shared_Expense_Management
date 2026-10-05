/** Validated public environment configuration. Only public (VITE_) values belong here. */
function readEnv() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin

  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean)

  return {
    supabaseUrl: supabaseUrl ?? '',
    supabaseAnonKey: supabaseAnonKey ?? '',
    appUrl: appUrl.replace(/\/+$/, ''),
    missing: missing as string[],
  }
}

export const env = readEnv()
