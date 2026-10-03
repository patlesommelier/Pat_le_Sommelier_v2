import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Rafraîchit la session Supabase du back-office à chaque requête /admin. */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return res;
  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (aPoser) => {
        aPoser.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        aPoser.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = { matcher: ['/admin/:path*'] };
