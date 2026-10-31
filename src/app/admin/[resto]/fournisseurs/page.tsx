// Gestion des stocks — Fournisseurs : coordonnées des fournisseurs de vin (repris sur les bons de commande).
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
  return (
    <>
      <Entete titre="Fournisseurs" texte="Les coordonnées de vos fournisseurs de vin : elles figurent sur vos bons de commande, envoyés à leur adresse e-mail. Choisissez le fournisseur de chaque vin dans Stocks ou dans la fiche du vin." />
      <section className="pile">
        {fournisseurs.map((f) => f.distributeur_id ? (
          // Distributeur de la base de Quid Vinum : catalogue et prix tenus par Quid Vinum, commandes envoyées à Quid Vinum.
          <div key={f.id} className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span><b style={{ fontSize: 17 }}>{f.nom}</b> <Etat type="ok">Quid Vinum</Etat> <span className="discret">· {f.vins} vin{f.vins > 1 ? 's' : ''} de votre carte</span><br />
              <span className="discret petit">Catalogue et prix proposés par Quid Vinum ; vos commandes partent chez Quid Vinum.</span></span>
            <span className="ligne-actions">
              <Link href={`/admin/${resto}/commandes?f=${f.id}#nouvelle`} className="btn sec petit">Commander</Link>
              <BoutonSupprimer action={supprimerFournisseur.bind(null, resto, f.id)} libelle="Retirer" className="btn fantome petit"
                question={`Retirer « ${f.nom} » de vos fournisseurs ? Ses vins n’auront plus de fournisseur ; les commandes passées restent.`} />
            </span>
          </div>
        ) : (
          <details key={f.id} className="carte-bo deroulant-simple">
            <summary><span><b style={{ fontSize: 17 }}>{f.nom}</b> <span className="discret">· {f.vins} vin{f.vins > 1 ? 's' : ''}</span></span>
              <span className="discret petit">{[f.contact, f.email, f.telephone].filter(Boolean).join(' · ') || 'Coordonnées à compléter'}</span></summary>
            <FormulaireAdmin action={modifierFournisseur.bind(null, resto, f.id)} className="pile" style={{ gap: 14, marginTop: 14 }}>
              <Champs f={f} />
              <div className="ligne-actions">
                <button className="btn">Enregistrer</button>
                <BoutonSupprimer action={supprimerFournisseur.bind(null, resto, f.id)} libelle="Supprimer ce fournisseur"
                  question={`Supprimer « ${f.nom} » ? Ses vins n’auront plus de fournisseur ; les commandes passées restent.`} />
              </div>
            </FormulaireAdmin>
          </details>
        ))}
        {!fournisseurs.length && <p className="discret" style={{ margin: 0 }}>Aucun fournisseur pour le moment.</p>}
      </section>
      {aAjouter.length > 0 && (
        <section className="carte-bo pile" id="quid-vinum">
          <div><h2>Distributeurs Quid Vinum</h2><p className="sous">Ajoutez un distributeur de la sélection Quid Vinum : vous commandez dans son catalogue, au prix proposé par Quid Vinum, sans rien saisir.</p></div>
          {aAjouter.map((d) => (
            <FormulaireAdmin key={d.id} action={ajouterDistributeurQv.bind(null, resto, d.id)} className="ligne-distributeur">
              <span><b>{d.nom}</b> <span className="discret">· {d.vins} vin{d.vins > 1 ? 's' : ''}</span>{d.site && <> · <a href={/^https?:/.test(d.site) ? d.site : `https://${d.site}`} target="_blank" rel="noopener" className="petit">site</a></>}</span>
              <button className="btn sec petit">+ Ajouter à mes fournisseurs</button>
            </FormulaireAdmin>
          ))}
        </section>
      )}
      <section className="carte-bo pile" id="ajouter">
        <h2>Ajouter un autre fournisseur</h2>
        <FormulaireAdmin key={fournisseurs.length} action={ajouterFournisseur.bind(null, resto)} className="pile" style={{ gap: 14 }}>
          <Champs />
          <span><button className="btn">+ Ajouter le fournisseur</button></span>
        </FormulaireAdmin>
      </section>
    </>
  );
}
