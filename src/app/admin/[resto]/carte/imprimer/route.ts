import { exigerAcces } from '@/lib/admin/auth';
import { adresseApp, qrSvg } from '@/lib/admin/qr';
import { genererCarteHTML, type CouleurCarte, type OptionsCarte, type VinImprimable } from '@/lib/carte-imprimable';
import { requete } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Les sections qui répètent la couleur (« Vin doux ») ne sont pas des régions. */
const regionDe = (section: string | null) => (section && !/^(vins? doux|bulles|ros[eé]s?|vins? orange)$/i.test(section.trim()) ? section : null);
/** En attendant la présentation de Pat (npm run presentations) : le résumé court du vin. */
const resume = (r: string | null) => (r ? r.replace(/\s*;\s*/g, ' ; ').trim().replace(/([^.!?])$/, '$1.') : null);

/**
 * Carte des vins imprimable du restaurant : /admin/<resto>/carte/imprimer
 * Options dans l'adresse : format=A5, nb=1 (noir et blanc), ordre=prix, presentation=0, producteur=0, couverture=0, rappel=0.
 * Seuls les champs publics des vins sont lus : jamais de ranking, de note ni de score.
 */
export async function GET(req: Request, { params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = new URL(req.url).searchParams;
  const [r] = await requete<{ nom: string; couleur: string; logo_url: string | null; logo_fonce_url: string | null }>(
    'select nom, couleur, logo_url, logo_fonce_url from restaurant where id = $1', [resto]);
  if (!r) return new Response('Restaurant introuvable', { status: 404 });

  const lignes = await requete<{ id: string; libelle: string; producteur: string | null; millesime: string | null; format: string; couleur: CouleurCarte;
    section: string | null; prix: number | null; prix_verre: number | null; presentation_carte: string | null; presentation_carte_perso: string | null; resume_court: string | null; disponible: boolean }>(
    `select v.id, v.libelle,
            case when v.modifie_bo is not null and v.producteur_texte is not null then v.producteur_texte else coalesce(p.nom, v.producteur_texte) end as producteur,
            v.millesime, v.format, v.couleur::text as couleur, v.section, v.prix::float as prix, v.prix_verre::float as prix_verre,
            v.presentation_carte, v.presentation_carte_perso, v.resume_court, v.disponible
       from vin_carte v left join producteur p on p.id = v.producteur_id
      where v.restaurant_id = $1 order by v.ordre`, [resto]);
  const vins: VinImprimable[] = lignes.map((v) => ({
    id: v.id, nom: v.libelle, producteur: v.producteur,
    millesime: v.millesime && v.millesime !== 'NM' ? v.millesime.replace('/', '-') : null,
    contenance: v.format && !['75 cl', 'au verre'].includes(v.format) ? v.format : null,
    couleur: v.couleur, region: regionDe(v.section), prix: v.prix, prixVerre: v.prix_verre,
    presentation: v.presentation_carte ?? resume(v.resume_court), presentationPerso: v.presentation_carte_perso, visible: v.disponible,
  }));

  const options: Partial<OptionsCarte> = {
    format: sp.get('format') === 'A5' ? 'A5' : 'A4',
    couleurAccent: r.couleur,
    noirEtBlanc: sp.get('nb') === '1',
    ordre: sp.get('ordre') === 'prix' ? 'prix' : 'app',
    afficherPresentation: sp.get('presentation') !== '0',
    afficherProducteur: sp.get('producteur') !== '0',
    couverture: sp.get('couverture') !== '0',
    rappelPat: sp.get('rappel') !== '0',
  };
  const qr = `data:image/svg+xml;base64,${Buffer.from(await qrSvg(await adresseApp(resto), options.noirEtBlanc ? '#1F1A1C' : '#24151A')).toString('base64')}`;
  const sansPresentation = vins.filter((v) => v.visible && !v.presentationPerso && !lignes.find((l) => l.id === v.id)?.presentation_carte).length;

  const html = genererCarteHTML({
    restaurant: { nom: r.nom, logoUrl: r.logo_url, logoSombreUrl: r.logo_fonce_url, qrCodeUrl: qr, patLogoUrl: new URL('/pat/pat.png', req.url).href },
    vins, options, barre: barreOutils(resto, options, sansPresentation),
  });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Barre d'outils, à l'écran seulement : options (rechargent la page) et bouton du menu d'impression du navigateur. */
function barreOutils(resto: string, o: Partial<OptionsCarte>, sansPresentation: number) {
  const coche = (nom: string, libelle: string, actif: boolean | undefined) =>
    `<label><input type="checkbox" name="${nom}" value="1" ${actif ? 'checked' : ''} onchange="envoyer(this.form)"> ${libelle}</label>`;
  return `<form class="barre-impression" method="get" style="position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:center;
    margin:-24px 0 24px;padding:12px 16px;background:#24151A;color:#FFF;font:14px Lato,'Helvetica Neue',sans-serif">
  <a href="/admin/${resto}/carte" style="color:#FFF">← Back-office</a>
  <label>Format <select name="format" onchange="envoyer(this.form)"><option ${o.format === 'A4' ? 'selected' : ''}>A4</option><option ${o.format === 'A5' ? 'selected' : ''}>A5</option></select></label>
  <label>Ordre <select name="ordre" onchange="envoyer(this.form)"><option value="app" ${o.ordre !== 'prix' ? 'selected' : ''}>par région</option><option value="prix" ${o.ordre === 'prix' ? 'selected' : ''}>par prix</option></select></label>
  ${coche('nb', 'Noir et blanc', o.noirEtBlanc)}
  ${coche('presentation', 'Présentations', o.afficherPresentation)}
  ${coche('producteur', 'Producteurs', o.afficherProducteur)}
  ${coche('couverture', 'Couverture', o.couverture)}
  ${coche('rappel', 'Rappel « Demandez à Pat »', o.rappelPat)}
  <button type="button" onclick="window.print()" style="padding:8px 16px;border:0;border-radius:999px;background:#FFF;color:#24151A;font-weight:700;cursor:pointer">Imprimer / Enregistrer en PDF</button>
  ${sansPresentation ? `<span style="flex-basis:100%;text-align:center;font-size:12.5px;opacity:.85">${sansPresentation} vin${sansPresentation > 1 ? 's' : ''} sans présentation de Pat : le résumé court est utilisé.</span>` : ''}
  <span style="flex-basis:100%;text-align:center;font-size:12.5px;opacity:.85">Dans la fenêtre d’impression, activez « Graphiques d’arrière-plan » pour garder les couleurs.</span>
</form>
<script>
// Cases décochées : envoyer 0 (une case cochée par défaut doit pouvoir être retirée).
function envoyer(f) {
  var p = new URLSearchParams();
  ['format', 'ordre'].forEach(function (n) { p.set(n, f.elements[n].value); });
  ['nb', 'presentation', 'producteur', 'couverture', 'rappel'].forEach(function (n) { p.set(n, f.elements[n].checked ? '1' : '0'); });
  location.search = p.toString();
}
</script>`;
}
