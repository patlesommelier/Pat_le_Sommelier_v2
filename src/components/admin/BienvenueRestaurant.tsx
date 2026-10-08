'use client';
// Bloc d'accueil du tableau de bord après l'inscription : préparation des accords et QR code à télécharger.
// Affiché en haut du tableau de bord avec ?bienvenue=1, ou tant que le restaurant inscrit n'est pas en service.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PatAttente } from '@/components/PatAttente';
import { AstucesPat } from '@/components/AstucesPat';

type Etat = { restaurant?: string; preparation: { statut: string; total: number; faits: number } };

export function BienvenueRestaurant({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ preparation: { statut: 'en_cours', total: 0, faits: 0 } });
  const fini = etat.restaurant === 'en_service';
  useEffect(() => {
    if (fini) { router.refresh(); return; } // étapes de la mise en place à jour
    let actif = true;
    const lire = async () => {
      const r = await fetch(`/api/restaurants/${restaurantId}/preparation`, { cache: 'no-store' });
      if (r.ok && actif) setEtat(await r.json());
    };
    lire();
    const t = setInterval(lire, 5000);
    return () => { actif = false; clearInterval(t); };
  }, [restaurantId, fini, router]);
  const { total, faits, statut } = etat.preparation;
  const pct = fini ? 100 : total ? Math.round((faits / total) * 100) : 0;

  return (
    <div className="pile" style={{ gap: 24 }}>
      <header className="pile" style={{ gap: 8, maxWidth: 760 }}>
        <span className="etat ok" style={{ alignSelf: 'flex-start' }}>Compte créé</span>
        <h1 style={{ fontSize: 'clamp(30px, 3.2vw, 40px)', fontWeight: 800, letterSpacing: -0.8 }}>Bienvenue</h1>
        <p className="discret" style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
          Votre sommelier est en route. Votre QR code est déjà prêt : posez-le sur vos tables, il fonctionnera dès que Pat aura fini de préparer vos accords.
        </p>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <section aria-labelledby="h-prep" role="status" aria-live="polite" className="carte-bo sticker"
          style={{ flex: '999 1 460px', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          {fini
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/pat/pat.png" alt="" width={120} height={132} />
            : <PatAttente taille={120} />}
          <div className="pile" style={{ flex: '1 1 300px', gap: 12 }}>
            <span className="surtitre">{fini ? 'Terminé' : 'En cours'}</span>
            {fini ? <h2 id="h-prep" style={{ fontSize: 'clamp(24px, 2.4vw, 30px)', fontWeight: 800 }}>Vos accords sont prêts</h2>
              : <h2 id="h-prep" style={{ fontSize: 'clamp(17px, 1.6vw, 20px)', fontWeight: 700, lineHeight: 1.4 }}><AstucesPat /></h2>}
            <div role="progressbar" aria-label="Préparation des accords" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
              style={{ height: 10, borderRadius: 5, background: 'var(--rose)', overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: 'var(--encre)', transition: 'width .4s' }} />
            </div>
            <span className="discret" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
              {fini ? 'Le QR code fonctionne : vos clients peuvent déjà demander conseil à Pat.'
                : statut === 'bloque' ? `${faits} plats sur ${total} · quelques plats demandent une vérification de Pat ; votre app s’ouvrira à vos clients dès qu’ils auront tous leurs accords.`
                : `${total ? `${faits} plats sur ${total}` : 'Démarrage…'} · quelques minutes. Vous pouvez fermer cette page : la préparation continue.`}
            </span>
          </div>
        </section>
        <section aria-labelledby="h-qr" className="carte-bo" style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/admin/${restaurantId}/acces/qr?affichage=1`} alt="Votre QR code" width={140} height={140}
            style={{ padding: 8, borderRadius: 12, border: '1px solid var(--ligne)' }} />
          <div className="pile" style={{ gap: 10 }}>
            <h2 id="h-qr" style={{ fontSize: 21, fontWeight: 700 }}>Votre QR code</h2>
            <span className="discret" style={{ fontSize: 14.5 }}>À poser sur vos tables.</span>
            <a href={`/admin/${restaurantId}/acces/qr?format=png`} download className="btn sec petit" style={{ alignSelf: 'flex-start' }}>Télécharger (PNG)</a>
          </div>
        </section>
      </div>
    </div>
  );
}
