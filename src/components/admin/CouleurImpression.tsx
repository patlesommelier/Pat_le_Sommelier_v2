'use client';
// « Couleur des impressions » (Apparence) : la couleur des titres et des filets de la carte des vins, du menu et du pense-bête
// imprimés. Automatique (vide), celle de l'app, celle du logo, ou une couleur choisie.
import { useEffect, useRef, useState } from 'react';

/** Événement envoyé quand la couleur est enregistrée : les aperçus de la carte (Centre d'impression) se rechargent. */
export const COULEUR_ENREGISTREE = 'couleur-impression-enregistree';

export function CouleurImpression({ initiale, app, logo, auto, enregistrer }: {
  initiale: string | null; app: string; logo: string | null; auto: string;
  /** Enregistrement immédiat à chaque changement (sinon avec le bouton « Enregistrer » du formulaire). */
  enregistrer?: (valeur: string) => Promise<{ ok: boolean }>;
}) {
  const depart = !initiale ? 'auto' : initiale === app ? 'app' : initiale === logo ? 'logo' : 'autre';
  const [choix, setChoix] = useState<'auto' | 'app' | 'logo' | 'autre'>(depart);
  const [autre, setAutre] = useState(initiale && depart === 'autre' ? initiale : logo ?? app);
  const valeur = choix === 'auto' ? '' : choix === 'app' ? app : choix === 'logo' ? logo ?? '' : autre.toUpperCase();
  const affichee = valeur || auto;
  // Enregistrée dès qu'elle change (un court délai : le nuancier envoie une couleur à chaque mouvement).
  const [etat, setEtat] = useState<'' | 'enCours' | 'ok' | 'erreur'>('');
  const derniere = useRef(valeur);
  useEffect(() => {
    if (!enregistrer || valeur === derniere.current) return;
    if (choix === 'autre' && !/^#[0-9A-F]{6}$/.test(valeur)) return; // code en cours de frappe
    const t = setTimeout(async () => {
      setEtat('enCours');
      const r = await enregistrer(valeur).catch(() => ({ ok: false }));
      if (r.ok) { derniere.current = valeur; setEtat('ok'); window.dispatchEvent(new CustomEvent(COULEUR_ENREGISTREE, { detail: valeur })); }
      else setEtat('erreur');
    }, 450);
    return () => clearTimeout(t);
  }, [valeur, choix, enregistrer]);
  const pastille = (c: string) => <span aria-hidden="true" style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 5, background: c, border: '1px solid var(--ligne)', verticalAlign: -4, marginRight: 6 }} />;
  const option = (v: typeof choix, titre: React.ReactNode, aide: string) => (
    <label className="case"><input type="radio" name="couleur_impression_choix" defaultChecked={choix === v} onChange={() => setChoix(v)} />
      <span><b>{titre}</b><small>{aide}</small></span></label>
  );
  return (
    <section className="carte-bo pile">
      <div><h2>Couleur des impressions{etat && <span className="petit" role="status" style={{ marginLeft: 10, fontWeight: 500, color: etat === 'erreur' ? 'var(--rouge)' : 'var(--discret)' }}>
        {etat === 'enCours' ? 'Enregistrement…' : etat === 'ok' ? '✓ Enregistrée' : 'Non enregistrée, réessayez'}</span>}</h2><p className="sous">La couleur des titres et des filets de votre carte des vins, de votre menu et du pense-bête imprimés, sur le papier blanc.</p></div>
      <input type="hidden" name="couleur_impression_envoyee" value="1" />
      <input type="hidden" name="couleur_impression" value={valeur} />
      {option('auto', <>{pastille(auto)}Automatique</>, 'La couleur de l’app si elle se lit sur le blanc, sinon celle de votre logo.')}
      {option('app', <>{pastille(app)}La couleur de l’app</>, app)}
      {logo && option('logo', <>{pastille(logo)}La couleur de votre logo</>, `${logo}, trouvée dans votre logo`)}
      {option('autre', <>{pastille(autre)}Une autre couleur</>, 'Par exemple le bleu exact de votre logo.')}
      {choix === 'autre' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="color" value={autre.toLowerCase()} onChange={(e) => setAutre(e.target.value.toUpperCase())} aria-label="Choisir la couleur des impressions" style={{ width: 56, height: 40, padding: 0, border: 0, background: 'none' }} />
          <input value={autre} onChange={(e) => setAutre(e.target.value)} maxLength={7} aria-label="Code de la couleur" style={{ width: 110 }} />
        </div>
      )}
      <p style={{ margin: 0, fontSize: 18 }}><span style={{ color: affichee, fontFamily: '\'Cormorant Garamond\', Garamond, serif', fontWeight: 600, fontSize: 26 }}>Carte des vins</span>
        <span style={{ display: 'block', width: 50, height: 2, background: affichee, margin: '4px 0' }} />
        <span style={{ color: affichee, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Bourgogne</span></p>
    </section>
  );
}
