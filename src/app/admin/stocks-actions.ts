'use server';
// Gestion des stocks : stocks des vins, fournisseurs, paramètres, commandes de vin (bon de commande PDF, envoi, réception).
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { exigerAcces } from '@/lib/admin/auth';
import { choisirFournisseur, donneesBon, modeTestDistributeurs, SQL_EMAIL_COMMANDE } from '@/lib/admin/stocks';
import { catalogueDistributeur } from '@/lib/distributeurs/donnees';
import { ajouterVinCommande } from '@/lib/admin/distributeur-vin';
import { lancerPreparation } from '@/lib/inscription/adaptateurs';
import { vinDeLaCarte } from '@/lib/distributeurs/tarif';
import { euros, genererBonCommande, referenceCommande } from '@/lib/bon-commande';
import { envoyerEmail } from '@/lib/email';
import { contenanceDuFormat, grouperMemeVin } from '@/lib/contenances';
import { distributeurPermis } from '@/lib/distributeurs/verrou';

type Retour = { ok?: string; erreur?: string };

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const entier = (f: FormData, k: string) => {
  const v = txt(f, k);
  if (v === null) return null;
  const n = Math.round(Number(v.replace(',', '.')));
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};

/** Prix en euros (virgule ou point) ; vide : null ; illisible : undefined (on ne change rien). */
const prix = (f: FormData, k: string): number | null | undefined => {
  if (!f.has(k)) return undefined;
  const v = txt(f, k);
  if (v === null) return null;
  const n = Number(v.replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : undefined;
};

const rafraichir = (resto: string) => {
  for (const p of ['stocks', 'commandes', 'fournisseurs', 'parametres', 'carte', 'trouver-vin']) revalidatePath(`/admin/${resto}/${p}`);
  revalidatePath(`/${resto}`, 'layout'); // l'app des clients (prix de vente)
};

/** Toutes les lignes (contenances) des vins dont on donne la ligne principale. */
async function lignesDesVins(resto: string, principaux: string[]) {
  const lignes = await requete<{ id: string; couleur: string; libelle: string; millesime: string | null; format: string }>(
    'select id, couleur::text, libelle, millesime, format from vin_carte where restaurant_id = $1 order by ordre, id', [resto]);
  const groupes = grouperMemeVin(lignes, (l) => l.format);
  return new Map(principaux.map((id) => [id, (groupes.find((g) => g.some((l) => l.id === id)) ?? []).map((l) => l.id)]));
}

// ───────── Stocks ─────────
/** Page Stocks : stock, bouteilles en commande, prix d'achat HTVA et fournisseur de chaque vin (champs stock_<id>, en_commande_<id>, achat_<id>, fournisseur_<id>). */
export async function enregistrerStocks(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  // Une ligne par vin (le stock ne se change plus ici : seulement dans la page Inventaire).
  const ids = [...f.keys()].filter((k) => k.startsWith('ligne_') || k.startsWith('stock_')).map((k) => k.replace(/^(ligne|stock)_/, ''))
    .filter((id, i, l) => l.indexOf(id) === i);
  if (!ids.length) return { ok: 'Rien à enregistrer.' };
  // Une seule requête pour tous les vins (une par vin dépassait le temps d'une action sur le serveur en ligne).
  const achats = ids.map((id) => prix(f, `achat_${id}`));
  // Prix de vente (bouteille, sur la carte) : un champ vidé ne retire pas le prix de la carte.
  const ventes = ids.map((id) => prix(f, `vente_${id}`) ?? undefined);
  const illisibles = ids.filter((id, i) => (achats[i] === undefined && txt(f, `achat_${id}`) !== null) || (ventes[i] === undefined && txt(f, `vente_${id}`) !== null));
  const r = await requete<{ id: string }>(
    `update vin_carte v set stock = coalesce(x.stock, v.stock), en_commande = coalesce(x.commande, v.en_commande),
            prix_achat = case when x.achat_envoye and not exists (select 1 from fournisseur q where q.id = v.fournisseur_id and q.distributeur_id is not null)
                              then x.achat else v.prix_achat end, prix = coalesce(x.vente, v.prix)
       from unnest($2::text[], $3::int[], $4::int[], $5::numeric[], $6::bool[], $7::numeric[]) as x(id, stock, commande, achat, achat_envoye, vente)
      where v.restaurant_id = $1 and v.id = x.id returning v.id`,
    [resto, ids, ids.map((id) => entier(f, `stock_${id}`)), ids.map((id) => entier(f, `en_commande_${id}`)),
      achats.map((a) => a ?? null), achats.map((a) => a !== undefined), ventes.map((v) => v ?? null)]);
  // Fournisseurs : seulement ceux qui ont changé (ou un nouveau fournisseur à créer).
  const actuels = new Map((await requete<{ id: string; fournisseur_id: string | null }>(
    'select id, fournisseur_id from vin_carte where restaurant_id = $1 and id = any($2)', [resto, ids])).map((v) => [v.id, v.fournisseur_id ?? '']));
  const changes = ids.filter((id) => f.has(`fournisseur_${id}`) && (txt(f, `fournisseur_${id}`) ?? '') !== actuels.get(id));
  if (changes.length) {
    const groupes = await lignesDesVins(resto, changes);
    for (const id of changes) await choisirFournisseur(resto, groupes.get(id) ?? [id], txt(f, `fournisseur_${id}`), txt(f, `fournisseur_nouveau_${id}`));
  }
  // Millésime (colonne de Ma cave) : pour toutes les contenances du vin ; seulement ceux qui ont changé.
  const millesimes = new Map((await requete<{ id: string; millesime: string | null }>(
    'select id, millesime from vin_carte where restaurant_id = $1 and id = any($2)', [resto, ids])).map((v) => [v.id, v.millesime ?? '']));
  const nouveauxMillesimes = ids.filter((id) => f.has(`millesime_${id}`) && (txt(f, `millesime_${id}`) ?? '').slice(0, 20) !== millesimes.get(id));
  if (nouveauxMillesimes.length) {
    const groupes = await lignesDesVins(resto, nouveauxMillesimes);
    for (const id of nouveauxMillesimes) {
      await requete('update vin_carte set millesime = $3 where restaurant_id = $1 and id = any($2)',
        [resto, groupes.get(id)?.length ? groupes.get(id) : [id], txt(f, `millesime_${id}`)?.slice(0, 20) ?? null]);
    }
  }
  // « À ma carte » : le vin (toutes ses contenances) est proposé sur la carte, ou retiré ; seulement ceux qui ont changé.
  const envoyes = ids.filter((id) => f.has(`carte_envoye_${id}`));
  if (envoyes.length) {
    const groupesCarte = await lignesDesVins(resto, envoyes);
    const dispo = new Map((await requete<{ id: string; disponible: boolean }>('select id, disponible from vin_carte where restaurant_id = $1', [resto])).map((x) => [x.id, x.disponible]));
    for (const id of envoyes) {
      const lignes = groupesCarte.get(id)?.length ? groupesCarte.get(id)! : [id];
      const voulu = f.get(`carte_${id}`) === 'on';
      if (lignes.some((l) => dispo.get(l)) !== voulu) {
        await requete('update vin_carte set disponible = $3 where restaurant_id = $1 and id = any($2)', [resto, lignes, voulu]);
      }
    }
  }
  // Vins confiés à un distributeur de Quid Vinum mais introuvables dans son catalogue : signalés.
  const absents = changes.length ? await requete<{ libelle: string; distributeur: string }>(
    `select v.libelle, f.nom as distributeur from vin_carte v join fournisseur f on f.id = v.fournisseur_id
      where v.restaurant_id = $1 and v.id = any($2) and f.distributeur_id is not null and v.distributeur_vin_id is null`, [resto, changes]) : [];
  rafraichir(resto);
  const n = r.length;
  if (absents.length) return { erreur: `Enregistré, mais ${absents.map((a) => `« ${a.libelle} »`).join(', ')} ${absents.length > 1 ? 'ne sont' : 'n’est'} pas dans le catalogue de ${absents[0].distributeur} : vérifiez le nom, le millésime ou la contenance.` };
  if (illisibles.length) return { erreur: `Enregistré, sauf ${illisibles.length} prix illisible${illisibles.length > 1 ? 's' : ''} : écrivez par exemple 12,50.` };
  return { ok: n ? 'Enregistré.' : 'Rien à enregistrer.' };
}

// ───────── Fournisseurs ─────────
const champsFournisseur = (f: FormData) => [txt(f, 'nom')?.slice(0, 120) ?? null, txt(f, 'adresse'), txt(f, 'tva'), txt(f, 'contact'), txt(f, 'telephone'), txt(f, 'email')];

export async function ajouterFournisseur(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const champs = champsFournisseur(f);
  if (!champs[0]) return { erreur: 'Indiquez le nom du distributeur.' };
  if (champs[5] && !/^\S+@\S+\.\S+$/.test(champs[5])) return { erreur: 'L’adresse e-mail du distributeur ne semble pas valide.' };
  await requete('insert into fournisseur (id, restaurant_id, nom, adresse, tva, contact, telephone, email) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [randomUUID(), resto, ...champs]);
  rafraichir(resto);
  const retour = txt(f, 'retour');
  if (retour?.startsWith(`/admin/${resto}/`)) redirect(retour);
  return { ok: `Distributeur « ${champs[0]} » ajouté.` };
}

export async function modifierFournisseur(resto: string, id: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const champs = champsFournisseur(f);
  if (!champs[0]) return { erreur: 'Le nom du distributeur ne peut pas être vide.' };
  if (champs[5] && !/^\S+@\S+\.\S+$/.test(champs[5])) return { erreur: 'L’adresse e-mail du distributeur ne semble pas valide.' };
  await requete('update fournisseur set nom = $3, adresse = $4, tva = $5, contact = $6, telephone = $7, email = $8 where id = $1 and restaurant_id = $2', [id, resto, ...champs]);
  rafraichir(resto);
  return { ok: 'Distributeur enregistré.' };
}

export async function supprimerFournisseur(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  await requete('delete from fournisseur where id = $1 and restaurant_id = $2', [id, resto]); // ses vins restent, sans fournisseur
  rafraichir(resto);
  return { ok: 'Distributeur supprimé : ses vins n’ont plus de distributeur.' };
}

/** Distributeur de la base de Quid Vinum ajouté aux fournisseurs du restaurant : il commande dans son catalogue, au prix proposé. */
export async function ajouterDistributeurQv(resto: string, distributeurId: string): Promise<Retour> {
  await exigerAcces(resto);
  const [d] = await requete<{ nom: string }>(`select nom from distributeur d where id = $1 and actif and ${distributeurPermis('$2')}`, [distributeurId, resto]);
  if (!d) return { erreur: 'Ce distributeur n’est plus proposé.' };
  // Remise du restaurant sur le prix public : celle du distributeur, modifiable ensuite par Pat pour ce restaurant (fiche du distributeur).
  await requete(`insert into fournisseur (id, restaurant_id, nom, distributeur_id) select $1, $2, $3, $4
                  where not exists (select 1 from fournisseur where restaurant_id = $2 and distributeur_id = $4)`, [randomUUID(), resto, d.nom, distributeurId]);
  rafraichir(resto);
  return { ok: `« ${d.nom} » est ajouté à vos distributeurs : ouvrez son catalogue pour ajouter ses vins à vos vins.` };
}

// ───────── Paramètres ─────────
export async function enregistrerParametresStock(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const limite = entier(f, 'stock_limite_basse');
  if (limite === null || limite > 1000) return { erreur: 'La limite de stock bas doit être un nombre de bouteilles (0 ou plus).' };
  const email = txt(f, 'commande_email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erreur: 'Votre adresse e-mail ne semble pas valide.' };
  // Adresse de facturation : seulement si la case « différente de l'adresse de livraison » est cochée.
  const facturation = f.get('facturation_differente') === 'on' ? txt(f, 'commande_adresse_facturation') : null;
  // Nom du restaurant : remplacé aussi dans le message d'accueil de l'app s'il y figurait (« Bienvenue chez … »).
  const nom = txt(f, 'nom')?.replace(/\s+/g, ' ').slice(0, 120);
  if (f.has('nom')) {
    if (!nom) return { erreur: 'Indiquez le nom du restaurant.' };
    await requete(
      `update restaurant set accroche = case when nom <> '' and accroche is not null then replace(accroche, nom, $2) else accroche end, nom = $2
        where id = $1 and nom is distinct from $2`, [resto, nom]);
    revalidatePath(`/admin/${resto}`, 'layout'); // le nom dans le menu de gauche
    revalidatePath('/admin/super');
  }
  await requete(
    `update restaurant set stock_limite_basse = $2, commande_societe = $3, commande_adresse = $4, commande_tva = $5, commande_contact = $6,
            commande_telephone = $7, commande_email = $8, commande_adresse_facturation = $9 where id = $1`,
    [resto, limite, txt(f, 'commande_societe'), txt(f, 'commande_adresse'), txt(f, 'commande_tva'), txt(f, 'commande_contact'), txt(f, 'commande_telephone'), email, facturation]);
  rafraichir(resto);
  return { ok: 'Paramètres enregistrés.' };
}

// ───────── Commandes ─────────
/**
 * Nouvelle commande à un fournisseur (ou sans fournisseur : '') : champs qte_<id du vin> en bouteilles.
 * Les bouteilles passent « en commande » sur chaque vin ; on revient sur la commande créée (PDF, envoi par e-mail).
 */
export async function creerCommande(resto: string, fournisseurId: string, f: FormData): Promise<Retour> {
  const u = await exigerAcces(resto);
  const quantites = [...f.keys()].filter((k) => k.startsWith('qte_')).map((k) => [k.slice(4), entier(f, k) ?? 0] as const).filter(([, q]) => q > 0);
  // Catalogue d'un distributeur de la base de Quid Vinum : champs cat_<id du vin du distributeur>.
  const duCatalogue = [...f.keys()].filter((k) => k.startsWith('cat_')).map((k) => [k.slice(4), entier(f, k) ?? 0] as const).filter(([, q]) => q > 0);
  if (!quantites.length && !duCatalogue.length) return { erreur: 'Indiquez au moins un nombre de bouteilles à commander.' };
  // Vins sans fournisseur : le fournisseur peut être choisi au moment de commander (il leur est alors attribué).
  const choisi = fournisseurId || txt(f, 'fournisseur') || '';
  if (!fournisseurId && choisi) await choisirFournisseur(resto, quantites.map(([id]) => id), choisi, null);
  fournisseurId = choisi;
  const r = await enregistrerCommande(resto, u.email, fournisseurId, quantites, duCatalogue, (vinId) => prix(f, `achat_${vinId}`));
  if ('erreur' in r) return r;
  rafraichir(resto);
  redirect(`/admin/${resto}/commandes/${r.id}`); // le bon de commande, prêt à envoyer
}

/** Crée la commande à un fournisseur (vins de la carte : quantites ; vins de son catalogue Quid Vinum : duCatalogue). */
async function enregistrerCommande(resto: string, email: string | null, fournisseurId: string, quantites: (readonly [string, number])[], duCatalogue: (readonly [string, number])[],
  achatIndique: (vinId: string) => number | null | undefined = () => undefined, reference: string | null = null): Promise<{ id: string } | { erreur: string }> {
  const [fournisseur] = fournisseurId
    ? await requete<{ nom: string; distributeur_id: string | null }>('select nom, distributeur_id from fournisseur where id = $1 and restaurant_id = $2', [fournisseurId, resto])
    : [{ nom: 'Fournisseur à préciser', distributeur_id: null }];
  if (!fournisseur) return { erreur: 'Distributeur introuvable.' };
  const catalogue = duCatalogue.length && fournisseur.distributeur_id ? await catalogueDistributeur(fournisseur.distributeur_id, resto) : [];
  for (const [vid, q] of duCatalogue) {
    const c = catalogue.find((x) => x.id === vid);
    if (!c) return { erreur: 'Un vin n’est plus au catalogue du distributeur : rechargez la page.' };
    if (c.epuise) return { erreur: `« ${c.libelle} » est épuisé chez le distributeur.` };
    if (c.maximum != null && q > c.maximum) return { erreur: `« ${c.libelle} » : ${c.maximum} bouteille${c.maximum > 1 ? 's' : ''} au plus.` };
  }
  const vins = await requete<{ id: string; libelle: string; millesime: string | null; format: string; producteur: string | null; producteur_id: string | null; distributeur_vin_id: string | null }>(
    `select v.id, v.libelle, v.millesime, v.format, coalesce(nullif(v.producteur_texte, ''), p.nom) as producteur, v.producteur_id, v.distributeur_vin_id
       from vin_carte v left join producteur p on p.id = v.producteur_id where v.restaurant_id = $1`, [resto]);
  const id = randomUUID();
  const [{ numero }] = await requete<{ numero: number }>('select coalesce(max(numero), 0) + 1 as numero from commande where restaurant_id = $1', [resto]);
  await requete('insert into commande (id, restaurant_id, fournisseur_id, fournisseur_nom, numero, cree_par, reference_interne) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, resto, fournisseurId || null, fournisseur.nom, numero, email, reference]);
  let ordre = 0;
  for (const [vinId, q] of quantites) {
    const v = vins.find((x) => x.id === vinId);
    if (!v) continue;
    const millesime = v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : '';
    const detail = [v.producteur && !/^non /i.test(v.producteur) ? v.producteur : null, contenanceDuFormat(v.format) === 'verre' ? null : v.format].filter(Boolean).join(' · ');
    // Prix d'achat HTVA : celui indiqué au moment de commander (il devient le prix d'achat du vin), sinon celui du vin.
    const achat = achatIndique(vinId);
    if (achat !== undefined) await requete('update vin_carte set prix_achat = $3 where restaurant_id = $1 and id = $2', [resto, vinId, achat]);
    await requete(`insert into commande_ligne (commande_id, vin_id, libelle, detail, quantite, ordre, prix_achat)
                   values ($1, $2, $3, $4, $5, $6, (select prix_achat from vin_carte where id = $2))`,
      [id, vinId, `${v.libelle}${millesime}`, detail || null, q, ordre++]);
    await requete('update vin_carte set en_commande = en_commande + $3 where restaurant_id = $1 and id = $2', [resto, vinId, q]);
  }
  // Vins du catalogue, au prix proposé : un vin déjà sur la carte (déjà relié, ou reconnu) reçoit ce fournisseur, ce prix d'achat
  // et les bouteilles « en commande » ; un vin hors carte est seulement commandé.
  for (const [vid, q] of duCatalogue) {
    const c = catalogue.find((x) => x.id === vid)!;
    const carte = vins.find((v) => v.distributeur_vin_id === c.id)
      ?? vinDeLaCarte({ id: c.id, libelle: c.libelle, millesime: c.millesime, contenance: c.contenance, producteur_id: c.producteur_id, producteur: c.producteur },
        vins.map((v) => ({ id: v.id, libelle: v.libelle, millesime: v.millesime, format: v.format, producteur_id: v.producteur_id, producteur: v.producteur })));
    const detail = [c.producteur, c.contenance, c.reference ? `réf. ${c.reference}` : null].filter(Boolean).join(' · ');
    const nouveau = carte ? null : await ajouterVinCommande(resto, c.id, fournisseurId || null, c.prix, q);
    await requete(`insert into commande_ligne (commande_id, vin_id, distributeur_vin_id, libelle, detail, quantite, ordre, prix_achat) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, carte?.id ?? nouveau, c.id, `${c.libelle}${c.millesime ? ` ${c.millesime}` : ''}`, detail || null, q, ordre++, c.prix]);
    if (carte) {
      await requete(`update vin_carte set distributeur_vin_id = $3, prix_achat = $4, en_commande = en_commande + $5 where restaurant_id = $1 and id = $2`,
        [resto, carte.id, c.id, c.prix, q]);
      await choisirFournisseur(resto, [carte.id], fournisseurId, null);
    }
  }
  return { id };
}

/**
 * Commande Quid Vinum : les vins des catalogues de tous les distributeurs Quid Vinum activés par le restaurant (champs cat_<id>),
 * en une seule commande envoyée à Quid Vinum. Chaque ligne nomme son distributeur ; les vins de la carte reçoivent ce distributeur,
 * ce prix d'achat et les bouteilles « en commande ».
 */
export async function creerCommandeQv(resto: string, f: FormData): Promise<Retour> {
  const u = await exigerAcces(resto);
  const demandes = [...f.keys()].filter((k) => k.startsWith('cat_')).map((k) => [k.slice(4), entier(f, k) ?? 0] as const).filter(([, q]) => q > 0);
  if (!demandes.length) return { erreur: 'Indiquez au moins un nombre de bouteilles à commander.' };
  const r = await enregistrerCommandeQv(resto, u.email, demandes);
  if ('erreur' in r) return r;
  rafraichir(resto);
  redirect(`/admin/${resto}/commandes/${r.id}`); // le bon de commande, prêt à envoyer
}

/** Crée la commande Quid Vinum (vins des catalogues des distributeurs Quid Vinum actifs du restaurant). */
async function enregistrerCommandeQv(resto: string, email: string | null, demandes: (readonly [string, number])[], reference: string | null = null): Promise<{ id: string } | { erreur: string }> {
  const actives = await requete<{ id: string; nom: string; distributeur_id: string }>(
    `select f.id, f.nom, f.distributeur_id from fournisseur f join distributeur d on d.id = f.distributeur_id and d.actif where f.restaurant_id = $1 and ${distributeurPermis('$1')}`, [resto]);
  const catalogues = new Map<string, Awaited<ReturnType<typeof catalogueDistributeur>>>();
  for (const a of actives) catalogues.set(a.distributeur_id, await catalogueDistributeur(a.distributeur_id, resto));
  const trouve = (vid: string) => { for (const a of actives) { const c = catalogues.get(a.distributeur_id)!.find((x) => x.id === vid); if (c) return { c, a }; } return null; };
  for (const [vid, q] of demandes) {
    const t = trouve(vid);
    if (!t) return { erreur: 'Un vin n’est plus au catalogue de son distributeur : rechargez la page.' };
    if (t.c.epuise) return { erreur: `« ${t.c.libelle} » est épuisé chez ${t.a.nom}.` };
    if (t.c.maximum != null && q > t.c.maximum) return { erreur: `« ${t.c.libelle} » : ${t.c.maximum} bouteille${t.c.maximum > 1 ? 's' : ''} au plus.` };
  }
  const vins = await requete<{ id: string; libelle: string; millesime: string | null; format: string; producteur: string | null; producteur_id: string | null; distributeur_vin_id: string | null }>(
    `select v.id, v.libelle, v.millesime, v.format, coalesce(nullif(v.producteur_texte, ''), p.nom) as producteur, v.producteur_id, v.distributeur_vin_id
       from vin_carte v left join producteur p on p.id = v.producteur_id where v.restaurant_id = $1`, [resto]);
  // Seulement des vins de la cave du restaurant : un nouveau vin s'ajoute d'abord avec « Rajouter un vin ».
  const enCave = (c: { id: string; libelle: string; millesime: string | null; contenance: string | null; producteur_id: string | null; producteur: string | null }) =>
    vins.find((v) => v.distributeur_vin_id === c.id)
      ?? vinDeLaCarte({ id: c.id, libelle: c.libelle, millesime: c.millesime, contenance: c.contenance, producteur_id: c.producteur_id, producteur: c.producteur },
        vins.map((v) => ({ id: v.id, libelle: v.libelle, millesime: v.millesime, format: v.format, producteur_id: v.producteur_id, producteur: v.producteur })));
  const horsCave = demandes.map(([vid]) => trouve(vid)!.c).find((c) => !enCave(c));
  if (horsCave) return { erreur: `« ${horsCave.libelle} » n’est pas dans votre cave : ajoutez-le d’abord avec « Rajouter un vin », puis commandez-le.` };
  const id = randomUUID();
  const [{ numero }] = await requete<{ numero: number }>('select coalesce(max(numero), 0) + 1 as numero from commande where restaurant_id = $1', [resto]);
  await requete('insert into commande (id, restaurant_id, fournisseur_id, fournisseur_nom, numero, cree_par, quid_vinum, reference_interne) values ($1, $2, null, $3, $4, $5, true, $6)',
    [id, resto, 'Quid Vinum', numero, email, reference]);
  let ordre = 0;
  // Lignes rangées par distributeur, dans l'ordre de leur catalogue.
  const lignes = demandes.map(([vid, q]) => ({ ...trouve(vid)!, q })).sort((x, y) => x.a.nom.localeCompare(y.a.nom));
  for (const { c, a, q } of lignes) {
    const carte = vins.find((v) => v.distributeur_vin_id === c.id)
      ?? vinDeLaCarte({ id: c.id, libelle: c.libelle, millesime: c.millesime, contenance: c.contenance, producteur_id: c.producteur_id, producteur: c.producteur },
        vins.map((v) => ({ id: v.id, libelle: v.libelle, millesime: v.millesime, format: v.format, producteur_id: v.producteur_id, producteur: v.producteur })));
    const detail = [`Chez ${a.nom}`, c.producteur, c.contenance, c.reference ? `réf. ${c.reference}` : null].filter(Boolean).join(' · ');
    // Vin hors de vos vins : ajouté à la page Vins (stock 0, en commande), pas encore sur la carte.
    const nouveau = carte ? null : await ajouterVinCommande(resto, c.id, a.id, c.prix, q);
    await requete(`insert into commande_ligne (commande_id, vin_id, distributeur_vin_id, libelle, detail, quantite, ordre, prix_achat) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, carte?.id ?? nouveau, c.id, `${c.libelle}${c.millesime ? ` ${c.millesime}` : ''}`, detail, q, ordre++, c.prix]);
    if (carte) {
      await requete(`update vin_carte set distributeur_vin_id = $3, prix_achat = $4, en_commande = en_commande + $5, fournisseur_id = $6 where restaurant_id = $1 and id = $2`,
        [resto, carte.id, c.id, c.prix, q, a.id]);
    }
  }
  return { id };
}

/** Envoie le bon de commande (PDF en pièce jointe) au fournisseur, avec le restaurant en copie. */
export async function envoyerCommande(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  const bon = await donneesBon(resto, id);
  if (!bon) return { erreur: 'Commande introuvable.' };
  if (!bon.fournisseur.email) return { erreur: bon.distributeur || bon.quidVinum ? 'L’adresse des commandes de Quid Vinum n’est pas encore renseignée : contactez Quid Vinum.' : `Ajoutez l’adresse e-mail de « ${bon.fournisseur.nom} » dans Fournisseurs.` };
  const ref = referenceCommande(bon);
  const total = bon.lignes.reduce((n, l) => n + l.quantite, 0);
  // Mode test : rien ne part chez un distributeur du restaurant (la commande passe quand même « envoyée »).
  const coupe = !bon.distributeur && !bon.quidVinum && await modeTestDistributeurs();
  const erreur = coupe ? null : await envoyerEmail({
    a: bon.fournisseur.email, copie: bon.restaurant.email, repondreA: bon.restaurant.email,
    sujet: `Bon de commande ${ref} — ${bon.restaurant.nom}${bon.distributeur ? ` — ${bon.distributeur}` : ''}`,
    texte: `Bonjour${bon.distributeur ? '' : bon.fournisseur.contact ? ` ${bon.fournisseur.contact}` : ''},\n\nVeuillez trouver ci-joint notre bon de commande n° ${ref}${bon.distributeur ? ` chez ${bon.distributeur}` : ''} (${total} bouteille${total > 1 ? 's' : ''}) :\n\n`
      + bon.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.detail ? ` (${l.detail})` : ''}${l.prix_achat != null ? ` à ${euros(l.prix_achat)} HTVA` : ''}`).join('\n')
      + (bon.referenceInterne ? `\n\nNotre référence interne : ${bon.referenceInterne}` : '')
      + `\n\nMerci de nous confirmer la commande et la date de livraison${bon.restaurant.email ? ` en répondant à cet e-mail` : ''}.\n\n${bon.restaurant.nom}${bon.restaurant.telephone ? `\n${bon.restaurant.telephone}` : ''}`,
    pieceJointe: { nom: `bon-de-commande-${ref}.pdf`, octets: genererBonCommande(bon) },
  });
  if (erreur) return { erreur };
  await requete(`update commande c set envoyee_le = now(), envoyee_a = $3,
                         statut_qv = case when c.statut_qv is null and (c.quid_vinum or exists (select 1 from fournisseur f where f.id = c.fournisseur_id and f.distributeur_id is not null)) then 'recue' else c.statut_qv end,
                         statut_qv_le = coalesce(c.statut_qv_le, now())
                   where id = $1 and restaurant_id = $2`, [id, resto, bon.fournisseur.email]);
  rafraichir(resto);
  return { ok: coupe ? `Mode test : rien n’est envoyé à ${bon.fournisseur.email} ; la commande est marquée envoyée.` : `Bon de commande envoyé à ${bon.fournisseur.email}.` };
}

/** Commande envoyée par le restaurant lui-même (partage du PDF ou messagerie) : statut « Commande envoyée ». */
export async function marquerEnvoyee(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  await requete(`update commande c set envoyee_le = now(),
                         envoyee_a = case when c.quid_vinum then (select valeur from reglage_serveur where cle = 'qv_email') else (select ${SQL_EMAIL_COMMANDE} from fournisseur f where f.id = c.fournisseur_id) end
                  where c.id = $1 and c.restaurant_id = $2 and c.statut = 'ouverte'`, [id, resto]);
  await requete(`update commande c set statut_qv = 'recue', statut_qv_le = now() where c.id = $1 and c.statut_qv is null
                   and (c.quid_vinum or exists (select 1 from fournisseur f where f.id = c.fournisseur_id and f.distributeur_id is not null))`, [id]);
  rafraichir(resto);
  return { ok: 'Commande envoyée.' };
}

/**
 * Réception d'une livraison : les bouteilles reçues de chaque ligne (« tout » : tout ce qui reste à recevoir) passent du
 * « en commande » au stock ; un bon de réception (partielle ou complète) est créé. Toute la commande reçue : « réceptionnée ».
 */
async function enregistrerReception(resto: string, commandeId: string, recues: Map<number, number> | 'tout', email: string | null) {
  const [c] = await requete<{ id: string }>(`select id from commande where id = $1 and restaurant_id = $2 and statut = 'ouverte'`, [commandeId, resto]);
  if (!c) return { erreur: 'Cette commande n’est plus ouverte.' };
  const lignes = await requete<{ ordre: number; vin_id: string | null; libelle: string; detail: string | null; quantite: number; recue: number; prix_achat: number | null }>(
    'select ordre, vin_id, libelle, detail, quantite, recue, prix_achat from commande_ligne where commande_id = $1 order by ordre', [commandeId]);
  const recu = lignes.map((l) => ({ ...l, q: Math.max(0, Math.min(l.quantite - l.recue, recues === 'tout' ? l.quantite - l.recue : recues.get(l.ordre) ?? 0)) })).filter((l) => l.q > 0);
  if (!recu.length) return { erreur: 'Indiquez au moins une bouteille reçue.' };
  const complete = lignes.every((l) => l.recue + (recu.find((x) => x.ordre === l.ordre)?.q ?? 0) >= l.quantite);
  const id = randomUUID();
  const [{ numero }] = await requete<{ numero: number }>('select coalesce(max(numero), 0) + 1 as numero from reception where commande_id = $1', [commandeId]);
  await requete('insert into reception (id, commande_id, numero, complete, cree_par) values ($1, $2, $3, $4, $5)', [id, commandeId, numero, complete, email]);
  for (const l of recu) {
    await requete('insert into reception_ligne (reception_id, ordre, libelle, detail, quantite, commandee, prix_achat) values ($1, $2, $3, $4, $5, $6, $7)',
      [id, l.ordre, l.libelle, l.detail, l.q, l.quantite, l.prix_achat]);
    await requete('update commande_ligne set recue = recue + $3 where commande_id = $1 and ordre = $2', [commandeId, l.ordre, l.q]);
    if (l.vin_id) await requete('update vin_carte set stock = stock + $3, en_commande = greatest(en_commande - $3, 0) where id = $1 and restaurant_id = $2', [l.vin_id, resto, l.q]);
  }
  if (complete) await requete(`update commande set statut = 'recue', recue_le = now() where id = $1`, [commandeId]);
  // Vins ajoutés par une commande (hors carte jusqu'ici) : à leurs premières bouteilles reçues, ils passent sur la carte,
  // et Pat prépare leurs accords avec les plats.
  const misSurCarte = (await requete<{ id: string }>(
    `update vin_carte set disponible = true, modifie_bo = now() where restaurant_id = $1 and id = any($2) and id like '%-qv-%' and not disponible and stock > 0 returning id`,
    [resto, recu.map((l) => l.vin_id).filter(Boolean)])).map((v) => v.id);
  if (misSurCarte.length && email) {
    const plats = await requete<{ id: string }>('select id from plat where restaurant_id = $1 and actif order by ordre', [resto]);
    await lancerPreparation(resto, plats.map((x) => x.id), email, { vins: misSurCarte }).catch((e) => console.error('[réception] accords', e));
  }
  rafraichir(resto);
  const n = recu.reduce((t, l) => t + l.q, 0);
  return { ok: `${n} bouteille${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} au stock : ${complete ? 'commande entièrement reçue' : 'réception partielle'}.`
    + (misSurCarte.length ? ` ${misSurCarte.length} vin${misSurCarte.length > 1 ? 's' : ''} ajouté${misSurCarte.length > 1 ? 's' : ''} à la carte : indiquez son prix de vente (page « Les vins »).` : ''), reception: id };
}

/** Réception des bouteilles (fenêtre de la commande) : champs recue_<ordre de la ligne>. */
export async function recevoirBouteilles(resto: string, commandeId: string, f: FormData): Promise<Retour> {
  const u = await exigerAcces(resto);
  const recues = new Map([...f.keys()].filter((k) => k.startsWith('recue_')).map((k) => [Number(k.slice(6)), entier(f, k) ?? 0] as const));
  const r = await enregistrerReception(resto, commandeId, recues, u.email);
  if ('erreur' in r) return { erreur: r.erreur };
  redirect(`/admin/${resto}/commandes?${new URLSearchParams({ commande: commandeId, ok: r.ok })}#commande-${commandeId}`);
}

/** Toutes les bouteilles restantes de la commande sont arrivées (réception complète). */
export async function receptionnerCommande(resto: string, id: string): Promise<Retour> {
  const u = await exigerAcces(resto);
  const r = await enregistrerReception(resto, id, 'tout', u.email);
  return 'erreur' in r ? { erreur: r.erreur } : { ok: r.ok };
}

/** Commande annulée : ses bouteilles ne sont plus « en commande ». */
export async function annulerCommande(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  const r = await requete<{ envoyee_a: string | null; envoyee_le: Date | null }>(
    `update commande set statut = 'annulee' where id = $1 and restaurant_id = $2 and statut = 'ouverte'
        and coalesce(statut_qv, '') not in ('acceptee', 'envoyee_distributeur', 'livree_partielle', 'livree', 'facturee') returning envoyee_a, envoyee_le`, [id, resto]);
  if (!r.length) return { erreur: 'Cette commande ne peut plus être annulée : elle n’est plus ouverte, ou Quid Vinum l’a déjà acceptée.' };
  // Commande déjà envoyée : son destinataire (Quid Vinum ou le distributeur) est prévenu de l'annulation, le restaurant en copie.
  let prevenu = '';
  const bon = r[0].envoyee_le ? await donneesBon(resto, id) : null;
  const a = r[0].envoyee_a ?? bon?.fournisseur.email ?? null;
  const coupe = Boolean(bon && !bon.distributeur && !bon.quidVinum && await modeTestDistributeurs());
  if (bon && a && coupe) prevenu = ` Mode test : ${a} n’a pas été prévenu par e-mail.`;
  if (bon && a && !coupe) {
    const ref = referenceCommande(bon);
    const erreur = await envoyerEmail({
      a, copie: bon.restaurant.email, repondreA: bon.restaurant.email,
      sujet: `Annulation de la commande ${ref} — ${bon.restaurant.nom}${bon.distributeur ? ` — ${bon.distributeur}` : ''}`,
      texte: `Bonjour,\n\nNous annulons notre commande n° ${ref}${bon.distributeur ? ` chez ${bon.distributeur}` : ''} :\n\n`
        + bon.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.detail ? ` (${l.detail})` : ''}`).join('\n')
        + `\n\nMerci de ne pas donner suite${bon.restaurant.email ? ' et de nous confirmer l’annulation en répondant à cet e-mail' : ''}.\n\n${bon.restaurant.nom}${bon.restaurant.telephone ? `\n${bon.restaurant.telephone}` : ''}`,
    });
    prevenu = erreur ? ` L’e-mail d’annulation n’est pas parti (${erreur}) : prévenez ${a} vous-même.` : ` ${a} en a été prévenu par e-mail.`;
  }
  await requete(
    `update vin_carte v set en_commande = greatest(v.en_commande - l.q, 0)
       from (select vin_id, sum(quantite - recue)::int as q from commande_ligne where commande_id = $1 and vin_id is not null group by vin_id) l
      where v.id = l.vin_id and v.restaurant_id = $2`, [id, resto]);
  rafraichir(resto);
  // Message en haut de la liste (la commande annulée quitte les commandes ouvertes, et son bouton avec elle).
  redirect(`/admin/${resto}/commandes?${new URLSearchParams({ ok: `Commande annulée.${prevenu}` })}`);
}

/**
 * Catalogue d'un distributeur Quid Vinum : le vin est ajouté aux vins du restaurant (page Vins, stock 0, pas encore sur la carte),
 * avec ce distributeur et le prix de son catalogue ; il se commande ensuite depuis le panier. Le distributeur devient actif s'il ne l'était pas.
 */
export async function ajouterDuCatalogue(resto: string, distributeurId: string, distributeurVinId: string): Promise<Retour & { vin?: string }> {
  await exigerAcces(resto);
  const [d] = await requete<{ nom: string }>(`select nom from distributeur d where id = $1 and actif and ${distributeurPermis('$2')}`, [distributeurId, resto]);
  if (!d) return { erreur: 'Ce distributeur n’est plus proposé.' };
  const c = (await catalogueDistributeur(distributeurId, resto)).find((x) => x.id === distributeurVinId);
  if (!c) return { erreur: 'Ce vin n’est plus au catalogue : rechargez la page.' };
  const [deja] = await requete<{ id: string }>('select id from vin_carte where restaurant_id = $1 and distributeur_vin_id = $2 limit 1', [resto, distributeurVinId]);
  if (deja) return { ok: `« ${c.libelle} » est déjà dans votre cave.`, vin: deja.id };
  await requete(`insert into fournisseur (id, restaurant_id, nom, distributeur_id) select $1, $2, $3, $4
                  where not exists (select 1 from fournisseur where restaurant_id = $2 and distributeur_id = $4)`,
    [randomUUID(), resto, d.nom, distributeurId]);
  const [f] = await requete<{ id: string }>('select id from fournisseur where restaurant_id = $1 and distributeur_id = $2', [resto, distributeurId]);
  // Le même vin est déjà dans vos vins (sur la carte) : il est relié à ce distributeur, à ce prix, plutôt qu'ajouté en double.
  const vins = await requete<{ id: string; libelle: string; millesime: string | null; format: string; producteur: string | null; producteur_id: string | null }>(
    `select v.id, v.libelle, v.millesime, v.format, coalesce(nullif(v.producteur_texte, ''), p.nom) as producteur, v.producteur_id
       from vin_carte v left join producteur p on p.id = v.producteur_id where v.restaurant_id = $1`, [resto]);
  const meme = vinDeLaCarte({ id: c.id, libelle: c.libelle, millesime: c.millesime, contenance: c.contenance, producteur_id: c.producteur_id, producteur: c.producteur }, vins);
  if (meme) {
    await requete('update vin_carte set distributeur_vin_id = $3, prix_achat = $4 where restaurant_id = $1 and id = $2', [resto, meme.id, c.id, c.prix]);
    await choisirFournisseur(resto, [meme.id], f.id, null);
    rafraichir(resto);
    revalidatePath(`/admin/${resto}/fournisseurs/${distributeurId}`);
    return { ok: `« ${meme.libelle} » est déjà dans votre cave : il est maintenant relié à ${d.nom}, au prix de son catalogue.`, vin: meme.id };
  }
  const id = await ajouterVinCommande(resto, distributeurVinId, f.id, c.prix, 0);
  if (!id) return { erreur: 'Ce vin n’est plus au catalogue : rechargez la page.' };
  rafraichir(resto);
  revalidatePath(`/admin/${resto}/fournisseurs/${distributeurId}`);
  return { ok: `« ${c.libelle} » est ajouté à votre cave (dans « Les vins », avec les vins de sa couleur) : mettez-le au panier ici ou depuis « Les vins ».`, vin: id };
}

// ───────── Panier (page Vins) ─────────
const bouteilles = (n: number) => `${n} bouteille${n > 1 ? 's' : ''}`;

/** Ajoute des bouteilles d'un vin au panier (elles s'ajoutent à celles qui y sont déjà). */
export async function ajouterAuPanier(resto: string, vinId: string, quantite: number, fournisseur?: string | null): Promise<Retour> {
  await exigerAcces(resto);
  const q = Math.floor(Number(quantite));
  if (!Number.isFinite(q) || q < 1 || q > 10000) return { erreur: 'Indiquez un nombre de bouteilles.' };
  const [v] = await requete<{ libelle: string; fournisseur_id: string | null }>('select libelle, fournisseur_id from vin_carte where id = $1 and restaurant_id = $2', [vinId, resto]);
  if (!v) return { erreur: 'Vin introuvable.' };
  // Distributeur choisi sur la ligne (page Vins) mais pas encore enregistré : il est enregistré avec l'ajout au panier.
  if (typeof fournisseur === 'string' && fournisseur !== 'nouveau' && fournisseur !== (v.fournisseur_id ?? '')) {
    const groupes = await lignesDesVins(resto, [vinId]);
    await choisirFournisseur(resto, groupes.get(vinId)?.length ? groupes.get(vinId)! : [vinId], fournisseur, null);
  }
  const [l] = await requete<{ quantite: number }>(`insert into panier (restaurant_id, vin_id, quantite) values ($1, $2, $3)
     on conflict (restaurant_id, vin_id) do update set quantite = panier.quantite + excluded.quantite returning quantite`, [resto, vinId, q]);
  rafraichir(resto);
  return { ok: `${bouteilles(q)} de « ${v.libelle} » au panier${l.quantite > q ? ` (${l.quantite} en tout)` : ''}.` };
}

/** Change le nombre de bouteilles d'une ligne du panier (0 : la ligne est retirée). */
export async function modifierPanier(resto: string, vinId: string, quantite: number): Promise<Retour> {
  await exigerAcces(resto);
  const q = Math.floor(Number(quantite));
  if (!Number.isFinite(q) || q < 0 || q > 10000) return { erreur: 'Indiquez un nombre de bouteilles.' };
  if (q === 0) await requete('delete from panier where restaurant_id = $1 and vin_id = $2', [resto, vinId]);
  else await requete('update panier set quantite = $3 where restaurant_id = $1 and vin_id = $2', [resto, vinId, q]);
  rafraichir(resto);
  return { ok: q ? 'Panier mis à jour.' : 'Vin retiré du panier.' };
}

export async function viderPanier(resto: string): Promise<Retour> {
  await exigerAcces(resto);
  await requete('delete from panier where restaurant_id = $1', [resto]);
  rafraichir(resto);
  return { ok: 'Panier vidé.' };
}

/**
 * Commande tout le panier : une commande Quid Vinum pour les vins des distributeurs Quid Vinum (pris dans leur catalogue),
 * une commande par distributeur du restaurant, et une « fournisseur à préciser » pour les vins sans distributeur.
 * Chaque commande créée retire ses lignes du panier ; on arrive sur la commande (ou la liste s'il y en a plusieurs).
 */
export async function commanderPanier(resto: string, referenceInterne?: string | null): Promise<Retour> {
  const u = await exigerAcces(resto);
  // Numéro de commande interne du restaurant (facultatif) : sur chaque bon créé.
  const reference = typeof referenceInterne === 'string' && referenceInterne.trim() ? referenceInterne.trim().slice(0, 60) : null;
  const lignes = await requete<{ vin_id: string; quantite: number; fournisseur_id: string | null; qv: boolean; distributeur_vin_id: string | null }>(
    `select p.vin_id, p.quantite, f.id as fournisseur_id, f.distributeur_id is not null as qv,
            -- Son vin dans le catalogue du distributeur Quid Vinum : celui relié, sinon le même vin de la base (même millésime d'abord).
            coalesce((select dv.id from distributeur_vin dv where dv.id = v.distributeur_vin_id and dv.distributeur_id = f.distributeur_id and dv.actif),
                     (select dv.id from distributeur_vin dv where v.cuvee_id is not null and dv.cuvee_id = v.cuvee_id and dv.distributeur_id = f.distributeur_id and dv.actif
                       order by (dv.millesime is not distinct from v.millesime) desc limit 1)) as distributeur_vin_id
       from panier p join vin_carte v on v.id = p.vin_id
       -- Distributeur du vin : celui de sa ligne, sinon celui d'une autre contenance du même vin.
       left join fournisseur f on f.id = coalesce(v.fournisseur_id, (select x.fournisseur_id from vin_carte x where x.restaurant_id = v.restaurant_id
                                   and lower(x.libelle) = lower(v.libelle) and x.millesime is not distinct from v.millesime and x.fournisseur_id is not null limit 1))
      where p.restaurant_id = $1 order by p.ajoute_le`, [resto]);
  if (!lignes.length) return { erreur: 'Le panier est vide.' };
  const creees: string[] = [];
  const retirer = (ids: string[]) => requete('delete from panier where restaurant_id = $1 and vin_id = any($2)', [resto, ids]);
  // Distributeurs Quid Vinum : une seule commande, depuis leurs catalogues.
  const duCatalogue = lignes.filter((l) => l.qv && l.distributeur_vin_id);
  if (duCatalogue.length) {
    const r = await enregistrerCommandeQv(resto, u.email, duCatalogue.map((l) => [l.distributeur_vin_id!, l.quantite] as const), reference);
    if ('erreur' in r) { rafraichir(resto); return r; }
    creees.push(r.id);
    await retirer(duCatalogue.map((l) => l.vin_id));
  }
  // Les autres : une commande par distributeur (sans distributeur : « fournisseur à préciser »).
  const parFournisseur = new Map<string, typeof lignes>();
  for (const l of lignes.filter((x) => !duCatalogue.includes(x))) parFournisseur.set(l.fournisseur_id ?? '', [...(parFournisseur.get(l.fournisseur_id ?? '') ?? []), l]);
  for (const [fournisseurId, ls] of parFournisseur) {
    const r = await enregistrerCommande(resto, u.email, fournisseurId, ls.map((l) => [l.vin_id, l.quantite] as const), [], undefined, reference);
    if ('erreur' in r) { rafraichir(resto); return r; }
    creees.push(r.id);
    await retirer(ls.map((l) => l.vin_id));
  }
  rafraichir(resto);
  // Plusieurs commandes : on arrive sur le premier bon ; une fois envoyé, on passe au suivant (« suite »).
  redirect(creees.length === 1 ? `/admin/${resto}/commandes/${creees[0]}`
    : `/admin/${resto}/commandes/${creees[0]}?${new URLSearchParams({ suite: creees.slice(1).join(','), n: '1', total: String(creees.length) })}`);
}

/**
 * Inventaire validé (page Inventaire) : le stock de chaque vin compté (ligne principale du vin), et la date de l'inventaire.
 * « Rien n'a changé » valide l'inventaire sans toucher aux stocks. Chaque inventaire est gardé (stock avant et après).
 */
export async function enregistrerInventaire(resto: string, f: FormData) {
  const u = await exigerAcces(resto);
  const rien = f.get('rien') === '1';
  const ids = [...f.keys()].filter((k) => k.startsWith('stock_')).map((k) => k.slice(6));
  const avant = new Map((await requete<{ id: string; stock: number }>('select id, stock from vin_carte where restaurant_id = $1 and id = any($2)', [resto, ids]))
    .map((v) => [v.id, v.stock]));
  const lignes = ids.filter((id) => avant.has(id)).map((id) => ({ id, avant: avant.get(id)!, apres: rien ? avant.get(id)! : entier(f, `stock_${id}`) ?? avant.get(id)! }));
  const changes = lignes.filter((l) => l.apres !== l.avant);
  if (changes.length) {
    await requete(`update vin_carte v set stock = x.stock from unnest($2::text[], $3::int[]) as x(id, stock) where v.restaurant_id = $1 and v.id = x.id`,
      [resto, changes.map((l) => l.id), changes.map((l) => l.apres)]);
  }
  const [inv] = await requete<{ id: string }>('insert into inventaire (restaurant_id, par, vins, changes) values ($1, $2, $3, $4) returning id',
    [resto, u.email, lignes.length, changes.length]);
  if (lignes.length) {
    await requete(`insert into inventaire_ligne (inventaire_id, vin_id, avant, apres) select $1, x.id, x.avant, x.apres
                    from unnest($2::text[], $3::int[], $4::int[]) as x(id, avant, apres)`,
      [inv.id, lignes.map((l) => l.id), lignes.map((l) => l.avant), lignes.map((l) => l.apres)]);
  }
  await requete('update restaurant set inventaire_le = now() where id = $1', [resto]);
  rafraichir(resto);
  revalidatePath(`/admin/${resto}`, 'layout');
  const ok = rien ? 'Inventaire validé : rien n’a changé.'
    : `Inventaire enregistré : ${lignes.length} vin${lignes.length > 1 ? 's' : ''} compté${lignes.length > 1 ? 's' : ''}, ${changes.length} stock${changes.length > 1 ? 's' : ''} modifié${changes.length > 1 ? 's' : ''}.`;
  redirect(`/admin/${resto}/stocks?${new URLSearchParams({ ok })}`);
}
