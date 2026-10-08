import Link from 'next/link';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { enregistrerReglages, remettreVin, retablirReglage, retablirTout, retirerVin } from '../../actions';
import { Icone } from '@/components/admin/Icone';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { getExclusions, getVinsBO } from '@/lib/admin/donnees';
import { getReglages } from '@/lib/donnees';
import { requete } from '@/lib/db';
import { parametresEnService, reglesEnService } from '@/lib/regles/versions';
import { type Reglages } from '@/lib/selection';
import { exigerAcces } from '@/lib/admin/auth';

type Cle = keyof Reglages;
interface Def { n: string; titre: string; texte: string; champs: { cle: Cle; libelle: string; suffixe?: string }[]; client?: string }

const GROUPES: [string, Def[]][] = [
  ['Avant le classement', [
    { n: '10', titre: 'Une seule contenance', texte: 'Quand un vin existe en 75 cl et en 37,5 cl, seule la bouteille est proposée.', champs: [{ cle: 'contenance', libelle: 'Active' }] },
    { n: '1', titre: 'Élimination', texte: 'Un vin trop faible sur le plat n’est jamais proposé, même pour compléter la liste.', champs: [{ cle: 'noteEliminatoire', libelle: 'Écarter les notes ≤' }] },
  ]],
  ['Classement', [
    { n: '2', titre: 'Classement de Pat', texte: 'Pat classe les vins à partir de la note d’accord et de sa propre sélection. Les mieux classés sont proposés en premier.', champs: [] },
    { n: '3', titre: 'Diversité', texte: 'À égalité, le vin le plus différent de ceux déjà retenus (couleur, pays, cépage, appellation) passe devant, puis la sélection de Pat, puis l’ordre de votre carte.', champs: [{ cle: 'diversite', libelle: 'Active' }] },
  ]],
  ['Composer la liste', [
    { n: '3–6', titre: 'Nombre de vins', texte: 'Les premiers vins du classement, puis jusqu’au maximum s’ils sont bien notés et proches du dernier retenu.', champs: [{ cle: 'premiers', libelle: 'Premiers' }, { cle: 'maximum', libelle: 'Maximum' }, { cle: 'noteMinAjout', libelle: 'Note ≥' }] },
    { n: '7', titre: 'Un vin plus cher', texte: 'Un vin bien noté nettement plus cher que la liste, pour les grandes occasions.', champs: [{ cle: 'plusCher', libelle: 'Actif' }, { cle: 'facteurPlusCher', libelle: 'Prix ≥', suffixe: '× le plus cher' }], client: 'Pour une belle occasion' },
    { n: '8', titre: 'Un vin moins cher', texte: 'Quand tous les vins ont un prix proche, un vin bien noté deux fois moins cher.', champs: [{ cle: 'moinsCher', libelle: 'Actif' }, { cle: 'ecartMoinsCher', libelle: 'Si écart <', suffixe: '×' }], client: 'Plus accessible' },
    { n: '11', titre: 'Plafond bulles', texte: 'Pas plus d’effervescents dans une liste que ce nombre (un de plus si les seuls vins notés 5 sont des bulles).', champs: [{ cle: 'plafondBulles', libelle: 'Au plus' }] },
    { n: 'T2', titre: 'Tour suivant', texte: 'Si le client veut autre chose, Pat propose les vins suivants du classement.', champs: [{ cle: 'tourSuivant', libelle: 'Vins' }] },
  ]],
];

const affiche = (v: number | boolean) => typeof v === 'boolean' ? (v ? 'active' : 'inactive') : String(v).replace('.', ',');

export default async function Regles({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { ok } = await searchParams;
  const [R, exclusions, vins, PAT, version] = await Promise.all([getReglages(resto), getExclusions(resto), getVinsBO(resto), parametresEnService(requete),
    reglesEnService(requete).catch(() => null)]);
  const modifies = (Object.keys(PAT) as Cle[]).filter((k) => R[k] !== PAT[k]);
  const exclus = new Set(exclusions.map((x) => x.cible));
  return (
    <>
      <Entete titre="Règles du sommelier" texte={`Pat applique par défaut ses règles de sélection (${version?.code ?? 'V7'}). Ajustez-les à votre service : la valeur de Pat reste visible et se rétablit d’un clic.`}>
        {modifies.length > 0 && <form action={retablirTout.bind(null, resto)}><button className="btn sec"><Icone nom="reset" taille={18} />Rétablir les règles de Pat</button></form>}
      </Entete>
      <Message ok={ok ? 'Réglages enregistrés : le simulateur et l’app les appliquent déjà.' : undefined} />
      <div className="rangee">
        <FormulaireAdmin action={enregistrerReglages.bind(null, resto)} className="large" style={{ gap: 28 }}>
          {GROUPES.map(([g, defs]) => (
            <section key={g} className="pile" style={{ gap: 12 }}>
              <h2 className="surtitre" style={{ fontFamily: 'Lato, sans-serif', letterSpacing: 1.6 }}>{g}</h2>
              {defs.map((d) => {
                const mod = d.champs.filter((c) => R[c.cle] !== PAT[c.cle]);
                return (
                  <div key={d.n} className="carte-bo" style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px 24px', alignItems: 'center' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 20, border: '1.5px solid var(--encre)', color: 'var(--encre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--titre)', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{d.n}</span>
                    <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}><b style={{ fontFamily: 'var(--titre)', fontSize: 17 }}>{d.titre}</b>{mod.length ? <Etat type="modifie">Modifié</Etat> : <Etat type="defaut">Par défaut</Etat>}</span>
                      <span className="discret">{d.texte}</span>
                      {mod.length > 0 && <span className="discret" style={{ fontSize: 13 }}>Valeur de Pat : {mod.map((c) => `${c.libelle.toLowerCase()} ${affiche(PAT[c.cle])}`).join(', ')}</span>}
                      {d.client && <span className="discret" style={{ fontSize: 13 }}>Côté client : <b style={{ color: 'var(--texte)' }}>{d.client}</b></span>}
                    </div>
                    <div style={{ flex: '0 1 340px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                      {d.champs.map((c) => typeof PAT[c.cle] === 'boolean' ? (
                        <label key={c.cle} className="case"><input type="checkbox" name={c.cle} defaultChecked={R[c.cle] as boolean} />{c.libelle}</label>
                      ) : (
                        <span key={c.cle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label htmlFor={c.cle} style={{ fontSize: 13.5 }}>{c.libelle}</label>
                          <input id={c.cle} name={c.cle} inputMode="decimal" defaultValue={affiche(R[c.cle])}
                            style={{ width: 64, minHeight: 44, boxSizing: 'border-box', padding: '8px 10px', textAlign: 'center', border: '1.5px solid var(--ligne)', borderRadius: 10, font: '700 15px Lato, sans-serif' }} />
                          {c.suffixe && <span className="discret">{c.suffixe}</span>}
                        </span>
                      ))}
                      {mod.map((c) => (
                        <button key={c.cle} formAction={retablirReglage.bind(null, resto, c.cle)} className="btn fantome petit" aria-label={`Rétablir ${c.libelle} (${d.titre})`}><Icone nom="reset" taille={16} />Rétablir</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          <div className="ligne-actions"><button type="submit" className="btn"><Icone nom="check" taille={18} />Enregistrer les réglages</button></div>
        </FormulaireAdmin>
        <aside className="etroit">
          <div className="carte-bo sticker" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pat/pat.png" alt="" width={54} height={59} />
            <div className="pile" style={{ gap: 8 }}><b>Chaque réglage se teste</b><span className="discret">Le simulateur montre tout de suite les vins proposés pour chaque plat avec vos réglages.</span>
              <Link href={`/admin/${resto}/simulateur`} className="btn sec petit"><Icone nom="phone" taille={18} />Ouvrir le simulateur</Link></div>
          </div>
          <div className="carte-bo pile">
            <div><h2>Vins retirés</h2><p className="sous">Rupture, bouteille réservée… Pat ne les propose plus, sans toucher à votre carte.</p></div>
            {exclusions.length === 0 && <span className="discret">Aucun vin retiré.</span>}
            {exclusions.map((x) => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid var(--ligne)', paddingTop: 10 }}>
                <span><b>{vins.find((v) => v.id === x.cible)?.libelle ?? x.cible}</b><br /><span className="discret">{x.cible}{x.date_fin ? ` · jusqu’au ${x.date_fin.split('-').reverse().join('/')}` : ''}</span></span>
                <form action={remettreVin.bind(null, resto, x.id)}><button className="btn fantome petit">Remettre</button></form>
              </div>
            ))}
            <form action={retirerVin.bind(null, resto)} className="pile" style={{ gap: 10, borderTop: '1px solid var(--ligne)', paddingTop: 12 }}>
              <div className="champ"><label htmlFor="vin">Retirer un vin</label>
                <select id="vin" name="vin" required defaultValue="">
                  <option value="" disabled>Choisir un vin…</option>
                  {vins.filter((v) => !exclus.has(v.id)).map((v) => <option key={v.id} value={v.id}>{v.id} · {v.libelle}{v.format !== '75 cl' ? ` (${v.format})` : ''}</option>)}
                </select></div>
              <div className="champ"><label htmlFor="jusqua">Jusqu’au (facultatif)</label><input id="jusqua" name="jusqua" type="date" /></div>
              <button className="btn sec petit">Retirer</button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
