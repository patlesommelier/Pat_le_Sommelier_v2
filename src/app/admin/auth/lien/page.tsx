'use client';
// Lien d'invitation ou de mot de passe oublié dont les jetons sont dans le fragment de l'adresse (#access_token=…&refresh_token=…) :
// le navigateur ouvre la session (cookies, lus ensuite par le serveur) puis va à la suite (choisir son mot de passe).
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function Lien() {
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const suiteBrute = new URLSearchParams(window.location.search).get('suite') ?? '/admin';
    const suite = suiteBrute.startsWith('/admin') ? suiteBrute : '/admin';
    if (h.get('error_description')) { setErreur(h.get('error_description')!.replace(/\+/g, ' ')); return; }
    const access = h.get('access_token'), refresh = h.get('refresh_token');
    if (!access || !refresh) { window.location.replace('/admin/connexion'); return; }
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    sb.auth.setSession({ access_token: access, refresh_token: refresh }).then(({ error }) => {
      if (error) setErreur(error.message); else window.location.replace(suite);
    });
  }, []);
  return (
    <div className="bo bo-connexion">
      <div className="carte-bo sticker pile">
        {erreur ? <>
          <h1 style={{ fontSize: 24 }}>Ce lien ne fonctionne plus</h1>
          <p className="sous">Il a peut-être expiré ou déjà servi ({erreur}). Demandez un nouveau lien avec « Mot de passe oublié ».</p>
          <a href="/admin/connexion?oubli=1" className="btn">Recevoir un nouveau lien</a>
        </> : <p className="sous">Connexion en cours…</p>}
      </div>
    </div>
  );
}
