/**
 * Ce que Pat sait au moment de répondre : ses principes, la carte du restaurant, le menu et les règles du sommelier.
 * Fonctions pures, partagées par l'API de l'app (barre « Demandez à Pat ») et par le script de calcul des accords.
 */

export interface PrincipeCtx { id: string; numero: number; titre: string; regle: string; role: string | null; statut: string }
export interface RegleCtx { type: string; portee: string; cible: string | null; valeur: string | null; texte: string }
export interface VinCtx {
  id: string; couleur: string; libelle: string; producteur: string | null; millesime: string | null; format: string;
  prix: number | null; prix_verre: number | null; cepages: string | null;
  profil: { douceur: number | null; acidite: number | null; corps: number | null; intensite: number | null; tanins: number | null; boise: number | null; aromes?: string[]; stade?: string | null } | null;
  ranking_producteur: number | null; avis_pat: string | null; coup_de_coeur: boolean;
}
export interface PlatCtx {
  id: string; nom: string; categorie: string;
  ancrages: string[]; profil: string | null; couleurs_ok: string[]; cepages_conseilles: string[];
  a_eviter: string | null; temperature_service: string | null; principes: string[]; plafond: number | null;
}

const euros = (n: number | null) => (n === null ? '—' : `${n.toFixed(2).replace('.', ',')} €`);

export function textePrincipes(principes: PrincipeCtx[]): string {
  return principes
    .sort((a, b) => a.numero - b.numero)
    .map((p) => `n°${p.numero} [${p.id}]${p.role ? ` (${p.role})` : ''}${p.statut === 'propose' ? ' (à valider par Pat)' : ''} — ${p.titre} : ${p.regle}`)
    .join('\n');
}

export function texteCarte(vins: VinCtx[]): string {
  return vins
    .map((v) => {
      const p = v.profil;
      const profil = p
        ? `douceur ${p.douceur ?? '?'}/5, acidité ${p.acidite ?? '?'}/5, corps ${p.corps ?? '?'}/5, intensité ${p.intensite ?? '?'}/5, tanins ${p.tanins ?? '?'}/5, boisé ${p.boise ?? '?'}/5${p.stade ? `, ${p.stade}` : ''}${p.aromes?.length ? ` ; arômes : ${p.aromes.join(', ')}` : ''}`
        : 'profil non renseigné';
      return [
        `${v.id} | ${v.couleur} | ${v.libelle}${v.producteur ? ` — ${v.producteur}` : ''} | ${v.millesime ?? 'NM'} | ${v.format}`,
        `bouteille ${euros(v.prix)}${v.prix_verre ? `, verre ${euros(v.prix_verre)}` : ''}`,
        v.cepages ?? 'cépages ?',
        profil,
        v.ranking_producteur ? `producteur classé ${v.ranking_producteur}/5 par Pat` : null,
        v.avis_pat ? `avis de Pat : ${v.avis_pat}` : null,
        v.coup_de_coeur ? 'coup de cœur de la carte' : null,
      ].filter(Boolean).join(' | ');
    })
    .join('\n');
}

export function textePlat(p: PlatCtx): string {
  return [
    `Plat : ${p.nom} (${p.categorie})`,
    `Points d'ancrage : ${p.ancrages.join(', ') || '—'}`,
    `Profil de vin recherché : ${p.profil ?? '—'}`,
    `Couleurs possibles : ${p.couleurs_ok.join(', ') || 'toutes'}`,
    `Cépages conseillés : ${p.cepages_conseilles.join(', ') || '—'}`,
    `À éviter : ${p.a_eviter ?? '—'}`,
    `Service : ${p.temperature_service ?? '—'}`,
    `Principes retenus : ${p.principes.join(', ') || '—'}`,
    p.plafond ? `Note maximale possible (plafond) : ${p.plafond}/5` : null,
  ].filter(Boolean).join('\n');
}

export function texteRegles(regles: RegleCtx[]): string {
  if (!regles.length) return 'Aucune règle particulière.';
  return regles.map((r) => `- [${r.type}${r.portee !== 'tout' ? ` / ${r.portee} ${r.cible ?? ''}` : ''}] ${r.texte}`).join('\n');
}

export function systemePat(restaurant: string, principes: PrincipeCtx[], regles: RegleCtx[]): string {
  return `Tu es Pat, le sommelier numérique du restaurant ${restaurant}. Tu parles français, tu vouvoies le client, tu es chaleureux, précis et bref.

Tu appliques les principes d'accord de Pat ci-dessous. Ce sont ta seule doctrine : ne les contredis jamais, et quand tu justifies un accord, appuie-toi sur eux sans citer leur numéro au client.

PRINCIPES DE PAT
${textePrincipes(principes)}

RÈGLES DU SOMMELIER DE ${restaurant.toUpperCase()} (elles s'ajoutent aux principes)
${texteRegles(regles)}

Règles impératives :
- Tu ne proposes QUE des vins de la carte fournie, désignés par leur code (ex. L-B02). Jamais de vin extérieur.
- Tu n'inventes ni prix, ni millésime, ni information sur un vin : seulement ce qui figure dans la carte.
- Si aucun vin de la carte ne convient bien, dis-le honnêtement et propose le moins mauvais compromis.`;
}

/** Consigne pour le calcul des accords d'un plat (script `npm run accords`). Réponse attendue : JSON strict. */
export function consigneAccords(plat: PlatCtx, carte: VinCtx[], nombre: number): string {
  return `${textePlat(plat)}

CARTE DES VINS DISPONIBLES
${texteCarte(carte)}

Choisis les ${nombre} meilleurs accords de la carte pour ce plat, du meilleur au moins bon, en appliquant les principes et les règles du sommelier.
Pour chacun, donne une note de 1 à 5 (jamais au-dessus du plafond s'il existe), une phrase courte pour le client (25 mots maximum, qui explique pourquoi le vin va avec le plat), une phrase plus longue (45 mots maximum), les identifiants des principes appliqués et la température de service.

Réponds uniquement avec ce JSON, sans texte autour :
[{"vin": "L-B02", "note": 5, "explication": "…", "explication_longue": "…", "principes": ["echanges-acide-gras"], "service": "10-11 °C"}]`;
}

/** Extrait les codes de vins cités à la fin d'une réponse de Pat (ligne « VINS : … »). */
export function extraireVins(texte: string, codesValides: string[]): { reponse: string; vins: string[] } {
  const m = texte.match(/\n?\s*VINS\s*:\s*([^\n]*)\s*$/i);
  const reponse = m ? texte.slice(0, m.index).trim() : texte.trim();
  const cites = (m?.[1] ?? reponse).match(/[A-Z]-[A-Z]\d{2}/g) ?? [];
  return { reponse, vins: [...new Set(cites)].filter((c) => codesValides.includes(c)) };
}
