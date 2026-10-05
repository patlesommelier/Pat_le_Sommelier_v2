'use client';
import { useEffect, useState } from 'react';

/** Lit la session placée par Supabase dans le fragment de l'adresse et la confie au serveur, qui crée le restaurant. */
export function Aiguillage({ inscription, repli = '/admin/connexion' }: { inscription: string | null; repli?: string }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const access_token = h.get('access_token'), refresh_token = h.get('refresh_token');
    if (h.get('error')) {
      setMessage('Ce lien a expiré ou a déjà servi. Connectez-vous, ou recommencez l’inscription pour recevoir un nouveau lien.');
      return;
    }
    if (!access_token && !inscription) { window.location.replace(repli); return; }
    setMessage('Confirmation de votre adresse…');
    fetch('/auth/confirmation/session', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ access_token, refresh_token, inscription }),
    })
      .then((r) => r.json())
      .then((r: { vers?: string }) => window.location.replace(r.vers ?? repli))
      .catch(() => window.location.replace(repli));
  }, [inscription, repli]);
  return <p role="status" style={{ fontSize: 17, textAlign: 'center', maxWidth: 420 }}>{message}</p>;
}
