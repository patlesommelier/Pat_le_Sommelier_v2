// Consommation de l'API Claude (super-admin) : coût estimé par restaurant et par étape (lecture de la carte, accords,
// présentations…), sur une période. Chaque appel est noté par clientClaude (table consommation_claude).
import Link from 'next/link';
import { Entete } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { coutClaude } from '@/lib/claude';

export const dynamic = 'force-dynamic';

const PERIODES = [['1', 'Aujourd’hui'], ['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours']] as const;
const dollars = (n: number) => `${n.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const jetons = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));

type Ligne = { restaurant: string | null; nom: string | null; poste: string; modele: string; appels: number; entree: number; sortie: number; cache_lu: number; cache_ecrit: number; recherches: number; debut: string };

export default async function Consommation({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await exigerAdmin();
  const { jours: j } = await searchParams;
  const jours = PERIODES.some(([k]) => k === j) ? Number(j) : 30;
  // Restaurant : celui de l'appel, sinon celui créé par l'inscription (lecture de la carte et du menu avant sa création).
  const lignes = await requete<Ligne>(
    `select coalesce(c.restaurant_id, i.restaurant_id) as restaurant, r.nom, c.poste, c.modele, count(*)::int as appels,
            sum(c.entree)::float8 as entree, sum(c.sortie)::float8 as sortie, sum(c.cache_lu)::float8 as cache_lu,
            sum(c.cache_ecrit)::float8 as cache_ecrit, sum(c.recherches)::int as recherches, min(c.quand)::text as debut
       from consommation_claude c left join inscription i on i.id::text = c.inscription_id
            left join restaurant r on r.id = coalesce(c.restaurant_id, i.restaurant_id)
      where c.quand > now() - make_interval(days => $1)
      group by 1, 2, 3, 4`, [jours]);
  const avecCout = lignes.map((l) => ({ ...l, cout: coutClaude(l.modele, l) }));
  // Défauts relevés au premier passage des accords (par plat), additionnés par restaurant : ce qui déclenche les corrections.
  const defauts = await requete<{ restaurant: string; sorte: string; n: number }>(
    `select g.restaurant_id as restaurant, e.k as sorte, sum(e.v::int)::int as n
       from generation_accords g cross join lateral jsonb_each_text(g.defauts) as e(k, v)
      where g.defauts is not null and g.fin_le > now() - make_interval(days => $1) group by 1, 2`, [jours]);
  const total = avecCout.reduce((n, l) => n + l.cout, 0);
  // Par restaurant, puis par étape.
  const restos = [...new Map(avecCout.map((l) => [l.restaurant ?? '', l.restaurant ? (l.nom ?? `${l.restaurant} (supprimé)`) : 'Hors restaurant (distributeurs, publications, inscriptions en cours…)'])).entries()]
    .map(([id, nom]) => {
      const siennes = avecCout.filter((l) => (l.restaurant ?? '') === id);
      const postes = [...new Set(siennes.map((l) => l.poste))].map((poste) => {
        const p = siennes.filter((l) => l.poste === poste);
        return { poste, modeles: [...new Set(p.map((l) => l.modele.replace(/^claude-/, '')))].join(', '), appels: p.reduce((n, l) => n + l.appels, 0),
          entree: p.reduce((n, l) => n + l.entree + l.cache_lu + l.cache_ecrit, 0), sortie: p.reduce((n, l) => n + l.sortie, 0),
          recherches: p.reduce((n, l) => n + l.recherches, 0), cout: p.reduce((n, l) => n + l.cout, 0) };
      }).sort((a, b) => b.cout - a.cout);
      return { id, nom, postes, cout: postes.reduce((n, p) => n + p.cout, 0) };
    }).sort((a, b) => b.cout - a.cout);
  return (
    <>
      <Entete titre="Consommation Claude" texte="Coût estimé de l’API Claude, par restaurant et par étape, d’après les jetons de chaque appel et les tarifs publics (en dollars, hors TVA). Le montant exact reste celui de la console Anthropic." />
      <nav className="onglets" aria-label="Période">
        {PERIODES.map(([k, l]) => <Link key={k} href={`?jours=${k}`} aria-current={Number(k) === jours ? 'true' : undefined}>{l}</Link>)}
      </nav>
      <section className="stats"><div className="stat"><span className="chiffre">{dollars(total)}</span><span>estimés sur la période</span></div></section>
      {!restos.length && <p className="discret">Aucun appel à Claude noté sur cette période (le suivi a commencé avec cette version du site).</p>}
      {restos.map((r) => (
        <section key={r.id} className="carte-bo pile" style={{ gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <h2 style={{ margin: 0 }}>{r.nom}</h2><b>{dollars(r.cout)}</b>
          </div>
          {(() => {
            const siens = defauts.filter((x) => x.restaurant === r.id);
            const vins = siens.find((x) => x.sorte === 'vins')?.n ?? 0;
            const autres = siens.filter((x) => x.sorte !== 'vins').sort((a, b) => b.n - a.n);
            return vins ? (
              <p className="petit" style={{ margin: 0 }}>Défauts au premier passage des accords, sur {vins.toLocaleString('fr-BE')} commentaires demandés :{' '}
                {autres.length ? autres.map((x) => `${x.sorte} ${x.n} (${Math.round((100 * x.n) / vins)} %)`).join(' · ') : 'aucun'}</p>) : null;
          })()}
          <div className="tableau"><table>
            <thead><tr><th>Étape</th><th>Modèle</th><th className="droite">Appels</th><th className="droite">Lu</th><th className="droite">Écrit</th><th className="droite">Recherches web</th><th className="droite">Coût</th></tr></thead>
            <tbody>{r.postes.map((p) => (
              <tr key={p.poste}><td>{p.poste}</td><td className="petit discret">{p.modeles}</td><td className="droite">{p.appels}</td>
                <td className="droite">{jetons(p.entree)}</td><td className="droite">{jetons(p.sortie)}</td><td className="droite">{p.recherches || '—'}</td><td className="droite"><b>{dollars(p.cout)}</b></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      ))}
      <p className="petit discret" style={{ margin: 0 }}>« Lu » : texte envoyé à Claude (consignes, carte, photos), dont la partie relue en cache au dixième du prix. « Écrit » : texte rédigé par Claude, réflexion comprise, la partie la plus chère.</p>
    </>
  );
}
