import Link from 'next/link';
import { Icone } from '@/components/admin/Icone';
import { Entete, Etat, Points, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant } from '@/lib/admin/auth';
import { getPlatsBO } from '@/lib/admin/donnees';
import { pourquoiPas, pourquoiRetenu } from '@/lib/admin/explications';
import { accordsVisibles, getCandidats, getReglages } from '@/lib/donnees';
import { selectionner, tourSuivant } from '@/lib/selection';

const CAT: Record<string, string> = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', fromage: 'Fromages' };

export default async function Simulateur({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ plat?: string | string[]; arelire?: string; tour?: string; table?: string }> }) {
  const { resto } = await params;
  const sp = await searchParams;
  const [plats, R, u] = await Promise.all([getPlatsBO(resto), getReglages(resto), utilisateurCourant()]);
  // Score et rankings : cuisine interne, montrés à Pat seulement. Le restaurant voit le rang et la note /5.
  const interne = Boolean(u?.admin);
  const actifs = plats.filter((p) => p.actif);
  const choisis = (Array.isArray(sp.plat) ? sp.plat : sp.plat ? [sp.plat] : [actifs[0]?.id]).filter((id) => actifs.some((p) => p.id === id)) as string[];
  const arelire = sp.arelire === '1';
  // Par défaut un plat à la fois (avec l'aperçu de l'app) ; « table » : plusieurs plats pour un vin à partager.
  const table = sp.table === '1' || choisis.length > 1;
  const tour = Math.max(1, Math.min(5, Number(sp.tour) || 1));
  const statuts = arelire ? ['valide', 'propose'] : accordsVisibles();
  const { candidats, lignesParVin, exclus } = choisis.length ? await getCandidats(resto, choisis, statuts) : { candidats: [], lignesParVin: new Map(), exclus: new Set<string>() };
  const sel = selectionner(candidats, choisis, { reglages: R });
  // Tours suivants : chaque tour reprend là où le précédent s'est arrêté.
  const proposes = sel.liste.map((r) => r.vin.id);
  let liste = sel.liste;
  for (let t = 2; t <= tour; t++) {
    liste = tourSuivant(sel, proposes, R.tourSuivant, R.diversite && choisis.length === 1, R.plafondBulles);
    proposes.push(...liste.map((r) => r.vin.id));
  }
  const tour2 = new Set(tourSuivant(sel, proposes, R.tourSuivant, R.diversite, R.plafondBulles).map((r) => r.vin.id));
  const deja = new Set(proposes);
  const ecartes = sel.classement.filter((c) => !deja.has(c.vin.id)).slice(0, 6);
  const elimines = candidats.filter((c) => choisis.every((p) => typeof c.notes[p] === 'number') && Math.min(...choisis.map((p) => c.notes[p])) <= R.noteEliminatoire).length;
  const plusieurs = choisis.length > 1;
  const nomPlat = (id: string) => { const p = actifs.find((x) => x.id === id); return p?.nom_court ?? p?.nom ?? id; };
  const base = `/admin/${resto}/simulateur`;
  const q = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    choisis.forEach((c) => u.append('plat', c));
    if (arelire) u.set('arelire', '1');
    if (table) u.set('table', '1');
    Object.entries(extra).forEach(([k, v]) => u.set(k, v));
    return `${base}?${u}`;
  };

  return (
    <>
      <Entete titre="Simulateur" texte="Ce que vos clients voient, et pourquoi Pat propose ces vins. Choisissez un plat, ou plusieurs pour un vin à partager à table.">
        <Link href={`/${resto}`} target="_blank" className="btn sec"><Icone nom="out" taille={18} />Ouvrir l’app</Link>
      </Entete>
      <div className="rangee">
        <form method="get" className="etroit" style={{ flex: '1 1 300px' }}>
          <div className="carte-bo pile">
            <h2>Scénario</h2>
            {Object.entries(CAT).map(([k, l]) => {
              const ps = actifs.filter((p) => p.categorie === k);
              if (!ps.length) return null;
              return (
                <fieldset key={k} style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{l}</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ps.map((p) => {
                      const style = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '4px 10px', borderRadius: 999, border: `1.5px solid ${choisis.includes(p.id) ? 'var(--encre)' : 'var(--ligne)'}`, background: choisis.includes(p.id) ? 'var(--rose)' : '#FFF', fontSize: 13.5, cursor: 'pointer', color: 'var(--texte)', textDecoration: 'none' };
                      // Un seul plat : un clic l'affiche directement (avec le téléphone). Plusieurs plats : cases à cocher.
                      return table ? (
                        <label key={p.id} style={style}>
                          <input type="checkbox" name="plat" value={p.id} defaultChecked={choisis.includes(p.id)} style={{ accentColor: 'var(--encre)' }} />{p.nom_court ?? p.nom}
                        </label>
                      ) : (
                        <Link key={p.id} href={`${base}?${new URLSearchParams({ plat: p.id, ...(arelire ? { arelire: '1' } : {}) })}`} style={style} aria-current={choisis.includes(p.id) ? 'true' : undefined}>{p.nom_court ?? p.nom}</Link>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
            {table && <input type="hidden" name="table" value="1" />}
            {!table && choisis[0] && <input type="hidden" name="plat" value={choisis[0]} />}
            <label className="case"><input type="checkbox" name="arelire" value="1" defaultChecked={arelire} /><span>Compter aussi les accords à relire<small>Pour voir le résultat avant de les valider</small></span></label>
            <span className="ligne-actions">
              {table && <button type="submit" className="btn">Simuler</button>}
              {table
                ? <Link href={`${base}?${new URLSearchParams({ plat: choisis[0] ?? '', ...(arelire ? { arelire: '1' } : {}) })}`} className="btn fantome petit">Un seul plat (avec l’app)</Link>
                : <><button type="submit" className="btn sec petit">Mettre à jour</button><Link href={`${base}?${new URLSearchParams({ table: '1', plat: choisis[0] ?? '', ...(arelire ? { arelire: '1' } : {}) })}`} className="btn fantome petit">Plusieurs plats (vin pour la table)</Link></>}
            </span>
          </div>
        </form>
        {plusieurs && (
          <div className="carte-bo" style={{ flex: '0 1 300px', alignSelf: 'flex-start', fontSize: 13.5 }}>
            <span className="discret">L’aperçu de l’app montre un plat à la fois : revenez à « Un seul plat » pour voir le téléphone.</span>
          </div>
        )}
        {!plusieurs && choisis[0] && (
          <div style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span className="surtitre">L’app de vos clients</span>
            <iframe title="Aperçu de l’app client" src={`/${resto}/plat/${choisis[0]}${tour > 1 ? `?tour=${tour}` : ''}`}
              style={{ width: 360, maxWidth: '100%', height: 740, border: '10px solid #24151A', borderRadius: 44, background: '#FFF' }} />
            {arelire && <span className="discret" style={{ fontSize: 13, textAlign: 'center' }}>L’app ne montre que les accords validés{process.env.AFFICHER_ACCORDS_PROPOSES === 'true' ? ' (et, en démonstration, ceux à relire)' : ''}.</span>}
          </div>
        )}
        <section className="large" style={{ flex: '1 1 340px' }}>
          <div className="carte-bo pile">
            <div>
              <h2>Pourquoi ces vins ?</h2>
              <p className="sous">{plusieurs ? `Un vin pour toute la table (${choisis.map(nomPlat).join(' + ')}) : la note la plus basse compte.` : `${nomPlat(choisis[0] ?? '')}${tour > 1 ? ` · tour ${tour}` : ''}`}{interne ? ' · note · score' : ' · rang · note /5 · prix'}</p>
            </div>
            {!liste.length && <p className="discret">{tour > 1 ? 'Plus aucun vin assez bien noté : Pat propose de revenir aux premières propositions.' : 'Aucun vin ne s’accorde assez bien.'}</p>}
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {liste.map((r, i) => (
                <li key={r.vin.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--encre)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                  <Vignette url={r.vin.etiquette_url} taille={44} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <b>{r.vin.libelle}</b>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--encre)', fontWeight: 700 }}><Points note={r.note} />{interne ? `${r.note}/5 · score ${r.score}` : `${r.note}/5`} · {euros(r.vin.prix ?? r.vin.prix_verre)}</span>
                    <span className="discret" style={{ fontSize: 13.5 }}>{pourquoiRetenu(r, i + 1, liste, interne)}</span>
                    {plusieurs && <span className="discret" style={{ fontSize: 12.5 }}>{choisis.map((p) => `${nomPlat(p)} ${r.vin.notes[p]}`).join(' · ')}</span>}
                  </span>
                </li>
              ))}
            </ol>
            {ecartes.length > 0 && (
              <div className="pile" style={{ gap: 8, padding: 14, borderRadius: 12, background: 'var(--fond)' }}>
                <span className="surtitre" style={{ color: 'var(--discret)' }}>Juste après</span>
                {ecartes.map((c) => {
                  const [t, k] = pourquoiPas(c, R, liste, tour2);
                  return <span key={c.vin.id} style={{ fontSize: 13.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}><span>{c.vin.libelle} <span className="discret">({interne ? `${c.note} · ${c.score}` : `${c.note}/5`})</span></span><Etat type={k}>{t}</Etat></span>;
                })}
              </div>
            )}
            <span className="discret" style={{ fontSize: 13 }}>{elimines} vin{elimines > 1 ? 's' : ''} écarté{elimines > 1 ? 's' : ''} (note ≤ {R.noteEliminatoire}){exclus.size ? ` · ${exclus.size} retiré${exclus.size > 1 ? 's' : ''} par vos consignes` : ''}.</span>
            <div className="ligne-actions">
              {tour > 1 && <Link href={q({ tour: String(tour - 1) })} className="btn fantome petit">← Tour {tour - 1}</Link>}
              {tour2.size > 0 && <Link href={q({ tour: String(tour + 1) })} className="btn sec petit">Le client veut autre chose →</Link>}
              <Link href={`/admin/${resto}/regles`} className="btn fantome petit"><Icone nom="sliders" taille={16} />Ajuster les règles</Link>
            </div>
            {lignesParVin.size === 0 && choisis.length > 0 && <p className="discret">Aucun accord {arelire ? '' : 'validé '}pour {plusieurs ? 'ces plats' : 'ce plat'}.{!arelire && ' Cochez « Compter aussi les accords à relire ».'}</p>}
          </div>
        </section>
      </div>
    </>
  );
}
