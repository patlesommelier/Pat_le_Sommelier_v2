// Les chiffres clés du restaurant, réunis sur sa page d'accueil : sa carte des vins (vins, au verre, coups de cœur,
// étiquettes à ajouter) et sa cave (stock bas, bouteilles en stock et en commande, valeur du stock, commandes en cours).
import Link from 'next/link';
import { euros } from '@/lib/bon-commande';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getPrixAchat, stockBas } from '@/lib/admin/stocks';
import { regrouperVins } from '@/app/admin/[resto]/carte/etats';

export async function ChiffresCarte({ resto }: { resto: string }) {
  const vins = await getVinsBO(resto);
  const groupes = regrouperVins(vins);
  const sansEtiquette = vins.filter((v) => !v.etiquette_url).length;
  return (
    <section className="pile" style={{ gap: 12 }} aria-labelledby="chiffres-carte">
      <div className="ligne-actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 id="chiffres-carte" style={{ margin: 0 }}>Carte des vins</h2>
        <Link href={`/admin/${resto}/carte`} className="btn fantome petit">Gérer la carte des vins →</Link>
      </div>
      <div className="stats">
        <div className="stat"><span className="chiffre">{groupes.length}</span><span>vins sur la carte</span></div>
        <div className="stat"><span className="chiffre">{groupes.filter((g) => g.contenances.some((x) => /verre/i.test(x)) || g.tous.some((x) => x.prix_verre != null)).length}</span><span>servis au verre</span></div>
        <div className="stat"><span className="chiffre">{groupes.filter((g) => g.tous.some((x) => x.coup_de_coeur)).length}</span><span>coups de cœur</span></div>
        <div className="stat"><span className="chiffre" style={{ color: sansEtiquette ? 'var(--fuchsia)' : undefined }}>{sansEtiquette}</span><span>{sansEtiquette ? 'étiquettes à ajouter : Pat les cherche, vous pouvez envoyer vos photos' : 'étiquette à ajouter'}</span></div>
      </div>
    </section>
  );
}

export async function ChiffresCave({ resto }: { resto: string }) {
  const [tous, r, ouvertes, achats] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), getCommandes(resto, ['ouverte']), getPrixAchat(resto)]);
  const limite = r?.stock_limite_basse ?? 2;
  // Comme dans Ma cave : sans les vins du frigo connecté (leur stock suit le frigo).
  const groupes = regrouperVins(tous.filter((v) => !v.frigo)).map((g) => ({ ...g, disponible: g.tous.some((x) => x.disponible) }));
  const bas = groupes.filter((g) => g.disponible && stockBas(g.principal.stock, limite));
  const enCommande = groupes.reduce((n, g) => n + g.principal.en_commande, 0);
  const valeur = groupes.reduce((n, g) => n + (achats.get(g.principal.id) ?? 0) * g.principal.stock, 0);
  const sansPrix = groupes.filter((g) => !achats.has(g.principal.id)).length;
  return (
    <section className="pile" style={{ gap: 12 }} aria-labelledby="chiffres-cave">
      <div className="ligne-actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 id="chiffres-cave" style={{ margin: 0 }}>Ma cave</h2>
        <Link href={`/admin/${resto}/stocks`} className="btn fantome petit">Voir Ma cave →</Link>
      </div>
      <div className="stats">
        <Link href={`/admin/${resto}/stocks?filtre=bas`} className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="chiffre" style={{ color: bas.length ? 'var(--rouge)' : undefined }}>{bas.length}</span><span>{bas.length > 1 ? 'vins en stock bas' : 'vin en stock bas'}</span></Link>
        <div className="stat"><span className="chiffre">{groupes.reduce((n, g) => n + g.principal.stock, 0).toLocaleString('fr-BE')}</span><span>bouteilles en stock</span></div>
        <div className="stat"><span className="chiffre">{enCommande}</span><span>bouteilles en commande</span></div>
        <div className="stat"><span className="chiffre">{euros(valeur)}</span><span>valeur du stock HTVA{sansPrix ? ` (${sansPrix} vin${sansPrix > 1 ? 's' : ''} sans prix d’achat)` : ''}</span></div>
        <Link href={`/admin/${resto}/commandes`} className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="chiffre">{ouvertes.length}</span><span>{ouvertes.length > 1 ? 'commandes en cours' : 'commande en cours'}</span></Link>
      </div>
    </section>
  );
}
