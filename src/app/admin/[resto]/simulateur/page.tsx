import Link from 'next/link';
import { Icone } from '@/components/admin/Icone';
import { ApercuApp } from '@/components/admin/ApercuApp';
import { Entete, Etat, Points, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getPlatsBO, getRegleDuJour } from '@/lib/admin/donnees';
import { pourquoiPas, pourquoiRetenu } from '@/lib/admin/explications';
import { accordsVisibles, getCandidats, getReglages } from '@/lib/donnees';
import { selectionner, tourSuivant } from '@/lib/selection';

export default async function Simulateur({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ plat?: string | string[]; arelire?: string; tour?: string; bienvenue?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const bienvenue = sp.bienvenue === '1';
  const [plats, R, u, jour] = await Promise.all([getPlatsBO(resto), getReglages(resto), utilisateurCourant(),
    // Arrivée après l'inscription : un plat dont l'accord est parlant (celui de la règle du jour), plutôt que le premier du menu.
    bienvenue && !sp.plat ? getRegleDuJour(resto) : null]);
  // Score et rankings : cuisine interne, montrés à Pat seulement. Le restaurant voit le rang et la note /5.
  const interne = Boolean(u?.admin);
  const actifs = plats.filter((p) => p.actif);
  const choisis = (Array.isArray(sp.plat) ? sp.plat : sp.plat ? [sp.plat] : [jour?.plat_id ?? actifs[0]?.id]).filter((id) => actifs.some((p) => p.id === id)) as string[];
  const arelire = sp.arelire === '1';
  const tour = Math.max(1, Math.min(5, Number(sp.tour) || 1));
  const statuts = arelire ? ['valide', 'propose'] : accordsVisibles();
  const { candidats, lignesParVin, exclus } = choisis.length ? await getCandidats(resto, choisis, statuts) : { candidats: [], lignesParVin: new Map(), exclus: new Set<string>() };
  const suggestion = actifs.some((p) => choisis.includes(p.id) && p.categorie === 'suggestion');
  const sel = selectionner(candidats, choisis, { reglages: R, suggestion });
  // Tours suivants : chaque tour reprend là où le précédent s'est arrêté.
  const proposes = sel.liste.map((r) => r.vin.id);
  let liste = sel.liste;
  for (let t = 2; t <= tour; t++) {
    liste = tourSuivant(sel, proposes, R.tourSuivant, R.diversite && choisis.length === 1, R.plafondBulles, R.bullesApres);
    proposes.push(...liste.map((r) => r.vin.id));
  }
  const tour2 = new Set(tourSuivant(sel, proposes, R.tourSuivant, R.diversite, R.plafondBulles, R.bullesApres).map((r) => r.vin.id));
  const deja = new Set(proposes);
  const ecartes = sel.classement.filter((c) => !deja.has(c.vin.id)).slice(0, 6);
  const elimines = candidats.filter((c) => choisis.every((p) => typeof c.notes[p] === 'number') && Math.min(...choisis.map((p) => c.notes[p])) <= R.noteEliminatoire).length;
  const plusieurs = choisis.length > 1;
  const nomPlat = (id: string) => { const p = actifs.find((x) => x.id === id); return p?.nom_court ?? p?.nom ?? id; };

  return (
    <>
      <Entete titre="Simulateur">
        <Link href={`/${resto}`} target="_blank" className="btn sec"><Icone nom="out" taille={18} />Ouvrir l’app</Link>
      </Entete>
      {/* Arrivée après l'inscription : les accords sont prêts, voici ce que les clients verront. */}
      {bienvenue && (
        <section className="carte-bo rappel-inventaire" aria-labelledby="bienvenue-simulateur">
          <div className="pile" style={{ gap: 4, flex: '1 1 320px' }}>
            <span className="surtitre">Vos accords sont prêts</span>
            <b id="bienvenue-simulateur" style={{ fontSize: 19 }}>Voici ce que vos clients verront</b>
            <span className="petit">Le téléphone montre votre app : touchez l’écran pour choisir un autre plat. Pat vous propose le vin de votre carte qui l’accompagne, et vous dit pourquoi.</span>
          </div>
          <Link href={`/admin/${resto}`} className="btn">Continuer vers mon espace →</Link>
        </section>
      )}
      <div className="rangee">
        {/* Le téléphone : la vraie app, où l'on choisit ses plats comme un client ; la page suit le plat choisi. */}
        {choisis[0] && (
          <div style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span className="surtitre">L’app de vos clients</span>
            <ApercuApp resto={resto} garder={bienvenue ? { bienvenue: '1' } : {}}
              src={`/${resto}/plat/${encodeURIComponent(choisis[0])}?${new URLSearchParams({ ...(choisis.length > 1 ? { et: choisis.slice(1).join(',') } : {}), ...(tour > 1 ? { tour: String(tour) } : {}) })}`} />
            <span className="discret" style={{ fontSize: 13, textAlign: 'center' }}>Touchez l’écran pour choisir un autre plat.</span>
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
                  <span style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--encre)', color: '#EFEBE9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
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
            <span className="discret" style={{ fontSize: 13 }}>{elimines} vin{elimines > 1 ? 's' : ''} trop faible{elimines > 1 ? 's' : ''} avec {plusieurs ? 'ces plats' : 'ce plat'}{exclus.size ? ` · ${exclus.size} vin${exclus.size > 1 ? 's' : ''} que vous avez retiré${exclus.size > 1 ? 's' : ''}` : ''}.</span>
            <div className="ligne-actions">
              <Link href={`/admin/${resto}/regles`} className="btn sec petit"><Icone nom="sliders" taille={16} />Ajuster les règles</Link>
              <Link href={`/admin/${resto}/accords${choisis[0] ? `?plat=${encodeURIComponent(choisis[0])}` : ''}`} className="btn sec petit"><Icone nom="link" taille={16} />Revoir les accords</Link>
            </div>
            {lignesParVin.size === 0 && choisis.length > 0 && <p className="discret">Aucun accord {arelire ? '' : 'validé '}pour {plusieurs ? 'ces plats' : 'ce plat'}{arelire ? '.' : ' : relisez ses accords pour que vos clients voient des vins.'}</p>}
          </div>
        </section>
      </div>
    </>
  );
}
