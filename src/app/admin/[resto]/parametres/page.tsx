// Gestion des stocks — Paramètres : limite de stock bas (alerte), coordonnées du restaurant sur les bons de commande.
import { enregistrerParametresStock } from '../../stocks-actions';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getCoordonnees } from '@/lib/admin/stocks';
import { envoiEmailConfigure } from '@/lib/email';

export default async function Parametres({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const c = await getCoordonnees(resto);
  if (!c) return null;
  const champ = (nom: string, libelle: string, valeur: string | null, o: { type?: string; aide?: string } = {}) => (
    <label className="champ"><span>{libelle}</span><input name={nom} type={o.type ?? 'text'} defaultValue={valeur ?? ''} maxLength={200} />{o.aide && <span className="aide">{o.aide}</span>}</label>
  );
  return (
    <>
      <Entete titre="Paramètres des stocks" texte="Quand prévenir d’un stock bas, et les coordonnées de votre restaurant sur les bons de commande." />
      <FormulaireAdmin action={enregistrerParametresStock.bind(null, resto)} className="pile" style={{ gap: 20, maxWidth: 820 }}>
        <section className="carte-bo pile" style={{ gap: 12 }}>
          <h2>Limite de stock bas</h2>
          <label className="champ" style={{ maxWidth: 320 }}><span>Alerte à partir de</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input name="stock_limite_basse" type="number" min={0} max={1000} defaultValue={c.stock_limite_basse} required style={{ width: 100 }} /> bouteilles ou moins</span>
            <span className="aide">Un point d’exclamation rouge apparaît alors dans Stocks et sur la carte des vins (jamais à l’impression), avec un bouton pour commander.</span>
          </label>
        </section>
        <section className="carte-bo pile" style={{ gap: 12 }}>
          <h2>Vos coordonnées sur les bons de commande</h2>
          <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
            {champ('commande_societe', 'Nom (ou raison sociale)', c.commande_societe, { aide: `Vide : « ${c.nom} »` })}
            {champ('commande_tva', 'Numéro de TVA', c.commande_tva)}
            <label className="champ" style={{ gridColumn: '1 / -1' }}><span>Adresse (de livraison)</span><textarea name="commande_adresse" rows={2} defaultValue={c.commande_adresse ?? ''} /></label>
            {champ('commande_contact', 'Contact', c.commande_contact)}
            {champ('commande_telephone', 'Téléphone', c.commande_telephone, { type: 'tel' })}
            {champ('commande_email', 'Adresse e-mail', c.commande_email, { type: 'email', aide: 'Le fournisseur y répond ; vous recevez une copie de chaque bon envoyé.' })}
          </div>
          <span className="petit discret">{envoiEmailConfigure()
            ? '« Envoyer au fournisseur » envoie le bon de commande par e-mail, en pièce jointe (PDF), directement depuis la page Commandes de vin.'
            : '« Envoyer au fournisseur » ouvre votre messagerie avec la commande rédigée et télécharge le bon de commande (PDF), à joindre à l’e-mail.'}</span>
        </section>
        <span><button className="btn">Enregistrer les paramètres</button></span>
      </FormulaireAdmin>
    </>
  );
}
