import Link from 'next/link';
import { notFound } from 'next/navigation';
import { etapesRestaurant } from './etapes';
import { Icone } from '@/components/admin/Icone';
import { Entete, Etat } from '@/components/admin/Ui';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';

export default async function TableauDeBord({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  const [r, s] = await Promise.all([getRestaurantBO(resto), getResume(resto)]);
  if (!r) notFound();
  const etapes = etapesRestaurant(r, s);
  const suivante = etapes.find((e) => e.etat !== 'fait' && e.libelle !== 'Simulateur') ?? etapes[etapes.length - 1];
  const restantes = etapes.filter((e) => e.etat !== 'fait' && e.libelle !== 'Simulateur').length;
  return (
    <>
      <Entete titre="Bonjour"
        texte={restantes ? `${restantes > 1 ? `Encore ${restantes} étapes` : 'Encore une étape'} avant de proposer Pat à vos clients.` : 'Tout est en place : Pat conseille vos clients.'} />
      <div className="carte-bo sticker" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat.png" alt="" width={120} height={132} />
        <div className="pile" style={{ flex: '1 1 380px', gap: 12 }}>
          <span className="surtitre">{restantes ? 'Prochaine étape' : 'Et maintenant'}</span>
          <h2 style={{ fontSize: 28, fontWeight: 800 }}>{suivante.libelle}</h2>
          <span className="discret" style={{ fontSize: 15.5 }}>{suivante.ligne1} · {suivante.ligne2}</span>
          <div className="ligne-actions"><Link href={suivante.href} className="btn"><Icone nom={suivante.icone} taille={18} />{suivante.action}</Link></div>
        </div>
      </div>
      <section className="pile">
        <div><h2 style={{ fontSize: 22 }}>Mise en place</h2><p className="discret" style={{ margin: '6px 0 0' }}>Sept étapes, dans l’ordre. Vous pouvez revenir sur chacune à tout moment.</p></div>
        <div className="grille">
          {etapes.map((e, i) => (
            <div key={e.href} className={`carte-bo ${e === suivante ? 'sticker' : ''}`} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--rose)', color: 'var(--encre)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icone nom={e.icone} /></span>
                  <span className="discret" style={{ fontFamily: 'var(--titre)', fontWeight: 700, fontSize: 13 }}>Étape {i + 1}</span>
                </span>
                <Etat type={e.statut[1]}>{e.statut[0]}</Etat>
              </div>
              <div className="pile" style={{ gap: 4 }}>
                <h3 style={{ fontSize: 21 }}>{e.libelle}</h3>
                <strong style={{ fontSize: 15 }}>{e.ligne1}</strong>
                <span className="discret">{e.ligne2}</span>
              </div>
              <Link href={e.href} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontWeight: 700, textDecoration: 'none' }}>{e.action}<Icone nom="arrow" taille={16} /></Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
