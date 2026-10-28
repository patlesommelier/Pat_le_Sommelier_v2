// Export des stocks au format Excel (.xlsx) : chaque vin de la carte, son fournisseur, ses prix, son stock.
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getFournisseurs, getPrixAchat, stockBas } from '@/lib/admin/stocks';
import { genererXlsx, type Cellule } from '@/lib/xlsx-simple';
import { nomPourListe, regrouperVins } from '../../carte/etats';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;

export async function GET(_: Request, { params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const [vins, r, fournisseurs, achats] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), getFournisseurs(resto), getPrixAchat(resto)]);
  if (!r) return new Response('Restaurant introuvable', { status: 404 });
  const nomFournisseur = new Map(fournisseurs.map((f) => [f.id, f.nom]));
  const groupes = regrouperVins(vins);
  const lignes: Cellule[][] = COULEURS.flatMap(([k, couleur]) => groupes.filter((g) => g.principal.couleur === k).map(({ principal: v, tous }) => {
    const nom = nomPourListe(v);
    const achat = achats.get(v.id) ?? null;
    const disponible = tous.some((x) => x.disponible);
    return [
      couleur, nom[0], nom.slice(1).join(' · ') || null, v.millesime, v.fournisseur_id ? nomFournisseur.get(v.fournisseur_id) ?? null : null,
      { euros: achat }, { euros: v.prix ?? null }, v.stock, v.en_commande, { euros: achat != null ? Math.round(achat * v.stock * 100) / 100 : null },
      !disponible ? 'Indisponible' : stockBas(v.stock, r.stock_limite_basse) ? 'Stock bas' : null,
    ];
  }));
  const xlsx = genererXlsx('Stocks', [
    { titre: 'Couleur', largeur: 11 }, { titre: 'Vin', largeur: 34 }, { titre: 'Producteur · appellation', largeur: 38 }, { titre: 'Millésime', largeur: 10 },
    { titre: 'Fournisseur', largeur: 22 }, { titre: 'Prix d’achat HTVA', largeur: 16 }, { titre: 'Prix de vente', largeur: 14 },
    { titre: 'En stock', largeur: 10 }, { titre: 'En commande', largeur: 12 }, { titre: 'Valeur du stock HTVA', largeur: 18 }, { titre: 'Alerte', largeur: 13 },
  ], lignes);
  const date = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Brussels' }); // 2026-10-28
  const nom = `stocks-${r.nom.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${date}.xlsx`;
  return new Response(Buffer.from(xlsx), {
    headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${nom}"`, 'cache-control': 'no-store' },
  });
}
