// Intitulés des vins recomposés à partir de leurs champs (appellation, nom du vin, cépage, producteur),
// comme le propose la fiche du vin du back-office. L'appellation et le nom déduits de la carte importée sont enregistrés
// avec, pour que la fiche montre les mêmes champs et que l'intitulé les suive ensuite.
// Rien ne se perd : si l'intitulé proposé oublie un mot de l'intitulé actuel (domaine, couleur, « Baron »…), le nom du vin
// devient l'intitulé actuel sans son appellation ; s'il ne commence pas par l'appellation, l'intitulé actuel reste.
import { appellationDeduite, cle, composerIntitule, nomDeduit } from '../../src/lib/admin/intitule';

const mots = (s: string) => cle(s).split(' ').filter(Boolean);

type Requete = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

interface Ligne {
  id: string; libelle: string; vin_texte: string | null; appellation_texte: string | null; nom_vin: string | null;
  cepages: string | null; producteur: string | null; appellation_nom: string | null;
}

export async function recomposerIntitules(q: Requete, { appliquer }: { appliquer: boolean }) {
  const vins = await q<Ligne>(
    `select v.id, v.libelle, v.vin_texte, v.appellation_texte, v.nom_vin, v.cepages, t.nom as appellation_nom,
            -- même nom de producteur que la fiche : celui saisi dans le back-office, sinon celui de la base de Pat
            case when v.producteur_texte ~* '^non ' then null
                 when v.modifie_bo is not null and v.producteur_texte is not null then v.producteur_texte
                 else coalesce(p.nom, v.producteur_texte) end as producteur
       from vin_carte v left join producteur p on p.id = v.producteur_id left join terroir t on t.id = v.appellation_id
      order by v.restaurant_id, v.ordre`);
  const changes: Array<{ id: string; avant: string; apres: string }> = [];
  for (const v of vins) {
    const appellation = v.appellation_texte ?? (appellationDeduite(v.vin_texte, v.appellation_nom) || null);
    let nom = v.nom_vin ?? (nomDeduit(v.vin_texte) || null);
    const composer = () => composerIntitule({ appellation, nom, cepage: v.cepages, producteur: v.producteur });
    let libelle = composer();
    const perdus = (l: string) => mots(v.libelle).some((m) => !mots(l).includes(m));
    if (libelle && perdus(libelle) && !v.nom_vin) {
      const a = mots(appellation ?? ''), actuel = v.libelle.trim().split(/\s+/);
      if (a.length && mots(actuel.slice(0, a.length).join(' ')).join(' ') === a.join(' ')) {
        nom = actuel.slice(a.length).join(' ').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim() || null;
        libelle = composer();
      }
    }
    if (!libelle || perdus(libelle)) libelle = v.libelle; // rien pour composer, ou un mot perdu : l'intitulé actuel reste
    if (libelle !== v.libelle) changes.push({ id: v.id, avant: v.libelle, apres: libelle });
    if (appliquer) {
      await q(`update vin_carte set libelle = $2, appellation_texte = $3, nom_vin = $4 where id = $1`, [v.id, libelle, appellation, nom]);
    }
  }
  return changes;
}
