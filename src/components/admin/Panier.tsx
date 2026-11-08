'use client';
// Panier de commande (page Vins) : sur chaque ligne, un nombre de bouteilles et « Au panier » ; en haut, le panier,
// ligne par ligne (bouteilles modifiables), commandé en une fois.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Superposition } from './Superposition';
import type { LignePanier } from '@/lib/admin/stocks';

type Retour = { ok?: string; erreur?: string } | void;
const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

function useToast() {
  const [message, setMessage] = useState<{ ok?: string; erreur?: string } | null>(null);
  const montrer = (r: Retour) => { if (r) { setMessage(r); setTimeout(() => setMessage(null), r.erreur ? 6000 : 3000); } };
  const toast = message && <span role="status" className={`toast-admin ${message.erreur ? 'erreur' : ''}`} onClick={() => setMessage(null)}>{message.erreur ?? message.ok}</span>;
  return { montrer, toast };
}

/** Sur une ligne de la page Vins : nombre de bouteilles et bouton « Au panier » (hors du formulaire des stocks). */
export function AjoutPanier({ ajouter, libelle, dansPanier, champFournisseur }: {
  ajouter: (q: number, fournisseur?: string | null) => Promise<Retour>; libelle: string; dansPanier: number;
  /** Nom de la liste « Distributeur » de la ligne (page Vins) : son choix, même pas encore enregistré, vaut pour la commande. */
  champFournisseur?: string;
}) {
  const [q, setQ] = useState('6');
  const [enCours, demarrer] = useTransition();
  const { montrer, toast } = useToast();
  const envoyer = () => {
    const liste = champFournisseur ? document.querySelector<HTMLSelectElement>(`select[name="${champFournisseur}"]`) : null;
    demarrer(async () => montrer(await ajouter(Number(q), liste ? liste.value : undefined)));
  };
  return (
    <span className="ajout-panier">
      <input type="number" min={1} max={10000} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Bouteilles à mettre au panier : ${libelle}`}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); envoyer(); } }} />
      <button type="button" className="btn sec petit bouton-panier" disabled={enCours || !(Number(q) > 0)} onClick={envoyer} title="Ajouter ces bouteilles au panier"
        aria-label={`Ajouter au panier : ${libelle}`}>{enCours ? '…' : '+ 🛒'}</button>
      {dansPanier > 0 && <span className="petit dans-panier" title="Déjà au panier">{dansPanier} au panier</span>}
      {toast}
    </span>
  );
}

/** Le panier, en haut de la page Vins : ses lignes regroupées par distributeur, puis « Commander ». */
export function Panier({ lignes, modifier, vider, commander }: {
  lignes: LignePanier[]; modifier: (vinId: string, q: number) => Promise<Retour>; vider: () => Promise<Retour>; commander: (reference: string) => Promise<Retour>;
}) {
  const [enCours, demarrer] = useTransition();
  const [reference, setReference] = useState(''); // numéro de commande interne du restaurant (facultatif)
  const { montrer, toast } = useToast();
  const total = lignes.reduce((n, l) => n + l.quantite, 0);
  const montant = lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0);
  const groupes = [...new Map(lignes.map((l) => [l.fournisseur ?? '', [] as LignePanier[]])).entries()]
    .map(([f]) => ({ fournisseur: f, quid_vinum: lignes.find((l) => (l.fournisseur ?? '') === f)!.quid_vinum, lignes: lignes.filter((l) => (l.fournisseur ?? '') === f) }));
  const nbCommandes = new Set(lignes.map((l) => (l.quid_vinum ? 'qv' : l.fournisseur ?? ''))).size;
  const agir = (f: () => Promise<Retour>) => demarrer(async () => montrer(await f()));
  // Panier vide : pas de bouton (seulement le message d'une action qui vient de le vider, s'il y en a un).
  if (!lignes.length) return <>{toast}</>;
  return (
    // Panier non vide : bouton flottant en bas à droite de l'écran (visible partout dans la liste), avec le nombre de bouteilles
    // et le montant ; il « saute » à chaque ajout. Panier vide : pas de bouton.
    <Superposition titre="Panier" bouton={`Voir le panier${total ? ` : ${total} bouteille${total > 1 ? 's' : ''}` : ' (vide)'}`}
      classeBouton={total ? 'btn rouge panier-flottant' : 'btn sec'}
      contenuBouton={total ? <span key={total} className="panier-flottant-contenu">
        <span className="panier-icone" aria-hidden="true">🛒<b className="panier-nombre">{total}</b></span>
        <span className="pile" style={{ gap: 0, alignItems: 'flex-start', lineHeight: 1.15 }}><b>Voir le panier</b>
          <small>{total} bouteille{total > 1 ? 's' : ''}{montant ? ` · ${euros(montant)} HTVA` : ''}</small></span></span> : <>🛒 Panier vide</>}>
      {!lignes.length ? <p className="discret" style={{ margin: 0 }}>Le panier est vide : indiquez un nombre de bouteilles sur la ligne d’un vin, puis « + Panier ».</p> : (
        <div className="pile" style={{ gap: 14 }}>
          {groupes.map((g) => (
            <div key={g.fournisseur} className="pile" style={{ gap: 6 }}>
              <b>{g.fournisseur || 'Sans distributeur (à préciser sur le bon)'}{g.quid_vinum && <span className="petit discret"> · via Quid Vinum</span>}</b>
              {g.lignes.map((l) => (
                <div key={l.vin_id} className="ligne-panier">
                  <span style={{ flex: 1 }}>{l.libelle}{l.millesime && !l.libelle.includes(l.millesime) ? ` ${l.millesime}` : ''}{l.format ? <span className="petit discret"> · {l.format}</span> : null}
                    {l.prix_achat != null && <span className="petit discret"> · {euros(l.prix_achat)} HTVA</span>}</span>
                  <input type="number" min={0} max={10000} defaultValue={l.quantite} key={`${l.vin_id}-${l.quantite}`} aria-label={`Bouteilles : ${l.libelle}`} disabled={enCours}
                    onBlur={(e) => { const q = Number(e.target.value); if (q !== l.quantite) agir(() => modifier(l.vin_id, q)); }} />
                  <button type="button" className="btn fantome petit" aria-label={`Retirer ${l.libelle} du panier`} disabled={enCours} onClick={() => agir(() => modifier(l.vin_id, 0))}>✕</button>
                </div>
              ))}
            </div>
          ))}
          <div className="champ" style={{ margin: 0, maxWidth: 320 }}>
            <label htmlFor="reference-interne">Votre n° de commande interne <span className="discret" style={{ fontWeight: 400 }}>(facultatif)</span></label>
            <input id="reference-interne" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder="Ex. BC-2026-114" />
          </div>
          <div className="ligne-actions" style={{ alignItems: 'center', borderTop: '1px solid var(--ligne)', paddingTop: 12 }}>
            <span style={{ flex: 1 }}><b>{total}</b> bouteille{total > 1 ? 's' : ''}{montant ? <> · <b>{euros(montant)}</b> HTVA</> : null}
              <span className="petit discret"> · {nbCommandes > 1 ? `${nbCommandes} bons de commande (un par distributeur ; un seul pour Quid Vinum)` : '1 bon de commande'}</span></span>
            <button type="button" className="btn fantome petit" disabled={enCours} onClick={() => { if (window.confirm('Vider le panier ?')) agir(vider); }}>Vider</button>
            <button type="button" className="btn rouge" disabled={enCours} onClick={() => agir(() => commander(reference))}>{enCours ? 'Commande en cours…' : 'Commander'}</button>
          </div>
        </div>
      )}
      {toast}
    </Superposition>
  );
}

/** Catalogue d'un distributeur : « + » (Ajouter à ma cave) ; le vin rejoint Ma cave, puis se commande. */
export function AjoutCatalogue({ ajouter, libelle, texte, versCave }: {
  ajouter: () => Promise<Retour & { vin?: string }>; libelle: string; texte?: string;
  /** Après l'ajout, ouvrir Ma cave sur la ligne du vin (pour le commander) : l'adresse de Ma cave. */
  versCave?: string;
}) {
  const [enCours, demarrer] = useTransition();
  const { montrer, toast } = useToast();
  const router = useRouter();
  return (
    <span>
      <button type="button" className={`btn sec petit${texte ? '' : ' bouton-plus'}`} disabled={enCours} aria-label={`Ajouter à ma cave : ${libelle}`} title="Ajouter à ma cave"
        style={texte ? { whiteSpace: 'nowrap' } : undefined} onClick={() => demarrer(async () => {
          const r = await ajouter();
          if (versCave && r && r.vin) router.push(`${versCave}?${new URLSearchParams({ nouveau: r.vin })}#vin-${r.vin}`);
          else montrer(r);
        })}>{enCours ? '…' : texte ?? '+'}</button>
      {toast}
    </span>
  );
}
