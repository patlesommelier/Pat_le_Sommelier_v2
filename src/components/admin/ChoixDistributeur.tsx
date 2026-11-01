'use client';
// Ajout d'un vin, mode « Choisir un vin chez un distributeur » : le restaurant choisit un distributeur de Quid Vinum,
// parcourt son catalogue (au prix du restaurant, HTVA) et choisit un vin ; la fiche se remplit, et la commande est proposée.
import { useRef, useState } from 'react';
import type { VinTrouve } from '@/lib/admin/recherche-base';
import { OffresVin, euros, remplirFiche } from './RechercheVinBase';

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MAX = 60;

export function ChoixDistributeur({ distributeurs, charger }: {
  distributeurs: { id: string; nom: string; vins: number }[];
  charger: (distributeurId: string) => Promise<VinTrouve[]>;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  const [vins, setVins] = useState<VinTrouve[] | null>(null);
  const [filtre, setFiltre] = useState('');
  const [choisi, setChoisi] = useState<VinTrouve | null>(null);
  const [offre, setOffre] = useState('');
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  const ouvrir = async (id: string) => {
    setVins(null); setChoisi(null); setOffre(''); setFiltre(''); setErreur(false);
    if (!id) return;
    setCharge(true);
    try { setVins(await charger(id)); } catch { setErreur(true); } finally { setCharge(false); }
  };
  const choisir = (v: VinTrouve) => {
    remplirFiche(ref.current?.form ?? null, v);
    setChoisi(v);
    setOffre(v.offres?.find((o) => !o.epuise)?.id ?? '');
  };
  const mots = sansAccents(filtre).split(/\s+/).filter(Boolean);
  const visibles = (vins ?? []).filter((v) => {
    const t = sansAccents([v.libelle, v.producteur, v.appellation, v.section, v.millesime, ...(v.offres ?? []).map((o) => o.libelle)].filter(Boolean).join(' '));
    return mots.every((m) => t.includes(m));
  });

  return (
    <fieldset className="carte-bo pile" style={{ gap: 12, border: '1.5px solid var(--encre)', borderRadius: 14, padding: 16, margin: 0 }}>
      <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Choisir un vin chez un distributeur</legend>
      {!distributeurs.length ? <span className="petit">Aucun distributeur de Quid Vinum n’est proposé pour l’instant.</span> : <>
        <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="choix_distributeur">Distributeur</label>
            <select ref={ref} id="choix_distributeur" defaultValue="" onChange={(e) => ouvrir(e.target.value)}>
              <option value="">— Choisir —</option>
              {distributeurs.map((d) => <option key={d.id} value={d.id}>{d.nom} ({d.vins} vins)</option>)}
            </select></div>
          {vins && <div className="champ" style={{ margin: 0 }}><label htmlFor="filtre_catalogue">Chercher dans son catalogue</label>
            <input id="filtre_catalogue" type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Producteur, vin, appellation, millésime…"
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} /></div>}
        </div>
        <input type="hidden" name="base_cle" value={choisi?.cle.startsWith('cuvee:') ? choisi.cle : ''} />
        <input type="hidden" name="distributeur_vin" value={offre} />
        <div role="status" aria-live="polite" className="pile" style={{ gap: 6 }}>
          {charge && <span className="petit">Chargement du catalogue…</span>}
          {erreur && <span className="petit">Le catalogue n’a pas pu être chargé. Réessayez.</span>}
          {vins && !choisi && <span className="petit discret">{visibles.length} vin{visibles.length > 1 ? 's' : ''}{visibles.length > MAX ? ` : les ${MAX} premiers sont affichés, précisez la recherche` : ''}. Cliquez sur le vin à ajouter.</span>}
          {choisi && <span className="petit">Les champs ci-dessous sont remplis avec ce vin : vérifiez-les, et complétez vos prix de vente. <button type="button" className="btn fantome petit" onClick={() => { setChoisi(null); setOffre(''); }}>Choisir un autre vin</button></span>}
          {(choisi ? [choisi] : visibles.slice(0, MAX)).map((v) => {
            const o = v.offres?.[0];
            return (
              <button key={o?.id ?? v.cle} type="button" onClick={() => choisir(v)} aria-pressed={choisi === v}
                style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', font: 'inherit', display: 'flex', gap: 12, alignItems: 'center',
                  border: `1.5px solid ${choisi === v ? 'var(--encre)' : 'var(--ligne)'}`, background: 'transparent', color: 'var(--texte)', opacity: o?.epuise ? 0.6 : 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.etiquette ? <img src={v.etiquette} alt="" style={{ width: 32, height: 42, objectFit: 'contain', background: '#EFEBE9', borderRadius: 6, flexShrink: 0 }} /> : <span style={{ width: 32, flexShrink: 0 }} />}
                <span style={{ flex: 1 }}><b>{o?.libelle ?? v.libelle}</b>{o?.millesime ? ` ${o.millesime}` : ''}
                  <span style={{ display: 'block', fontSize: 13 }}>{[v.producteur, o?.contenance, o?.epuise ? 'épuisé' : null].filter(Boolean).join(' · ')}</span></span>
                <b style={{ whiteSpace: 'nowrap' }}>{euros(o?.prix ?? null)} HTVA</b>
              </button>
            );
          })}
          {choisi?.offres?.length ? <OffresVin offres={choisi.offres} valeur={offre} changer={setOffre} /> : null}
        </div>
      </>}
    </fieldset>
  );
}
