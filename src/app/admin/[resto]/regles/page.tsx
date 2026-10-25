import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { enregistrerReglages, retablirReglage, retablirTout } from '../../actions';
import { Icone } from '@/components/admin/Icone';
import { Entete, Etat, Message } from '@/components/admin/Ui';
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
    { n: '2b', titre: 'Les bulles après', texte: 'À égalité de classement entre un vin effervescent et un autre vin, Pat propose l’autre vin avant les bulles.', champs: [{ cle: 'bullesApres', libelle: 'Active' }] },
    { n: '2c', titre: 'Coups de cœur', texte: 'Un vin coché « Coup de cœur de la maison » gagne un point au classement : il remonte devant des vins proches.', champs: [{ cle: 'bonusCoupDeCoeur', libelle: 'Active' }] },
    { n: '3', titre: 'Diversité', texte: 'À égalité, le vin le plus différent de ceux déjà retenus (couleur, pays, cépage, appellation) passe devant, puis la sélection de Pat, puis l’ordre de votre carte.', champs: [{ cle: 'diversite', libelle: 'Active' }] },
  ]],
  ['Composer la liste', [
    { n: '3–6', titre: 'Nombre de vins', texte: 'Les premiers vins du classement, puis jusqu’au maximum s’ils sont bien notés et proches du dernier retenu.', champs: [{ cle: 'premiers', libelle: 'Premiers' }, { cle: 'maximum', libelle: 'Maximum' }, { cle: 'noteMinAjout', libelle: 'Note ≥' }] },
    { n: '7', titre: 'Un vin plus cher', texte: 'Un vin bien noté nettement plus cher que la liste, pour les grandes occasions.', champs: [{ cle: 'plusCher', libelle: 'Actif' }, { cle: 'facteurPlusCher', libelle: 'Prix ≥', suffixe: '× le plus cher' }], client: 'Pour une belle occasion' },
    { n: '8', titre: 'Un vin moins cher', texte: 'Quand tous les vins ont un prix proche, un vin bien noté deux fois moins cher.', champs: [{ cle: 'moinsCher', libelle: 'Actif' }, { cle: 'ecartMoinsCher', libelle: 'Si écart <', suffixe: '×' }], client: 'Plus accessible' },
    { n: '11', titre: 'Plafond bulles', texte: 'Pas plus d’effervescents dans une liste que ce nombre (un de plus si les seuls vins notés 5 sont des bulles).', champs: [{ cle: 'plafondBulles', libelle: 'Au plus' }] },
    { n: '12', titre: 'Vin des suggestions du moment', texte: 'Avec un plat de vos suggestions, Pat ne propose pas de bouteille au-dessus de ce prix (0 : sans limite).', champs: [{ cle: 'prixMaxSuggestion', libelle: 'Au plus', suffixe: '€' }] },
    { n: 'T2', titre: 'Tour suivant', texte: 'Si le client veut autre chose, Pat propose les vins suivants du classement.', champs: [{ cle: 'tourSuivant', libelle: 'Vins' }] },
  ]],
];

const affiche = (v: number | boolean) => typeof v === 'boolean' ? (v ? 'active' : 'inactive') : String(v).replace('.', ',');

export default async function Regles({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { resto } = await params;
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { ok } = await searchParams;
  const [R, PAT, version] = await Promise.all([getReglages(resto), parametresEnService(requete),
    reglesEnService(requete).catch(() => null)]);
  const modifies = (Object.keys(PAT) as Cle[]).filter((k) => R[k] !== PAT[k]);
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
              <h2 className="surtitre" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: 1.6 }}>{g}</h2>
              {defs.map((d) => {
                const mod = d.champs.filter((c) => R[c.cle] !== PAT[c.cle]);
                return (
                  <div key={d.n} className="carte-bo" style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px 24px', alignItems: 'center' }}>
                    {u.admin && <span style={{ width: 40, height: 40, borderRadius: 20, border: '1.5px solid var(--encre)', color: 'var(--encre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--titre)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{d.n}</span>}
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
                            style={{ width: 64, minHeight: 44, boxSizing: 'border-box', padding: '8px 10px', textAlign: 'center', border: '1.5px solid var(--ligne)', borderRadius: 10, font: '700 15px Outfit, sans-serif' }} />
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
          <div className="ligne-actions"><button type="submit" className="btn"><Icone nom="check" taille={18} />Enregistrez vos règles</button></div>
        </FormulaireAdmin>
      </div>
    </>
  );
}
