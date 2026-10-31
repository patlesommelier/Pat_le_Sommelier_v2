// Nouvelle appellation « à valider » dans la base de Pat (l'existante si le même nom y est déjà).
// Sans « server-only » : utilisé aussi en arrière-plan (lecture des tarifs, recherche des cépages).
import type { Requete } from '../generation/accords';
import { cleAppellation } from './regroupement';

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function creerAppellationProposeeAvec(requete: Requete, nom: string, source = 'saisie', region: string | null = null) {
  const propre = nom.replace(/\s+/g, ' ').trim();
  const existantes = await requete<{ id: string; nom: string }>(`select id, nom from terroir where statut <> 'retire'`);
  const meme = existantes.find((t) => cleAppellation(t.nom) === cleAppellation(propre));
  if (meme) return meme.id;
  const id = `propose-terr-${slug(propre)}`;
  await requete(
    `insert into terroir (id, nom, type, niveau, region, statut, source) values ($1, $2, 'appellation', 'appellation', $3, 'propose', $4)
     on conflict (id) do update set statut = case when terroir.statut = 'retire' then 'propose'::statut_validation else terroir.statut end`,
    [id, propre, region, source]);
  return id;
}
