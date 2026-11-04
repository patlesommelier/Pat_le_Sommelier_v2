// Paramètres du restaurant (tout en bas du menu) : coordonnées du restaurant (livraison, facturation, reprises sur les bons de commande),
// limite de stock bas, et les utilisateurs de l'espace (invitation, liste).
import { creerAcces, retirerAcces } from '../../actions';
import { enregistrerParametresStock } from '../../stocks-actions';
import { CopierLien } from '@/components/admin/CopierLien';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Message } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getAcces } from '@/lib/admin/donnees';
import { getCoordonnees } from '@/lib/admin/stocks';
import { envoiEmailConfigure } from '@/lib/email';

export default async function Parametres({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const [sp, c, acces] = await Promise.all([searchParams, getCoordonnees(resto), getAcces(resto)]);
  if (!c) return null;
  const champ = (nom: string, libelle: string, valeur: string | null, o: { type?: string; aide?: string } = {}) => (
    <label className="champ"><span>{libelle}</span><input name={nom} type={o.type ?? 'text'} defaultValue={valeur ?? ''} maxLength={200} />{o.aide && <span className="aide">{o.aide}</span>}</label>
  );
  return (
    <>
      <Entete titre="Paramètres du restaurant" texte="Les coordonnées de votre restaurant (reprises sur les bons de commande), l’alerte de stock bas et les utilisateurs de votre espace." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      <FormulaireAdmin action={enregistrerParametresStock.bind(null, resto)} className="pile" style={{ gap: 20, maxWidth: 820 }}>
        <section className="carte-bo pile" style={{ gap: 12 }}>
          <h2>Coordonnées du restaurant</h2>
          <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
            {/* Nom affiché partout (espace, app des clients, carte) ; la raison sociale ne sert qu'aux bons de commande. */}
            <label className="champ"><span>Nom du restaurant</span><input name="nom" defaultValue={c.nom} maxLength={120} required autoComplete="off" />
              <span className="aide">Affiché dans votre espace et dans l’app de vos clients</span></label>
            {champ('commande_societe', 'Raison sociale (bons de commande)', c.commande_societe, { aide: `Vide : « ${c.nom} »` })}
            {champ('commande_tva', 'Numéro de TVA', c.commande_tva)}
            <label className="champ" style={{ gridColumn: '1 / -1' }}><span>Adresse de livraison</span><textarea name="commande_adresse" rows={2} defaultValue={c.commande_adresse ?? ''} /></label>
            {/* Adresse de facturation : seulement si elle diffère (la case l'affiche). */}
            <div className="facturation" style={{ gridColumn: '1 / -1' }}>
              <label className="case" style={{ margin: 0 }}><input type="checkbox" name="facturation_differente" defaultChecked={Boolean(c.commande_adresse_facturation)} />
                <span>Adresse de facturation différente de l’adresse de livraison</span></label>
              <label className="champ adresse-facturation" style={{ marginTop: 10 }}><span>Adresse de facturation</span>
                <textarea name="commande_adresse_facturation" rows={2} defaultValue={c.commande_adresse_facturation ?? ''} /></label>
            </div>
            {champ('commande_contact', 'Contact', c.commande_contact)}
            {champ('commande_telephone', 'Téléphone', c.commande_telephone, { type: 'tel' })}
            {champ('commande_email', 'Adresse e-mail', c.commande_email, { type: 'email', aide: 'Le fournisseur y répond ; vous recevez une copie de chaque bon envoyé.' })}
          </div>
          <span className="petit discret">{envoiEmailConfigure()
            ? '« Envoyer la commande » envoie le bon de commande par e-mail, en pièce jointe (PDF), directement depuis la page Commandes.'
            : '« Envoyer la commande » ouvre votre messagerie avec la commande rédigée et télécharge le bon de commande (PDF), à joindre à l’e-mail.'}</span>
        </section>
        <section className="carte-bo pile" style={{ gap: 12 }}>
          <h2>Limite de stock bas</h2>
          <label className="champ" style={{ maxWidth: 320 }}><span>Alerte à partir de</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input name="stock_limite_basse" type="number" min={0} max={1000} defaultValue={c.stock_limite_basse} required style={{ width: 100 }} /> bouteilles ou moins</span>
            <span className="aide">Un point d’exclamation rouge apparaît alors dans Ma cave et sur la carte des vins (jamais à l’impression).</span>
          </label>
        </section>
        <span><button className="btn">Enregistrer</button></span>
      </FormulaireAdmin>

      {/* Utilisateurs de l'espace du restaurant : invitation et liste. */}
      <section className="carte-bo pile" id="utilisateurs" style={{ maxWidth: 820 }}>
        <h2>Utilisateurs</h2>
        {sp.lien && <CopierLien url={sp.lien} titre="Lien pour choisir son mot de passe" />}
        {!acces.length && <span className="discret">Aucun utilisateur pour l’instant.</span>}
        {acces.map((a) => (
          <div key={a.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid var(--ligne)', paddingTop: 10 }}>
            <span><b>{a.email}</b><br /><span className="discret">depuis le {a.cree_le}</span></span>
            <form action={retirerAcces.bind(null, resto, a.user_id)}><button className="btn fantome petit">Retirer</button></form>
          </div>
        ))}
        <form action={creerAcces.bind(null, resto)} className="pile" style={{ gap: 12, borderTop: '1px solid var(--ligne)', paddingTop: 14 }}>
          <div><h3 style={{ margin: 0 }}>Inviter un utilisateur</h3><p className="sous" style={{ margin: '4px 0 0' }}>Pour vous ou un membre de l’équipe : la personne reçoit un e-mail d’invitation et choisit son mot de passe.</p></div>
          <div className="champ" style={{ maxWidth: 420 }}><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="off" /></div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 14 }}>Ou choisir le mot de passe moi-même (sans e-mail)</summary>
            <div className="pile" style={{ gap: 12, marginTop: 10, maxWidth: 420 }}>
              <div className="champ"><label htmlFor="mdp">Mot de passe</label><input id="mdp" name="mdp" type="password" minLength={10} autoComplete="new-password" /><span className="aide">10 caractères minimum ; à communiquer vous-même à la personne</span></div>
              <div className="champ"><label htmlFor="mdp2">Confirmer le mot de passe</label><input id="mdp2" name="mdp2" type="password" autoComplete="new-password" /></div>
            </div>
          </details>
          <span><button type="submit" className="btn">Inviter</button></span>
        </form>
      </section>
    </>
  );
}
