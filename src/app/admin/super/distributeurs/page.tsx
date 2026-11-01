// Super-admin — distributeurs et importateurs de Quid Vinum : leurs tarifs, prix publics et prix QV, et la marge par défaut de Quid Vinum.
import Link from 'next/link';
import { creerDistributeur, enregistrerMargeDefaut, enregistrerQv } from '../distributeurs-actions';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { getCoordonneesQv, getDistributeurs, margeDefaut } from '@/lib/distributeurs/donnees';

export const dynamic = 'force-dynamic';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Brussels' });

export default async function Distributeurs({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [liste, qv, marge] = await Promise.all([getDistributeurs(), getCoordonneesQv(), margeDefaut()]);
  return (
    <>
      <Entete titre="Distributeurs" texte="Les distributeurs et importateurs de Quid Vinum : leurs prix publics et leurs prix QV (avec la remise de Quid Vinum). Chaque restaurant achète au prix QV + sa marge de Quid Vinum. Les restaurants choisissent un distributeur dans leurs Fournisseurs et commandent dans son catalogue : la commande part chez Quid Vinum." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      <div className="rangee">
        <div className="large" style={{ gap: 16 }}>
          <div className="carte-bo" style={{ padding: 0 }}>
            <div className="tableau">
              <table>
                <thead><tr><th>Distributeur</th><th className="droite">Vins</th><th>Tarif</th><th className="droite">Restaurants</th></tr></thead>
                <tbody>
                  {!liste.length && <tr><td colSpan={4} className="discret">Aucun distributeur pour l’instant : ajoutez le premier à droite.</td></tr>}
                  {liste.map((d) => (
                    <tr key={d.id}>
                      <td><div className="nom-distributeur">
                        {/* Case de logo de taille fixe : les noms restent alignés, quel que soit le format du logo (ou son absence). */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <span className="case-logo">{d.logo_url && <img src={d.logo_url} alt="" />}</span>
                        <span><Link href={`/admin/super/distributeurs/${d.id}`}><b>{d.nom}</b></Link>{!d.actif && <> <Etat type="defaut">Masqué</Etat></>}
                        {d.lecture_statut === 'en_cours' && <> <Etat type="propose">Lecture en cours</Etat></>}{d.lecture_statut === 'echec' && <> <Etat type="attention">Lecture en échec</Etat></>}</span></div></td>
                      <td className="droite">{d.vins}</td>
                      <td>{d.source === 'api' ? <span className="petit">API{d.api_synchro_le && <><br /><span className="discret">{date(d.api_synchro_le)}</span></>}</span>
                        : d.tarif_nom ? <span className="petit">{d.tarif_nom}<br /><span className="discret">{date(d.tarif_le!)}</span></span> : <span className="discret">—</span>}</td>
                      <td className="droite">{d.restaurants || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="etroit" style={{ flex: '1 1 320px' }}>
          <form action={creerDistributeur} className="carte-bo pile">
            <h2>Nouveau distributeur</h2>
            <div className="champ"><label htmlFor="nom">Nom du distributeur</label><input id="nom" name="nom" required placeholder="Tapez le nom ici" /></div>
            <button className="btn">Créer</button>
          </form>
          <FormulaireAdmin action={enregistrerMargeDefaut} className="carte-bo pile">
            <div><h2>Marge de Quid Vinum</h2><p className="sous">Ajoutée au prix QV quand un restaurant active un distributeur. Elle se change ensuite pour chaque restaurant dans la fiche du distributeur.</p></div>
            <div className="champ"><label htmlFor="marge_defaut">Marge par défaut (%)</label><input id="marge_defaut" name="marge_defaut" inputMode="decimal" defaultValue={String(marge).replace('.', ',')} required /></div>
            <button className="btn sec">Enregistrer</button>
          </FormulaireAdmin>
          <FormulaireAdmin action={enregistrerQv} className="carte-bo pile">
            <div><h2>Commandes Quid Vinum</h2><p className="sous">Les commandes des restaurants aux distributeurs de la base partent à cette adresse, avec ces coordonnées sur le bon de commande.</p></div>
            <div className="champ"><label htmlFor="qv_nom">Société</label><input id="qv_nom" name="qv_nom" defaultValue={qv.nom} /></div>
            <div className="champ"><label htmlFor="qv_email">E-mail des commandes</label><input id="qv_email" name="qv_email" type="email" defaultValue={qv.email ?? ''} required /></div>
            <div className="champ"><label htmlFor="qv_adresse">Adresse</label><textarea id="qv_adresse" name="qv_adresse" rows={2} defaultValue={qv.adresse ?? ''} /></div>
            <div className="champ"><label htmlFor="qv_tva">TVA</label><input id="qv_tva" name="qv_tva" defaultValue={qv.tva ?? ''} /></div>
            <div className="champ"><label htmlFor="qv_telephone">Téléphone</label><input id="qv_telephone" name="qv_telephone" defaultValue={qv.telephone ?? ''} /></div>
            <button className="btn sec">Enregistrer</button>
          </FormulaireAdmin>
        </div>
      </div>
    </>
  );
}
