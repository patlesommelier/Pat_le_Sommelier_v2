'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { exigerAcces, exigerAdmin } from '@/lib/admin/auth';
import { suggestionsProducteurs } from '@/lib/admin/donnees';
import { deposerImage } from '@/lib/admin/fichiers';
import { supabaseConfigure, supabaseService, supabaseSession } from '@/lib/admin/supabase';
import { REGLAGES_PAT, type Reglages } from '@/lib/selection';

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const nombre = (f: FormData, k: string) => {
  const v = txt(f, k);
  if (v === null) return null;
  const n = Number(v.replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fichier = (f: FormData, k: string) => {
  const v = f.get(k);
  return v instanceof File && v.size > 0 ? v : null;
};
const avec = (url: string, params: Record<string, string>) => `${url}?${new URLSearchParams(params)}`;

// ───────── Connexion ─────────
export async function seConnecter(f: FormData) {
  if (!supabaseConfigure()) redirect('/admin');
  const supabase = await supabaseSession();
  const { error } = await supabase.auth.signInWithPassword({ email: txt(f, 'email') ?? '', password: String(f.get('mdp') ?? '') });
  if (error) redirect(avec('/admin/connexion', { erreur: 'E-mail ou mot de passe incorrect.' }));
  redirect('/admin');
}

export async function seDeconnecter() {
  if (supabaseConfigure()) await (await supabaseSession()).auth.signOut();
  redirect('/admin/connexion');
}

export async function motDePasseOublie(f: FormData) {
  if (!supabaseConfigure()) redirect('/admin/connexion');
  const h = await headers();
  const origine = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  await (await supabaseSession()).auth.resetPasswordForEmail(txt(f, 'email') ?? '', { redirectTo: `${origine}/admin/auth/retour?suite=/admin/mot-de-passe` });
  redirect(avec('/admin/connexion', { info: 'Si ce compte existe, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe.' }));
}

export async function changerMotDePasse(f: FormData) {
  const mdp = String(f.get('mdp') ?? '');
  if (mdp.length < 10) redirect(avec('/admin/mot-de-passe', { erreur: '10 caractères minimum.' }));
  if (mdp !== f.get('mdp2')) redirect(avec('/admin/mot-de-passe', { erreur: 'Les deux mots de passe sont différents.' }));
  const { error } = await (await supabaseSession()).auth.updateUser({ password: mdp });
  if (error) redirect(avec('/admin/mot-de-passe', { erreur: error.message }));
  redirect('/admin');
}

// ───────── Menu ─────────
export async function enregistrerPlat(resto: string, platId: string, f: FormData) {
  await exigerAcces(resto);
  const cat = txt(f, 'categorie');
  await requete(
    `update plat set nom = coalesce($3, nom), nom_court = $4, categorie = coalesce($5::categorie_plat, categorie), prix = $6,
            prix_variantes = $7, actif = $8, modifie_bo = now(),
            description_modifiee_le = case when coalesce(description_cuisine, '') <> coalesce($9, '') then now() else description_modifiee_le end,
            description_cuisine = $9
      where id = $1 and restaurant_id = $2`,
    [platId, resto, txt(f, 'nom'), txt(f, 'nom_court'), ['entree', 'plat', 'dessert', 'fromage'].includes(cat ?? '') ? cat : null,
      nombre(f, 'prix'), txt(f, 'prix_variantes'), f.get('actif') === 'on', txt(f, 'description_cuisine')],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/menu`, { plat: platId, ok: '1' }));
}

// ───────── Carte des vins ─────────
export async function enregistrerVin(resto: string, vinId: string, f: FormData) {
  await exigerAcces(resto);
  let etiquette: string | null = null;
  const image = fichier(f, 'etiquette');
  if (image) {
    try {
      etiquette = await deposerImage(image, `${resto}/etiquettes`);
    } catch (e) {
      redirect(avec(`/admin/${resto}/carte`, { vin: vinId, erreur: (e as Error).message }));
    }
  }
  await enregistrerProducteurDuVin(resto, vinId, txt(f, 'producteur_texte'), txt(f, 'producteur_choix'));
  await requete(
    `update vin_carte set millesime = $3, prix = $4, prix_verre = $5, resume_court = $6, disponible = $7, coup_de_coeur = $8,
            etiquette_url = coalesce($9, etiquette_url),
            etiquette_source = case when $9::text is not null then 'restaurant' else etiquette_source end,
            etiquette_statut = case when $9::text is not null then 'trouvee' else etiquette_statut end,
            modifie_bo = now()
      where id = $1 and restaurant_id = $2`,
    [vinId, resto, txt(f, 'millesime'), nombre(f, 'prix'), nombre(f, 'prix_verre'), txt(f, 'resume_court'),
      f.get('disponible') === 'on', f.get('coup_de_coeur') === 'on', etiquette],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/carte`, { vin: vinId, ok: '1' }));
}

/**
 * Producteur d'un vin.
 * - choix = id d'un producteur de la base : le vin y est relié et reprend son ranking.
 * - choix = « nouveau » : le nom saisi devient un producteur proposé à Pat (ranking 3), relié au vin.
 * - nom saisi ou changé sans choix : recherche dans la base. Un seul nom correspondant → relié ;
 *   aucun nom proche → nouveau producteur proposé (ranking 3) ; des noms proches → ils sont proposés au choix.
 * - nom vidé : le vin n'est plus relié (« Producteur à préciser »).
 */
async function enregistrerProducteurDuVin(resto: string, vinId: string, nom: string | null, choix: string | null) {
  const [v] = await requete<{ producteur_id: string | null; producteur_texte: string | null; pays: string | null; section: string | null; couleur: string }>(
    'select producteur_id, producteur_texte, pays, section, couleur::text from vin_carte where id = $1 and restaurant_id = $2', [vinId, resto]);
  if (!v) return;
  const relier = async (id: string, texte: string | null) => {
    const [p] = await requete<{ nom: string; ranking_pat: number | null }>(`select nom, ranking_pat from producteur where id = $1 and statut <> 'retire'`, [id]);
    if (!p) return;
    await requete(
      `update vin_carte set producteur_id = $3, producteur_texte = $4, ranking_producteur = coalesce($5, ranking_producteur)
        where id = $1 and restaurant_id = $2`,
      [vinId, resto, id, texte ?? p.nom, p.ranking_pat],
    );
  };
  const proposer = async (texte: string) => {
    const base = `bo-prod-${texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;
    const [deja] = await requete<{ id: string }>(`select id from producteur where id = $1 or (statut = 'propose' and lower(nom) = lower($2))`, [base, texte]);
    const id = deja?.id ?? base;
    if (!deja) {
      await requete(
        `insert into producteur (id, nom, pays, region, couleurs, ranking_pat, statut, source, a_verifier)
         values ($1, $2, $3, $4, $5, 3, 'propose', $6, 'Ajouté depuis le back-office : fiche à compléter par Pat')`,
        [id, texte, v.pays, v.section, [v.couleur], `back-office ${resto} (${vinId})`],
      );
    }
    await requete(
      `update vin_carte set producteur_id = $3, producteur_texte = $4, ranking_producteur = 3 where id = $1 and restaurant_id = $2`,
      [vinId, resto, id, texte],
    );
  };

  if (choix === 'nouveau' && nom) return proposer(nom);
  if (choix && choix !== 'nouveau' && choix !== v.producteur_id) return relier(choix, nom);
  if (!nom) {
    await requete('update vin_carte set producteur_id = null, producteur_texte = null where id = $1 and restaurant_id = $2', [vinId, resto]);
    return;
  }
  if (nom === v.producteur_texte && v.producteur_id) return;
  // Nom saisi ou changé : recherche dans la base de Pat.
  const suggestions = await suggestionsProducteurs(nom, 5);
  const exact = suggestions.filter((p) => p.nom.toLowerCase() === nom.toLowerCase());
  if (exact.length === 1) return relier(exact[0].id, nom);
  if (!suggestions.length) return proposer(nom);
  // Des noms proches existent : le restaurant choisit (le vin n'est relié qu'après son choix).
  await requete('update vin_carte set producteur_id = null, producteur_texte = $3 where id = $1 and restaurant_id = $2', [vinId, resto, nom]);
}

// ───────── Accords ─────────
export async function changerNote(resto: string, platId: string, vinId: string, f: FormData) {
  const u = await exigerAcces(resto);
  const note = Number(f.get('note'));
  if (note >= 1 && note <= 5) {
    await requete(
      `update accord set note = $4, origine = 'sommelier', modifie_par = $5, calcule_le = now()
        where restaurant_id = $1 and plat_id = $2 and vin_id = $3`,
      [resto, platId, vinId, note, u.email],
    );
  }
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/accords`, { plat: platId }));
}

export async function validerPlat(resto: string, platId: string) {
  const u = await exigerAcces(resto);
  await requete(
    `update accord set statut = 'valide', valide_le = now(), modifie_par = coalesce(modifie_par, $3)
      where restaurant_id = $1 and plat_id = $2 and statut = 'propose'`, [resto, platId, u.email]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/accords`, { plat: platId, ok: '1' }));
}

export async function validerTout(resto: string) {
  const u = await exigerAcces(resto);
  await requete(
    `update accord set statut = 'valide', valide_le = now(), modifie_par = coalesce(modifie_par, $2)
      where restaurant_id = $1 and statut = 'propose'`, [resto, u.email]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/accords`);
}

// ───────── Règles ─────────
export async function enregistrerReglages(resto: string, f: FormData) {
  await exigerAcces(resto);
  const diff: Partial<Reglages> = {};
  for (const k of Object.keys(REGLAGES_PAT) as (keyof Reglages)[]) {
    const pat = REGLAGES_PAT[k];
    if (typeof pat === 'boolean') {
      const v = f.get(k) === 'on';
      if (v !== pat) (diff[k] as boolean) = v;
    } else {
      const v = nombre(f, k);
      if (v !== null && v !== pat) (diff[k] as number) = v;
    }
  }
  if ((diff.premiers ?? REGLAGES_PAT.premiers) > (diff.maximum ?? REGLAGES_PAT.maximum)) diff.maximum = diff.premiers;
  await requete('update restaurant set reglages_selection = $2 where id = $1', [resto, JSON.stringify(diff)]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/regles`, { ok: '1' }));
}

export async function retablirReglage(resto: string, cle: string) {
  await exigerAcces(resto);
  await requete(`update restaurant set reglages_selection = reglages_selection - $2 where id = $1`, [resto, cle]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

export async function retablirTout(resto: string) {
  await exigerAcces(resto);
  await requete(`update restaurant set reglages_selection = '{}' where id = $1`, [resto]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

export async function retirerVin(resto: string, f: FormData) {
  await exigerAcces(resto);
  const vin = txt(f, 'vin');
  if (vin) {
    const [v] = await requete<{ libelle: string }>('select libelle from vin_carte where id = $1 and restaurant_id = $2', [vin, resto]);
    if (v) {
      await requete(
        `insert into regle_sommelier (id, restaurant_id, type, portee, cible, texte, date_fin, actif)
         values ($1, $2, 'exclure', 'vin', $3, $4, $5, true) on conflict (id) do update set actif = true, date_fin = excluded.date_fin`,
        [`${resto}-bo-exclure-${vin.toLowerCase()}`, resto, vin, `Ne plus proposer ${v.libelle}`, txt(f, 'jusqua')],
      );
    }
  }
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

export async function remettreVin(resto: string, id: string) {
  await exigerAcces(resto);
  await requete(`delete from regle_sommelier where id = $1 and restaurant_id = $2 and id like '%-bo-%'`, [id, resto]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

// ───────── Apparence ─────────
function claire(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const m = (x: number) => Math.round(x + (255 - x) * 0.93).toString(16).padStart(2, '0');
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`.toUpperCase();
}

export async function enregistrerApparence(resto: string, f: FormData) {
  await exigerAcces(resto);
  const couleur = txt(f, 'couleur');
  if (!couleur || !/^#[0-9a-f]{6}$/i.test(couleur)) redirect(avec(`/admin/${resto}/apparence`, { erreur: 'Couleur invalide : utilisez un code comme #BA4037.' }));
  let logo: string | null = null;
  let logoFonce: string | null = null;
  try {
    const l = fichier(f, 'logo');
    if (l) logo = await deposerImage(l, `${resto}/logo`);
    const lf = fichier(f, 'logo_fonce');
    if (lf) logoFonce = await deposerImage(lf, `${resto}/logo`);
  } catch (e) {
    redirect(avec(`/admin/${resto}/apparence`, { erreur: (e as Error).message }));
  }
  const accroche = [txt(f, 'accroche1'), txt(f, 'accroche2')].filter(Boolean).join('|') || null;
  await requete(
    `update restaurant set couleur = $2, couleur_claire = $3, accroche = $4, logo_url = coalesce($5, logo_url),
            logo_fonce_url = coalesce($6, logo_fonce_url), modifie_bo = now()
      where id = $1`,
    [resto, couleur.toUpperCase(), claire(couleur), accroche, logo, logoFonce],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/apparence`, { ok: '1' }));
}

// ───────── Accès ─────────
export async function creerAcces(resto: string, f: FormData) {
  await exigerAcces(resto);
  const email = (txt(f, 'email') ?? '').toLowerCase();
  const mdp = String(f.get('mdp') ?? '');
  const retour = (m: Record<string, string>) => redirect(avec(`/admin/${resto}/acces`, m));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) retour({ erreur: 'Adresse e-mail invalide.' });
  if (mdp.length < 10) retour({ erreur: 'Mot de passe : 10 caractères minimum.' });
  if (mdp !== f.get('mdp2')) retour({ erreur: 'Les deux mots de passe sont différents.' });

  let userId: string | null = null;
  try {
    const sb = supabaseService();
    const { data, error } = await sb.auth.admin.createUser({ email, password: mdp, email_confirm: true });
    if (data.user) userId = data.user.id;
    else if (error && /already|registered|exists/i.test(error.message)) {
      // Compte existant (autre restaurant) : on le relie simplement à celui-ci, sans toucher à son mot de passe.
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data: l } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        userId = l.users.find((x) => x.email?.toLowerCase() === email)?.id ?? null;
        if (l.users.length < 200) break;
      }
    } else if (error) throw error;
  } catch (e) {
    retour({ erreur: `Création du compte impossible : ${(e as Error).message}` });
  }
  if (!userId) retour({ erreur: 'Compte introuvable.' });
  await requete(
    `insert into acces_restaurant (user_id, email, restaurant_id) values ($1, $2, $3) on conflict do nothing`,
    [userId, email, resto],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  retour({ ok: `Accès créé pour ${email}.` });
}

export async function retirerAcces(resto: string, userId: string) {
  await exigerAcces(resto);
  await requete('delete from acces_restaurant where restaurant_id = $1 and user_id = $2', [resto, userId]);
  revalidatePath(`/admin/${resto}`, 'layout');
  redirect(`/admin/${resto}/acces`);
}

// ───────── Base de Pat (administrateur) ─────────
export async function deciderProducteur(id: string, decision: 'valide' | 'retire') {
  await exigerAdmin();
  await requete(`update producteur set statut = $2::statut_validation where id = $1 and statut = 'propose'`, [id, decision]);
  revalidatePath('/admin/producteurs');
  redirect('/admin/producteurs');
}
