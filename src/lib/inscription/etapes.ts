// Étapes du formulaire de la page d'accueil (fonctions pures, testables).
// Ordre décidé avec Pat : 1. carte des vins, 2. menu, 3. restaurant. Une seule étape visible à la fois.
import type { Plat, VinRapproche } from './donnees';

export type TypeAnalyse = 'carte' | 'menu';
export type EtatAnalyse = { statut: 'en_attente' | 'en_cours' | 'ok' | 'erreur'; nombre?: number; message?: string; lanceeLe?: string };
export type Analyses = Partial<Record<TypeAnalyse, EtatAnalyse>>;
export type Etape = 'carte' | 'menu' | 'restaurant';

type Base = { vins: VinRapproche[]; plats: Plat[]; lecture?: Analyses };

/** Étape à afficher en revenant sur la page : la première qui n'est pas terminée. */
export function etapeCourante(i: Pick<Base, 'vins' | 'plats'> | null): Etape {
  if (!i || i.vins.length === 0) return 'carte';
  if (i.plats.length === 0) return 'menu';
  return 'restaurant';
}

/** Une lecture sans nouvelles depuis 15 minutes a été interrompue (fonction d'arrière-plan coupée). */
export const LECTURE_MAX_MS = 15 * 60 * 1000;

/** Ce que le navigateur a le droit de savoir : des compteurs, jamais les listes ni la base de Pat. */
export function resumePublic(i: Base | null, maintenant = Date.now()) {
  const etat = (t: TypeAnalyse) => {
    const a = i?.lecture?.[t];
    if (a && (a.statut === 'en_cours' || a.statut === 'en_attente')) {
      if (a.lanceeLe && maintenant - Date.parse(a.lanceeLe) > LECTURE_MAX_MS) {
        return { statut: 'erreur' as const, message: 'La lecture a été interrompue. Déposez à nouveau vos fichiers.' };
      }
      return { statut: 'en_cours' as const };
    }
    return a ? { statut: a.statut, nombre: a.nombre, message: a.message } : null;
  };
  return {
    etape: etapeCourante(i),
    carte: etat('carte') ?? (i?.vins.length ? { statut: 'ok' as const, nombre: i.vins.length } : null),
    menu: etat('menu') ?? (i?.plats.length ? { statut: 'ok' as const, nombre: i.plats.length } : null),
  };
}
export type ResumePublic = ReturnType<typeof resumePublic>;
