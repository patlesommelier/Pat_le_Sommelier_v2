import Link from 'next/link';
import { redirect } from 'next/navigation';
import s from '../inscription.module.css';
import { Etapes, ZoneEnvoi } from '../composants';
import { envoyerMenu, retirerPlat } from '../actions';
import { inscriptionCourante } from '@/lib/inscription/etat';

const CATEGORIES = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', fromage: 'Fromages' } as const;

export default async function Menu() {
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  const categories = (['entree', 'plat', 'dessert', 'fromage'] as const).filter((c) => i.plats.some((p) => p.categorie === c));
  return (
    <>
      <main className={s.contenu}>
        <Etapes etape={1} />
        <h1 className={s.titre}>Votre menu</h1>
        <p className={s.texte}>Photographiez chaque page, ou envoyez le PDF. Pat reconnaît chaque plat.</p>
        <ZoneEnvoi action={envoyerMenu} accept="image/*,application/pdf" enCours="Pat lit votre menu…" />
        {i.plats.length > 0 && (
          <section className={s.carte} aria-labelledby="h-plats">
            <h2 id="h-plats" style={{ margin: 0, fontSize: 17 }}>{i.plats.length} plats reconnus</h2>
            {categories.map((c) => (
              <div key={c}>
                <h3 className={s.categorie}>{CATEGORIES[c]}</h3>
                <ul className={s.liste}>
                  {i.plats.map((p, k) => p.categorie === c && (
                    <li key={k}>
                      <span>{p.nom}</span>
                      <form action={retirerPlat.bind(null, k)}>
                        <button type="submit" className={s.lien} style={{ border: 0, background: 'none' }} aria-label={`Retirer ${p.nom}`}>Retirer</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className={s.texte} style={{ fontSize: 14 }}>Une page manque ? Envoyez-la : les plats s’ajoutent à la liste.</p>
          </section>
        )}
      </main>
      <div className={s.barreAction}><div>
        {i.plats.length > 0
          ? <Link href="/inscription/vins" className={s.bouton}>Continuer</Link>
          : <span className={s.texte} style={{ textAlign: 'center', fontSize: 14 }}>Envoyez votre menu pour continuer.</span>}
      </div></div>
    </>
  );
}
