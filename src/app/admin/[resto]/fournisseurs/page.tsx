// Base des vins — Distributeurs : « Mes distributeurs » (ceux du restaurant, coordonnées reprises sur les bons de commande)
// et « Distributeurs Quid Vinum » (catalogue et prix de Quid Vinum, commandes envoyées à Quid Vinum). On peut en ajouter dans les deux.
import Link from 'next/link';
import { ajouterDistributeurQv, ajouterFournisseur, modifierFournisseur, supprimerFournisseur } from '../../stocks-actions';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { EtatDistributeur } from '@/components/admin/EtatDistributeur';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
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
  const [fournisseurs, proposes] = await Promise.all([getFournisseurs(resto), distributeursProposes(resto)]);
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.logo_url ? <img src={d.logo_url} alt="" className="logo-distributeur" style={{ height: 64, maxWidth: 180 }} /> : null}
              <span className="pile" style={{ flex: '1 1 260px', gap: 4 }}>
                <b style={{ fontSize: 17 }}>{d.nom}</b>
                {(d.presentation || site) && <span className="petit">{d.presentation}{site && <>{d.presentation ? ' ' : ''}<a href={site} target="_blank" rel="noopener">Voir le site →</a></>}</span>}
              </span>
              {/* Une commande Quid Vinum regroupe tous les distributeurs Quid Vinum actifs. */}
              {f && <Link href={`/admin/${resto}/commandes?f=qv`} className="btn sec petit bouton-commande">Nouvelle commande</Link>}
              {/* À droite, près de la sélection : ses vins sur votre carte (actif), ou la taille de son catalogue. */}
              <span className="discret petit" style={{ whiteSpace: 'nowrap' }}>{f ? `${f.vins} vin${f.vins > 1 ? 's' : ''} sur votre carte` : `${d.vins} vins au catalogue`}</span>
              <EtatDistributeur actif={Boolean(f)} nom={d.nom} activer={ajouterDistributeurQv.bind(null, resto, d.id)} retirer={supprimerFournisseur.bind(null, resto, f?.id ?? '')} />
            </div>
          );
        })}
        {!proposes.length && <p className="discret" style={{ margin: 0 }}>Aucun distributeur Quid Vinum pour le moment.</p>}
      </section>
    </>
  );
}
