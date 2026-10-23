import { exigerAcces } from '@/lib/admin/auth';
import { getPropositions } from '@/lib/donnees';
import { requete } from '@/lib/db';
import { titreCarte } from '@/lib/admin/intitule';
import { libelleCourt } from '@/lib/contenances';
import { tarifsDuRestaurant } from '@/lib/tarifs';
import { genererMenuHTML, type OptionsMenu, type SectionMenu } from '@/lib/menu-imprimable';

export const dynamic = 'force-dynamic';

const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const SECTIONS: [string, string][] = [['entree', 'Entrées'], ['plat', 'Plats'], ['dessert', 'Desserts'], ['fromage', 'Fromages']];

/**
 * Menu imprimable du restaurant : /admin/<resto>/menu/imprimer (le menu) ou ?type=suggestions (les suggestions du moment, à part).
 * Pour chaque plat, le vin que Pat propose en premier dans l'app (mêmes règles de sélection) ; jamais de note ni de ranking.
 * Options : format=A5, nb=1 (noir et blanc), prix=0 (sans prix du vin), rappel=0.
 */
export async function GET(req: Request, { params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = new URL(req.url).searchParams;
  const suggestions = sp.get('type') === 'suggestions';
  const [r] = await requete<{ nom: string; couleur: string }>('select nom, couleur from restaurant where id = $1', [resto]);
  if (!r) return new Response('Restaurant introuvable', { status: 404 });

  const plats = await requete<{ id: string; nom: string; categorie: string; prix: number | null; prix_variantes: string | null }>(
    `select id, nom, categorie::text as categorie, prix::float as prix, prix_variantes from plat
      where restaurant_id = $1 and actif and ${suggestions ? "categorie = 'suggestion'" : "categorie <> 'suggestion'"} order by ordre`, [resto]);
  const tarifs = await tarifsDuRestaurant(resto);
  const avecVin = await Promise.all(plats.map(async (p) => {
    const premier = (await getPropositions(resto, p.id)).propositions[0];
    const v = premier?.vin;
    const t = v ? titreCarte({ ...v, producteur: v.producteur_nom ?? v.producteur_texte }, { cepages: false }) : null;
    const prix = v ? (tarifs.get(v.id) ?? []).filter((x) => x.code === 'verre' || x.code === 'bouteille')
      .map((x) => `${libelleCourt(x.code)} ${euros(x.prix)}`).join(' · ') : '';
    return { ...p, vin: v && t ? { titre: t.titre, detail: t.sousTitre || null, prix: prix || null } : null };
  }));
  const sections: SectionMenu[] = suggestions
    ? [{ titre: 'Suggestions du moment', plats: avecVin.map((p) => ({ nom: p.nom, prix: p.prix_variantes ?? (p.prix != null ? euros(p.prix) : null), vin: p.vin })) }]
    : SECTIONS.map(([c, titre]) => ({ titre, plats: avecVin.filter((p) => p.categorie === c)
      .map((p) => ({ nom: p.nom, prix: p.prix_variantes ?? (p.prix != null ? euros(p.prix) : null), vin: p.vin })) }));

  const options: OptionsMenu = {
    titre: suggestions ? 'Suggestions du moment' : 'Menu',
    format: sp.get('format') === 'A5' ? 'A5' : 'A4',
    couleurAccent: r.couleur,
    noirEtBlanc: sp.get('nb') === '1',
    prixVin: sp.get('prix') !== '0',
    rappelPat: sp.get('rappel') !== '0',
  };
  const html = genererMenuHTML({ restaurant: r.nom, sections, options, barre: barreOutils(resto, suggestions, options) });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Barre d'outils, à l'écran seulement : options (rechargent la page), passage menu / suggestions, bouton Imprimer. */
function barreOutils(resto: string, suggestions: boolean, o: OptionsMenu) {
  const coche = (nom: string, libelle: string, actif: boolean) =>
    `<label><input type="checkbox" name="${nom}" value="1" ${actif ? 'checked' : ''} onchange="envoyer(this.form)"> ${libelle}</label>`;
  return `<form class="barre-impression" method="get" style="position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:center;
    margin:-24px -12px 24px;padding:12px 16px;background:#24151A;color:#FFF;font:14px Lato,'Helvetica Neue',sans-serif">
  <a href="/admin/${resto}/menu" style="color:#FFF">← Back-office</a>
  <label>Imprimer <select name="type" onchange="envoyer(this.form)"><option value="menu" ${!suggestions ? 'selected' : ''}>le menu</option><option value="suggestions" ${suggestions ? 'selected' : ''}>les suggestions</option></select></label>
  <label>Format <select name="format" onchange="envoyer(this.form)"><option ${o.format === 'A4' ? 'selected' : ''}>A4</option><option ${o.format === 'A5' ? 'selected' : ''}>A5</option></select></label>
  ${coche('nb', 'Noir et blanc', o.noirEtBlanc)}
  ${coche('prix', 'Prix du vin', o.prixVin)}
  ${coche('rappel', 'Rappel « Demandez à Pat »', o.rappelPat)}
  <button type="button" onclick="window.print()" style="padding:8px 16px;border:0;border-radius:999px;background:#FFF;color:#24151A;font-weight:700;cursor:pointer">Imprimer / Enregistrer en PDF</button>
  <span style="flex-basis:100%;text-align:center;font-size:12.5px;opacity:.85">Le vin de chaque plat est celui que Pat propose en premier dans l’app. Dans la fenêtre d’impression, activez « Graphiques d’arrière-plan » pour garder les couleurs.</span>
</form>
<script>
// Cases décochées : envoyer 0 (une case cochée par défaut doit pouvoir être retirée).
function envoyer(f) {
  var p = new URLSearchParams();
  ['type', 'format'].forEach(function (n) { p.set(n, f.elements[n].value); });
  ['nb'].forEach(function (n) { if (f.elements[n].checked) p.set(n, '1'); });
  ['prix', 'rappel'].forEach(function (n) { if (!f.elements[n].checked) p.set(n, '0'); });
  location.search = p.toString();
}
</script>`;
}
