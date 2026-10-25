import { exigerAcces } from '@/lib/admin/auth';
import { getPropositions } from '@/lib/donnees';
import { requete } from '@/lib/db';
import { titreCarte } from '@/lib/admin/intitule';
import { libelleCourt } from '@/lib/contenances';
import { tarifsDuRestaurant } from '@/lib/tarifs';
import { controleCouleur, couleurDesSupports, SCRIPT_COULEUR, type CouleurSupports } from '@/lib/couleur-logo';
import { genererPenseBeteHTML, type OptionsPenseBete, type SectionPenseBete } from '@/lib/pense-bete';

export const dynamic = 'force-dynamic';

const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const SECTIONS: [string, string][] = [['suggestion', 'Suggestions'], ['entree', 'Entrées'], ['plat', 'Plats'], ['dessert', 'Desserts'], ['fromage', 'Fromages']];

/**
 * Pense-bête des serveurs : /admin/<resto>/accords/pense-bete — une page, chaque plat proposé aux clients avec les trois vins
 * que Pat propose en premier dans l'app (mêmes règles du sommelier). Options : orientation=portrait, nb=1, prix=0.
 */
export async function GET(req: Request, { params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = new URL(req.url).searchParams;
  const [r] = await requete<{ nom: string; couleur: string; logo_url: string | null; logo_fonce_url: string | null; couleur_impression: string | null }>(
    'select nom, couleur, logo_url, logo_fonce_url, couleur_impression from restaurant where id = $1', [resto]);
  if (!r) return new Response('Restaurant introuvable', { status: 404 });
  const plats = await requete<{ id: string; nom: string; nom_court: string | null; categorie: string }>(
    `select id, nom, nom_court, categorie::text as categorie from plat where restaurant_id = $1 and actif order by ordre`, [resto]);
  const tarifs = await tarifsDuRestaurant(resto);
  const lignes = await Promise.all(plats.map(async (p) => {
    const vins = (await getPropositions(resto, p.id)).propositions.slice(0, 3).map(({ vin: v }) => {
      const t = titreCarte({ ...v, producteur: v.producteur_nom ?? v.producteur_texte }, { cepages: false });
      const prix = (tarifs.get(v.id) ?? []).filter((x) => x.code === 'verre' || x.code === 'bouteille')
        .map((x) => `${libelleCourt(x.code)} ${euros(x.prix)}`).join(' · ');
      return { titre: t.titre, detail: t.sousTitre ? t.sousTitre.split(' · ')[0] : null, prix: prix || null };
    });
    return { categorie: p.categorie, plat: p.nom_court ?? p.nom, vins };
  }));
  const sections: SectionPenseBete[] = SECTIONS.map(([c, titre]) => ({ titre, lignes: lignes.filter((l) => l.categorie === c && l.vins.length) }));
  const teinte = await couleurDesSupports(r, sp);
  const options: OptionsPenseBete = { paysage: sp.get('orientation') !== 'portrait', couleurAccent: teinte.couleur, noirEtBlanc: sp.get('nb') === '1', prix: sp.get('prix') !== '0' };
  const html = genererPenseBeteHTML({ restaurant: r.nom, sections, options, barre: barre(resto, options, teinte) });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Barre d'outils, à l'écran seulement. */
function barre(resto: string, o: OptionsPenseBete, teinte: CouleurSupports) {
  const coche = (nom: string, libelle: string, actif: boolean) =>
    `<label><input type="checkbox" name="${nom}" value="1" ${actif ? 'checked' : ''} onchange="envoyer(this.form)"> ${libelle}</label>`;
  return `<form class="barre-impression" method="get" style="position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:center;
    margin:-24px -12px 24px;padding:12px 16px;background:#24151A;color:#FFF;font:14px Lato,'Helvetica Neue',sans-serif">
  <a href="/admin/${resto}/accords" style="color:#FFF">← Back-office</a>
  <label>Page <select name="orientation" onchange="envoyer(this.form)"><option value="paysage" ${o.paysage ? 'selected' : ''}>A4 à l’italienne</option><option value="portrait" ${!o.paysage ? 'selected' : ''}>A4 en hauteur</option></select></label>
  ${controleCouleur(teinte)}
  ${coche('nb', 'Noir et blanc', o.noirEtBlanc)}
  ${coche('prix', 'Prix', o.prix)}
  <button type="button" onclick="window.print()" style="padding:8px 16px;border:0;border-radius:999px;background:#FFF;color:#24151A;font-weight:700;cursor:pointer">Imprimer / Enregistrer en PDF</button>
</form>
<script>
function envoyer(f) {
  var p = new URLSearchParams();
  p.set('orientation', f.elements.orientation.value);
  if (f.elements.nb.checked) p.set('nb', '1');
  if (!f.elements.prix.checked) p.set('prix', '0');
  ${SCRIPT_COULEUR}
  location.search = p.toString();
}
</script>`;
}
