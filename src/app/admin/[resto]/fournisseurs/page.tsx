// Base des vins — Distributeurs : « Mes distributeurs » (ceux du restaurant, coordonnées reprises sur les bons de commande)
// et « Distributeurs Quid Vinum » (catalogue et prix de Quid Vinum, commandes envoyées à Quid Vinum). On peut en ajouter dans les deux.
import Link from 'next/link';
import { ajouterDistributeurQv, ajouterFournisseur, nouvelleCommandeQv, modifierFournisseur, supprimerFournisseur } from '../../stocks-actions';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { EtatDistributeur } from '@/components/admin/EtatDistributeur';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { getFournisseurs, type Fournisseur } from '@/lib/admin/stocks';
import { distributeursProposes } from '@/lib/distributeurs/donnees';

function Champs({ f }: { f?: Fournisseur }) {
  const champ = (nom: keyof Fournisseur, libelle: string, o: { type?: string; requis?: boolean; large?: boolean } = {}) => (
    <label className="champ" style={o.large ? { gridColumn: '1 / -1' } : undefined}><span>{libelle}{o.requis ? ' *' : ''}</span>
      {nom === 'adresse'
        ? <textarea name={nom} rows={2} defaultValue={f?.adresse ?? ''} />
        : <input name={nom} type={o.type ?? 'text'} defaultValue={(f?.[nom] as string | null) ?? ''} required={o.requis} maxLength={200} />}
    </label>
  );
  return (
    <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12 }}>
      {champ('nom', 'Nom', { requis: true })}{champ('contact', 'Contact')}
      {champ('adresse', 'Adresse', { large: true })}
      {champ('tva', 'Numéro de TVA')}{champ('telephone', 'Téléphone', { type: 'tel' })}{champ('email', 'Adresse e-mail (pour les commandes)', { type: 'email' })}
    </div>
  );
}

export default async function Fournisseurs({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const [fournisseurs, proposes, surCarte] = await Promise.all([getFournisseurs(resto), distributeursProposes(resto),
    // Vins de la carte de chaque distributeur Quid Vinum (un vin, toutes contenances) : rattachés à lui, pris dans son catalogue,
    // ou, sans autre distributeur, un vin de la base de Pat qu'il vend.
    requete<{ distributeur_id: string; n: number }>(
      `select x.distributeur_id, count(distinct x.cle)::int as n from (
         select coalesce(f.distributeur_id, dv.distributeur_id) as distributeur_id, lower(v.libelle) || coalesce(v.millesime, '') as cle
           from vin_carte v left join fournisseur f on f.id = v.fournisseur_id left join distributeur_vin dv on dv.id = v.distributeur_vin_id
          where v.restaurant_id = $1 and v.disponible and coalesce(f.distributeur_id, dv.distributeur_id) is not null
         union
         select c.distributeur_id, lower(v.libelle) || coalesce(v.millesime, '')
           from vin_carte v join distributeur_vin c on c.cuvee_id = v.cuvee_id and c.actif
          where v.restaurant_id = $1 and v.disponible and v.fournisseur_id is null and v.distributeur_vin_id is null) x group by 1`, [resto])]);
  const vinsSurCarte = new Map(surCarte.map((x) => [x.distributeur_id, x.n]));
  const propres = fournisseurs.filter((f) => !f.distributeur_id), quidVinum = fournisseurs.filter((f) => f.distributeur_id);
  return (
    <>
      <Entete titre="Distributeurs" texte="Les distributeurs et fournisseurs chez qui vous achetez votre vin : leurs coordonnées figurent sur vos bons de commande, envoyés à leur adresse e-mail. Choisissez le distributeur de chaque vin dans Vins ou dans la fiche du vin." />
      <section className="pile" id="mes-distributeurs">
        <div><h2 style={{ margin: 0 }}>Mes distributeurs</h2><p className="sous" style={{ margin: '4px 0 0' }}>Vos propres distributeurs et fournisseurs : vos bons de commande leur sont envoyés directement.</p></div>
        {propres.map((f) => (
          <details key={f.id} className="carte-bo deroulant-simple">
            <summary><span><b style={{ fontSize: 17 }}>{f.nom}</b> <span className="discret">· {f.vins} vin{f.vins > 1 ? 's' : ''}</span></span>
              <span className="discret petit" style={{ flex: 1 }}>{[f.contact, f.email, f.telephone].filter(Boolean).join(' · ') || 'Coordonnées à compléter'}</span>
              <Link href={`/admin/${resto}/commandes?f=${f.id}`} className="btn sec petit bouton-commande">Nouvelle commande</Link></summary>
            <FormulaireAdmin action={modifierFournisseur.bind(null, resto, f.id)} className="pile" style={{ gap: 14, marginTop: 14 }}>
              <Champs f={f} />
              <div className="ligne-actions">
                <button className="btn">Enregistrer</button>
                <BoutonSupprimer action={supprimerFournisseur.bind(null, resto, f.id)} libelle="Supprimer ce distributeur"
                  question={`Supprimer « ${f.nom} » ? Ses vins n’auront plus de distributeur ; les commandes passées restent.`} />
              </div>
            </FormulaireAdmin>
          </details>
        ))}
        {!propres.length && <p className="discret" style={{ margin: 0 }}>Aucun distributeur à vous pour le moment.</p>}
        <details className="carte-bo" id="ajouter">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Ajouter un distributeur</summary>
          <FormulaireAdmin key={fournisseurs.length} action={ajouterFournisseur.bind(null, resto)} className="pile" style={{ gap: 14, marginTop: 14 }}>
            <Champs />
            <span><button className="btn">Ajouter ce distributeur</button></span>
          </FormulaireAdmin>
        </details>
      </section>

      <section className="pile" id="quid-vinum">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 420px' }}><h2 style={{ margin: 0 }}>Distributeurs Quid Vinum</h2><p className="sous" style={{ margin: '4px 0 0' }}>La sélection de Quid Vinum : vous commandez dans leurs catalogues, au prix proposé par Quid Vinum, sans rien saisir. Une seule commande pour tous : Quid Vinum la transmet à chaque distributeur.</p></div>
        </div>
        {/* Tous les distributeurs Quid Vinum, les actifs en premier ; à droite, « Actif » ou « Non sélectionné ». */}
        {[...proposes].sort((x, y) => Number(y.deja) - Number(x.deja) || x.nom.localeCompare(y.nom)).map((d) => {
          const f = quidVinum.find((x) => x.distributeur_id === d.id) ?? null;
          const site = d.site ? (/^https?:/.test(d.site) ? d.site : `https://${d.site}`) : null;
          return (
            <div key={d.id} className={`carte-bo ligne-qv${f ? '' : ' inactif'}`}>
              {/* Case de logo de même taille pour tous (logo ou non) : les noms commencent tous au même endroit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="case-logo case-logo-qv">{d.logo_url && <img src={d.logo_url} alt="" />}</span>
              <span className="pile" style={{ flex: '1 1 260px', gap: 4 }}>
                <b style={{ fontSize: 17 }}>{d.nom}</b>
                {(d.presentation || site) && <span className="petit">{d.presentation}{site && <>{d.presentation ? ' ' : ''}<a href={site} target="_blank" rel="noopener">Voir le site →</a></>}</span>}
              </span>
              {/* Une commande Quid Vinum regroupe tous les distributeurs Quid Vinum actifs. */}
              {/* Sur chaque distributeur Quid Vinum ; s'il n'est pas sélectionné, il le devient. Une commande Quid Vinum regroupe tous les actifs. */}
              <form action={nouvelleCommandeQv.bind(null, resto, d.id)}><button className="btn sec petit bouton-commande">Nouvelle commande</button></form>
              {/* À droite, près de la sélection : ses vins sur votre carte (actif), ou la taille de son catalogue. */}
              <span className="discret petit" style={{ whiteSpace: 'nowrap' }}>{f ? (() => { const n = vinsSurCarte.get(d.id) ?? 0; return `${n} vin${n > 1 ? 's' : ''} sur votre carte`; })() : `${d.vins} vins au catalogue`}</span>
              <EtatDistributeur actif={Boolean(f)} nom={d.nom} activer={ajouterDistributeurQv.bind(null, resto, d.id)} retirer={supprimerFournisseur.bind(null, resto, f?.id ?? '')} />
            </div>
          );
        })}
        {!proposes.length && <p className="discret" style={{ margin: 0 }}>Aucun distributeur Quid Vinum pour le moment.</p>}
      </section>
    </>
  );
}
