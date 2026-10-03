import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const supabaseConfigure = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Client Supabase lié à la session du navigateur (cookies) : connexion, déconnexion, utilisateur courant. */
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (aPoser) => {
        try {
          aPoser.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Appel depuis un composant serveur : le middleware se charge de rafraîchir les cookies.
        }
      },
    },
  });
}

/** Client « service » (clé secrète) : création de comptes et dépôt de fichiers. Jamais exposé au navigateur. */
export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante (voir .env.example)');
  return createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}
