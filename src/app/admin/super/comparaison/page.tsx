import Link from 'next/link';
import { lancerComparaison } from '../actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import type { ResultatComparaison } from '@/lib/generation/comparaison';
import { restaurantsListe } from '@/lib/super/donnees';

const MODELES = [['claude-sonnet-5-5', 'Sonnet 5.5'], ['claude-opus-5-5', 'Opus 5.5'], ['claude-haiku-4-5-20251001', 'Haiku 4.5']] as const;
const nomModele = (m: string) => MODELES.find(([id]) => id === m)?.[1] ?? m;
const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut' | 'attention']> = {
  en_attente: ['En attente', 'propose'], en_cours: ['En cours', 'propose'], fait: ['Terminée', 'ok'], erreur: ['Échec', 'attention'],
};

/**
 * Comparaison de deux modèles Claude sur les accords de quelques plats : notes et commentaires côte à côte.
 * Rien n'est enregistré dans les accords du restaurant (chaque génération est annulée).
 */
export default async function Comparaison({ searchParams }: { searchParams: Promise<{ resto?: string; id?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const restos = await restaurantsListe();
  const resto = sp.resto ?? restos.find((r) => r.id === 'chez-pat')?.id ?? restos[0]?.id;
  const [plats, historique] = await Promise.all([
    resto ? requete<{ id: string; nom: string }>(
      `select id, nom from plat p where restaurant_id = $1 and actif and exists (select 1 from accord a where a.plat_id = p.id) order by ordre`, [resto]) : [],
    requete<{ id: string; restaurant_id: string; plats: string[]; modeles: string[]; statut: string; cree_le: string }>(
      'select id, restaurant_id, plats, modeles, statut, cree_le::text from comparaison_modeles order by cree_le desc limit 8'),
  ]);
  const [choisie] = sp.id ? await requete<{ id: string; restaurant_id: string; modeles: string[]; statut: string; message: string | null; resultat: ResultatComparaison | null }>(
    'select id, restaurant_id, modeles, statut, message, resultat from comparaison_modeles where id = $1', [sp.id]) : [];

  return (
    <>
      <Entete titre="Comparer les modèles" texte="Pat génère les accords de quelques plats avec deux modèles, pour comparer leurs notes et leurs commentaires. Rien n’est enregistré : les accords du restaurant ne changent pas." />
      <Message erreur={sp.erreur} />

      <form method="get" className="carte-bo" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: '14px 18px' }}>
        <div className="champ"><label htmlFor="resto">Restaurant</label>
          <select id="resto" name="resto" defaultValue={resto}>{restos.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></div>
        <button className="btn sec petit">Choisir</button>
      </form>

      {resto && (
        <form action={lancerComparaison} className="carte-bo pile" style={{ gap: 14 }}>
          <input type="hidden" name="restaurant" value={resto} />
          <div className="pile" style={{ gap: 6 }}>
            <b>Plats à comparer (3 au plus)</b>
            {!plats.length && <span className="discret">Aucun plat avec des accords dans ce restaurant.</span>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
              {plats.map((p, i) => <label key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="plats" value={p.id} defaultChecked={i < 3} />{p.nom}</label>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="champ"><label htmlFor="modele_a">Modèle A</label>
              <select id="modele_a" name="modele_a" defaultValue="claude-sonnet-5-5">{MODELES.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}</select></div>
            <div className="champ"><label htmlFor="modele_b">Modèle B</label>
              <select id="modele_b" name="modele_b" defaultValue="claude-opus-5-5">{MODELES.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}</select></div>
            <button className="btn" disabled={!plats.length}>Lancer la comparaison</button>
          </div>
          <span className="petit discret">Chaque plat est généré une fois par modèle : la comparaison prend quelques minutes et coûte autant qu’une régénération de ces plats avec chaque modèle.</span>
        </form>
      )}

      {choisie && (
        <section className="pile" style={{ gap: 16 }}>
          <h2 style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{choisie.modeles.map(nomModele).join(' / ')} <Etat type={STATUT[choisie.statut]?.[1] ?? ''}>{STATUT[choisie.statut]?.[0] ?? choisie.statut}</Etat></h2>
          {(choisie.statut === 'en_attente' || choisie.statut === 'en_cours') && <><ActualisationAuto secondes={5} /><p className="discret">Pat génère les accords avec les deux modèles… la page se met à jour toute seule.</p></>}
          {choisie.statut === 'erreur' && <p className="message erreur">{choisie.message}</p>}
          {choisie.resultat && <Resultat r={choisie.resultat} modeles={choisie.modeles} />}
        </section>
      )}

      {historique.length > 0 && (
        <section className="pile" style={{ gap: 6 }}>
          <h2 style={{ fontSize: 18 }}>Comparaisons récentes</h2>
          {historique.map((h) => (
            <Link key={h.id} href={`/admin/super/comparaison?resto=${h.restaurant_id}&id=${h.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{new Date(h.cree_le).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })} · {h.restaurant_id} · {h.plats.length} plat(s) · {h.modeles.map(nomModele).join(' / ')}</span>
              <Etat type={STATUT[h.statut]?.[1] ?? ''}>{STATUT[h.statut]?.[0] ?? h.statut}</Etat>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

function Resultat({ r, modeles }: { r: ResultatComparaison; modeles: string[] }) {
  // Synthèse par modèle : volume consommé (jetons), note moyenne, et nombre de vins notés différemment.
  const toutes = (m: string) => r.plats.flatMap((p) => p.modeles[m]?.lignes ?? []);
  const differences = r.plats.reduce((n, p) => {
    const vins = new Set(modeles.flatMap((m) => p.modeles[m]?.lignes.map((l) => l.vin_id) ?? []));
    return n + [...vins].filter((v) => new Set(modeles.map((m) => p.modeles[m]?.lignes.find((l) => l.vin_id === v)?.note)).size > 1).length;
  }, 0);
  return (
    <div className="pile" style={{ gap: 18 }}>
      <div className="grille" style={{ gridTemplateColumns: `repeat(${modeles.length + 1}, minmax(0, 1fr))` }}>
        {modeles.map((m) => {
          const ls = toutes(m);
          const jE = r.plats.reduce((n, p) => n + (p.modeles[m]?.jetonsEntree ?? 0), 0), jS = r.plats.reduce((n, p) => n + (p.modeles[m]?.jetonsSortie ?? 0), 0);
          const duree = r.plats.reduce((n, p) => n + (p.modeles[m]?.duree ?? 0), 0);
          return (
            <div key={m} className="carte-bo" style={{ padding: '14px 18px' }}>
              <b>{nomModele(m)}</b>
              <div className="petit">Note moyenne {ls.length ? (ls.reduce((n, l) => n + l.note, 0) / ls.length).toFixed(2).replace('.', ',') : '—'} · {ls.filter((l) => l.note >= 5).length} note(s) de 5 · {ls.filter((l) => l.note <= 2).length} note(s) ≤ 2</div>
              <div className="petit discret">{duree} s · {jE.toLocaleString('fr-BE')} jetons lus · {jS.toLocaleString('fr-BE')} écrits</div>
            </div>
          );
        })}
        <div className="carte-bo" style={{ padding: '14px 18px' }}><b>{differences}</b><div className="petit">vin(s) notés différemment</div></div>
      </div>
      {r.plats.map((p) => {
        const vins = [...new Set(modeles.flatMap((m) => p.modeles[m]?.lignes.map((l) => l.vin_id) ?? []))];
        const ligne = (m: string, v: string) => p.modeles[m]?.lignes.find((l) => l.vin_id === v);
        return (
          <div key={p.id} className="pile" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 18 }}>{p.nom}</h3>
            {modeles.map((m) => p.modeles[m]?.erreur && <p key={m} className="message erreur" style={{ margin: 0 }}>{nomModele(m)} : {p.modeles[m].erreur}</p>)}
            <div className="tableau"><table style={{ minWidth: 900 }}>
              <thead><tr><th>Vin</th>{modeles.map((m) => <th key={m} style={{ minWidth: 300 }}>{nomModele(m)}</th>)}</tr></thead>
              <tbody>{vins.map((v) => {
                const ls = modeles.map((m) => ligne(m, v));
                const diff = new Set(ls.map((l) => l?.note)).size > 1;
                return (
                  <tr key={v} style={diff ? { background: '#FFF4D6' } : undefined}>
                    <td><b>{ls.find(Boolean)?.libelle}</b></td>
                    {ls.map((l, i) => <td key={i} className="petit" style={{ lineHeight: 1.45 }}>{l ? <><b style={{ fontSize: 15 }}>{l.note}/5</b> · {l.commentaire}</> : '—'}</td>)}
                  </tr>
                );
              })}</tbody>
            </table></div>
          </div>
        );
      })}
      <span className="petit discret">Lignes en jaune : le vin n’a pas la même note avec les deux modèles. Les accords du restaurant n’ont pas été modifiés.</span>
    </div>
  );
}
