// Base des vins — Distributeurs : « Mes distributeurs » (ceux du restaurant, coordonnées reprises sur les bons de commande)
// et « Distributeurs Quid Vinum » (catalogue et prix de Quid Vinum, commandes envoyées à Quid Vinum). On peut en ajouter dans les deux.
import Link from 'next/link';
import { ajouterDistributeurQv, ajouterFournisseur, modifierFournisseur, supprimerFournisseur } from '../../stocks-actions';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat } from '@/components/admin/Ui';
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
  const aAjouter = proposes.filter((d) => !d.deja);
  const propres = fournisseurs.filter((f) => !f.distributeur_id), quidVinum = fournisseurs.filter((f) => f.distributeur_id);
  return (
    <>
      <Entete titre="Distributeurs" texte="Les distributeurs et fournisseurs chez qui vous achetez votre vin : leurs coordonnées figurent sur vos bons de commande, envoyés à leur adresse e-mail. Choisissez le distributeur de chaque vin dans Vins ou dans la fiche du vin." />
      <section className="pile" id="mes-distributeurs">
        <div><h2 style={{ margin: 0 }}>Mes distributeurs</h2><p className="sous" style={{ margin: '4px 0 0' }}>Vos propres distributeurs et fournisseurs : vos bons de commande leur sont envoyés directement.</p></div>
        {propres.map((f) => (
          <details key={f.id} className="carte-bo deroulant-simple">
            <summary><span><b style={{ fontSize: 17 }}>{f.nom}</b> <span className="discret">· {f.vins} vin{f.vins > 1 ? 's' : ''}</span></span>
              <span className="discret petit">{[f.contact, f.email, f.telephone].filter(Boolean).join(' · ') || 'Coordonnées à compléter'}</span></summary>
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
        <div><h2 style={{ margin: 0 }}>Distributeurs Quid Vinum</h2><p className="sous" style={{ margin: '4px 0 0' }}>La sélection de Quid Vinum : vous commandez dans leur catalogue, au prix proposé par Quid Vinum, sans rien saisir ; vos commandes partent chez Quid Vinum.</p></div>
        {quidVinum.map((f) => (
          <div key={f.id} className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{/* eslint-disable-next-line @next/next/no-img-element */}
              {f.logo_url && <img src={f.logo_url} alt="" className="logo-distributeur" style={{ verticalAlign: 'middle', marginRight: 10 }} />}
              <b style={{ fontSize: 17 }}>{f.nom}</b> <Etat type="ok">Activé</Etat> <span className="discret">· {f.vins} vin{f.vins > 1 ? 's' : ''} de votre carte</span></span>
            <span className="ligne-actions">
              <Link href={`/admin/${resto}/commandes?f=${f.id}#nouvelle`} className="btn sec petit">Commander</Link>
              <BoutonSupprimer action={supprimerFournisseur.bind(null, resto, f.id)} libelle="Retirer" className="btn fantome petit"
                question={`Retirer « ${f.nom} » de vos distributeurs ? Ses vins n’auront plus de distributeur ; les commandes passées restent.`} />
            </span>
          </div>
        ))}
        {aAjouter.length > 0 && (
          <div className="carte-bo pile">
            <b>{quidVinum.length ? 'Ajouter un autre distributeur Quid Vinum' : 'Ajouter un distributeur Quid Vinum'}</b>
            {aAjouter.map((d) => (
              <FormulaireAdmin key={d.id} action={ajouterDistributeurQv.bind(null, resto, d.id)} className="ligne-distributeur">
                <span>{/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.logo_url && <img src={d.logo_url} alt="" className="logo-distributeur" style={{ verticalAlign: 'middle', marginRight: 10 }} />}
                  <b>{d.nom}</b> <span className="discret">· {d.vins} vin{d.vins > 1 ? 's' : ''}</span>{d.site && <> · <a href={/^https?:/.test(d.site) ? d.site : `https://${d.site}`} target="_blank" rel="noopener" className="petit">site</a></>}</span>
                <button className="btn sec petit">+ Ajouter</button>
              </FormulaireAdmin>
            ))}
          </div>
        )}
        {!quidVinum.length && !aAjouter.length && <p className="discret" style={{ margin: 0 }}>Aucun distributeur Quid Vinum pour le moment.</p>}
      </section>
    </>
  );
}
