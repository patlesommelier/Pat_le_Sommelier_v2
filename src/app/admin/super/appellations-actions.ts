'use server';
// Super-admin — appellations de la base de Pat : valider, modifier, regrouper les doublons, relier ou ajouter les appellations saisies.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { creerAppellationProposee, regrouperAppellations, relierSaisie } from '@/lib/appellations/base';

type Retour = { ok?: string; erreur?: string };
const txt = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
const LISTE = '/admin/super/appellations';
const retourListe = (f: FormData) => { const r = txt(f, 'retour'); return r?.startsWith(LISTE) ? r : LISTE; };
const avec = (url: string, m: Record<string, string>) => `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(m)}`;
const rafraichir = () => { revalidatePath(LISTE); revalidatePath('/admin/super/vins'); };

/** Appellations à valider (une, depuis sa ligne, ou plusieurs cochées). */
export async function validerAppellations(f: FormData) {
  await exigerAdmin();
  const ids = f.getAll('ids').map(String).filter(Boolean);
  const r = ids.length ? await requete(`update terroir set statut = 'valide', maj_le = now() where id = any($1) and statut = 'propose' returning id`, [ids]) : [];
  rafraichir();
  redirect(avec(retourListe(f), { ok: r.length ? `${r.length} appellation${r.length > 1 ? 's' : ''} validée${r.length > 1 ? 's' : ''}.` : 'Aucune appellation à valider dans la sélection.' }));
}

/** Nom, niveau, région, pays et ranking d'une appellation ; « retirer » la sort de la base (ses vins gardent leur appellation écrite). */
export async function modifierAppellation(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const nom = txt(f, 'nom');
  if (!nom) return { erreur: 'Le nom ne peut pas être vide.' };
  const niveau = ['appellation', 'zone', 'cru', 'lieu-dit', 'autre'].includes(txt(f, 'niveau') ?? '') ? txt(f, 'niveau') : 'appellation';
  const rk = txt(f, 'ranking');
  const ranking = rk === null ? null : Number(rk);
  if (ranking !== null && !(Number.isInteger(ranking) && ranking >= 0 && ranking <= 5)) return { erreur: 'Le ranking va de 0 à 5.' };
  const statut = ['valide', 'propose', 'retire'].includes(txt(f, 'statut') ?? '') ? txt(f, 'statut') : null;
  await requete(`update terroir set nom = $2, niveau = $3, region = $4, pays = $5, ranking_pat = $6, statut = coalesce($7::statut_validation, statut), maj_le = now() where id = $1`,
    [id, nom, niveau, txt(f, 'region'), txt(f, 'pays'), ranking, statut]);
  // Le ranking d'une appellation vaut pour tous ses vins, dans tous les restaurants.
  await requete('update vin_carte set ranking_terroir = $2 where appellation_id = $1', [id, ranking]);
  if (statut === 'retire') {
    await requete('update cuvee set appellation_id = null where appellation_id = $1', [id]);
    await requete('update vin_carte set appellation_id = null where appellation_id = $1', [id]);
  }
  revalidatePath('/admin', 'layout');
  return { ok: 'Appellation enregistrée.' };
}

/** Regroupe les appellations cochées (sources) dans celle à garder (cible). */
export async function regrouper(f: FormData) {
  await exigerAdmin();
  const cible = txt(f, 'cible');
  const sources = f.getAll('sources').map(String).filter((s) => s && s !== cible);
  const retour = retourListe(f);
  if (!cible || !sources.length) redirect(avec(retour, { erreur: 'Choisissez l’appellation à garder et au moins une autre à regrouper.' }));
  const n = await regrouperAppellations(cible!, sources);
  revalidatePath('/admin', 'layout');
  redirect(avec(retour, { ok: `${sources.length + 1} appellations regroupées en une : ${n} vin${n > 1 ? 's' : ''} déplacé${n > 1 ? 's' : ''}.` }));
}

/** Regroupe une appellation dans une autre choisie par son nom (liste de la base). */
export async function regrouperDans(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const nom = txt(f, 'dans');
  const [cible] = nom ? await requete<{ id: string }>(`select id from terroir where lower(nom) = lower($1) and statut <> 'retire' and id <> $2 order by statut = 'valide' desc limit 1`, [nom, id]) : [];
  if (!cible) return { erreur: 'Choisissez une appellation de la liste.' };
  const n = await regrouperAppellations(cible.id, [id]);
  revalidatePath('/admin', 'layout');
  return { ok: `Appellation regroupée dans « ${nom} » : ${n} vin${n > 1 ? 's' : ''} déplacé${n > 1 ? 's' : ''}.` };
}

/** Appellation écrite sur des vins : reliée à une appellation de la base (la proposition, ou une autre choisie par son nom). */
export async function relierAppellationSaisie(texte: string, terroirId: string | null, f: FormData): Promise<Retour> {
  await exigerAdmin();
  let id = terroirId;
  if (!id) {
    const nom = txt(f, 'dans');
    id = nom ? (await requete<{ id: string }>(`select id from terroir where lower(nom) = lower($1) and statut <> 'retire' order by statut = 'valide' desc limit 1`, [nom]))[0]?.id ?? null : null;
    if (!id) return { erreur: 'Choisissez une appellation de la liste.' };
  }
  const n = await relierSaisie(texte, id);
  rafraichir();
  return { ok: `« ${texte} » : ${n} vin${n > 1 ? 's' : ''} relié${n > 1 ? 's' : ''}.` };
}

/** Appellation écrite sur des vins, inconnue de la base : ajoutée (à valider), et ses vins y sont reliés. */
export async function ajouterAppellationSaisie(texte: string): Promise<Retour> {
  await exigerAdmin();
  const id = await creerAppellationProposee(texte);
  const n = await relierSaisie(texte, id);
  rafraichir();
  return { ok: `« ${texte} » ajoutée à la base, à valider : ${n} vin${n > 1 ? 's' : ''} relié${n > 1 ? 's' : ''}.` };
}
