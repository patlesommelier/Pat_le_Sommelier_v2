import Link from 'next/link';
import { redirect } from 'next/navigation';
import s from '../inscription.module.css';
import { Etapes, ZoneEnvoi } from '../composants';
import { envoyerCarte, completerProducteurs } from '../actions';
import { inscriptionCourante } from '@/lib/inscription/etat';
import { resumeVins } from '@/lib/inscription/donnees';

const LIBELLES = { bulles: 'Bulles', blanc: 'Blancs', rose: 'Rosés', orange: 'Orange', rouge: 'Rouges', doux: 'Doux' } as const;
const prix = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export default async function Vins() {
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  if (!i.plats.length) redirect('/inscription/menu');
  const r = resumeVins(i.vins);
  const sansProducteur = i.vins.map((v, k) => ({ v, k })).filter(({ v }) => !v.producteur);
  return (
    <>
      <main className={s.contenu}>
        <Etapes etape={2} />
        <h1 className={s.titre}>Votre carte des vins</h1>
        <p className={s.texte}>Photographiez la carte ou envoyez le PDF. Pat relie chaque vin à sa base de producteurs.</p>
        <ZoneEnvoi action={envoyerCarte} accept="image/*,application/pdf" enCours="Pat lit votre carte…" />
        {r.total > 0 && (
          <section className={s.carte} aria-labelledby="h-vins">
            <h2 id="h-vins" style={{ margin: 0, fontSize: 17 }}>{r.total} vins reconnus</h2>
            <p className={s.texte} style={{ fontSize: 14 }}>
              {Object.entries(r.parCouleur).filter(([, n]) => n).map(([c, n]) => `${LIBELLES[c as keyof typeof LIBELLES]} ${n}`).join(' · ')}
            </p>
            <details>
              <summary className={s.lien} style={{ justifyContent: 'flex-start' }}>Voir les {r.total} vins</summary>
              <ul className={s.liste}>
                {i.vins.map((v, k) => (
                  <li key={k} style={{ flexDirection: 'column', alignItems: 'stretch', padding: '8px 0' }}>
                    <strong>{v.libelleCarte}</strong>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className={s.texte} style={{ fontSize: 13.5 }}>
                        {[v.millesime, v.prix != null ? prix(v.prix) : v.auVerre ? 'au verre' : null].filter(Boolean).join(' · ')}
                      </span>
                      <span className={s.pastille} data-type={v.producteurStatut}>
                        {v.producteurStatut === 'reference' ? 'Déjà référencé' : 'Nouveau producteur'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}
        {sansProducteur.length > 0 && (
          <form id="producteurs" action={completerProducteurs} className={s.alerte} aria-labelledby="h-manq">
            <h2 id="h-manq" style={{ margin: 0, fontSize: 17 }}>
              {sansProducteur.length} vin{sansProducteur.length > 1 ? 's' : ''} sans producteur
            </h2>
            <p className={s.texte} style={{ fontSize: 14 }}>La carte n’indique pas qui les produit. Si vous le savez, Pat les présentera mieux ; sinon, ils restent proposés.</p>
            {sansProducteur.map(({ v, k }) => (
              <div key={k} className={s.champ}>
                <label htmlFor={`producteur-${k}`}>{v.libelleCarte}{v.millesime ? ` ${v.millesime}` : ''}</label>
                <input id={`producteur-${k}`} name={`producteur-${k}`} placeholder="Producteur" autoComplete="off" />
              </div>
            ))}
          </form>
        )}
      </main>
      <div className={s.barreAction}><div>
        {r.total === 0 && <span className={s.texte} style={{ textAlign: 'center', fontSize: 14 }}>Envoyez votre carte pour continuer.</span>}
        {r.total > 0 && sansProducteur.length > 0 && <>
          <button type="submit" form="producteurs" className={s.bouton}>Continuer</button>
          <Link href="/inscription/logo" className={s.lien}>Je compléterai plus tard</Link>
        </>}
        {r.total > 0 && sansProducteur.length === 0 && <Link href="/inscription/logo" className={s.bouton}>Continuer</Link>}
      </div></div>
    </>
  );
}
