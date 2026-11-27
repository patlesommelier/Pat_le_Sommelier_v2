// Page d'accueil du restaurant : ses raccourcis, ses chiffres clés (carte des vins et cave) en petites tuiles,
// et ses dernières nouvelles (commandes, inventaire, accords).
import Link from 'next/link';
import { Icone } from './Icone';
import { euros } from '@/lib/bon-commande';
import { requete } from '@/lib/db';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getPrixAchat, stockBas } from '@/lib/admin/stocks';
import { regrouperVins } from '@/app/admin/[resto]/carte/etats';

type Tuile = { icone: string; n: string; libelle: string; lien: string; alerte?: boolean };

/** Les grandes actions du jour, en cartes avec une icône. */
export function Raccourcis({ resto, cave }: { resto: string; cave: boolean }) {
  const base = `/admin/${resto}`;
  const liste = [
    { icone: 'plus', titre: 'Ajouter un plat', texte: 'Au menu, accordé par Pat', lien: `${base}/menu/nouveau` },
    { icone: 'bottle', titre: 'Ajouter un vin', texte: 'Sur votre carte des vins', lien: `${base}/trouver-vin` },
    cave ? { icone: 'check', titre: 'Faire l’inventaire', texte: 'Compter vos bouteilles', lien: `${base}/inventaire` }
      : { icone: 'phone', titre: 'Voir l’app client', texte: 'Comme vos clients la voient', lien: `${base}/simulateur` },
    { icone: 'imprimante', titre: 'Imprimer la carte', texte: 'Carte des vins et menus', lien: `${base}/impression` },
  ];
  return (
    <nav className="rac-raccourcis" aria-label="Raccourcis">
      {liste.map((r) => (
        <Link key={r.lien} href={r.lien} className="rac-raccourci">
          <span className="rac-raccourci-icone"><Icone nom={r.icone} /></span>
          <span><b>{r.titre}</b><span>{r.texte}</span></span>
        </Link>
      ))}
    </nav>
  );
}

/** Les chiffres de la carte et de la cave, en une grille de petites tuiles ; celles qui demandent une action ressortent. */
export async function Chiffres({ resto, cave }: { resto: string; cave: boolean }) {
  const base = `/admin/${resto}`;
  const [vins, r, ouvertes, achats] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), cave ? getCommandes(resto, ['ouverte']) : [], cave ? getPrixAchat(resto) : new Map<string, number>()]);
  const carte = regrouperVins(vins);
  const sansEtiquette = vins.filter((v) => !v.etiquette_url).length;
  const tuiles: Tuile[] = [
    { icone: 'bottle', n: String(carte.length), libelle: 'vins sur la carte', lien: `${base}/carte` },
    { icone: 'bottle', n: String(carte.filter((g) => g.contenances.some((x) => /verre/i.test(x)) || g.tous.some((x) => x.prix_verre != null)).length), libelle: 'servis au verre', lien: `${base}/carte` },
    { icone: 'coeur', n: String(carte.filter((g) => g.tous.some((x) => x.coup_de_coeur)).length), libelle: 'coups de cœur', lien: `${base}/carte` },
    { icone: 'camera', n: String(sansEtiquette), libelle: sansEtiquette > 1 ? 'étiquettes à ajouter' : 'étiquette à ajouter', lien: `${base}/carte`, alerte: sansEtiquette > 0 },
  ];
  if (cave) {
    // Comme dans Ma cave : sans les vins du frigo connecté (leur stock suit le frigo).
    const groupes = regrouperVins(vins.filter((v) => !v.frigo)).map((g) => ({ ...g, disponible: g.tous.some((x) => x.disponible) }));
    const bas = groupes.filter((g) => g.disponible && stockBas(g.principal.stock, r?.stock_limite_basse ?? 2)).length;
    const valeur = groupes.reduce((n, g) => n + (achats.get(g.principal.id) ?? 0) * g.principal.stock, 0);
    tuiles.push(
      { icone: 'stock', n: String(bas), libelle: bas > 1 ? 'vins en stock bas' : 'vin en stock bas', lien: `${base}/stocks?filtre=bas`, alerte: bas > 0 },
      { icone: 'stock', n: groupes.reduce((n, g) => n + g.principal.stock, 0).toLocaleString('fr-BE'), libelle: 'bouteilles en stock', lien: `${base}/stocks` },
      { icone: 'camion', n: String(ouvertes.length), libelle: ouvertes.length > 1 ? 'commandes en cours' : 'commande en cours', lien: `${base}/commandes` },
      { icone: 'euro', n: euros(valeur), libelle: 'valeur du stock HTVA', lien: `${base}/stocks` },
    );
  }
  return (
    <section className="pile" style={{ gap: 12 }} aria-labelledby="chiffres">
      <h2 id="chiffres" className="rac-titre">Vos chiffres</h2>
      <div className="rac-tuiles">
        {tuiles.map((t) => (
          <Link key={t.libelle} href={t.lien} className={`rac-tuile${t.alerte ? ' alerte' : ''}`}>
            <span className="rac-tuile-icone"><Icone nom={t.icone} /></span>
            <span><b>{t.n}</b><span>{t.libelle}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const QUAND = (d: string) => {
  const j = Math.floor((Date.now() - Date.parse(d)) / 864e5);
  return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : j < 30 ? `il y a ${j} jours` : new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
};

/** Les trois derniers événements du restaurant : commandes (envoyée, livrée), inventaire, accords préparés par Pat. */
export async function Nouvelles({ resto, cave }: { resto: string; cave: boolean }) {
  const base = `/admin/${resto}`;
  const [commandes, [r], [a]] = await Promise.all([
    cave ? requete<{ id: string; fournisseur_nom: string; statut: string; envoyee_le: string | null; recue_le: string | null; statut_qv: string | null; statut_qv_le: string | null }>(
      `select id, fournisseur_nom, statut, envoyee_le::text, recue_le::text, statut_qv, statut_qv_le::text from commande
        where restaurant_id = $1 and statut <> 'annulee' and coalesce(recue_le, statut_qv_le, envoyee_le) is not null
        order by coalesce(recue_le, statut_qv_le, envoyee_le) desc limit 3`, [resto]) : [],
    requete<{ inventaire_le: string | null }>('select inventaire_le::text from restaurant where id = $1', [resto]),
    requete<{ le: string | null; n: number }>('select max(calcule_le)::text as le, count(*)::int as n from accord where restaurant_id = $1', [resto]).catch(() => [{ le: null, n: 0 }]),
  ]);
  const items: { icone: string; texte: string; le: string; lien: string }[] = [];
  for (const c of commandes) {
    const livree = c.recue_le || c.statut_qv === 'livree';
    const le = c.recue_le ?? c.statut_qv_le ?? c.envoyee_le!;
    items.push({ icone: 'camion', texte: livree ? `Commande ${c.fournisseur_nom} livrée` : `Commande ${c.fournisseur_nom} envoyée`, le, lien: `${base}/commandes/${c.id}` });
  }
  if (cave && r?.inventaire_le) items.push({ icone: 'check', texte: 'Inventaire enregistré', le: r.inventaire_le, lien: `${base}/inventaire` });
  if (a?.le) items.push({ icone: 'coeur', texte: `Pat a préparé vos accords mets-vins (${a.n.toLocaleString('fr-BE')})`, le: a.le, lien: `${base}/accords` });
  const derniers = items.sort((x, y) => Date.parse(y.le) - Date.parse(x.le)).slice(0, 3);
  if (!derniers.length) return null;
  return (
    <section className="pile" style={{ gap: 12 }} aria-labelledby="nouvelles">
      <h2 id="nouvelles" className="rac-titre">Dernières nouvelles</h2>
      <ul className="rac-nouvelles">
        {derniers.map((n, i) => (
          <li key={i}><Link href={n.lien}>
            <span className="rac-tuile-icone"><Icone nom={n.icone} /></span>
            <span className="rac-nouvelle-texte">{n.texte}</span>
            <span className="discret petit">{QUAND(n.le)}</span>
          </Link></li>
        ))}
      </ul>
    </section>
  );
}
