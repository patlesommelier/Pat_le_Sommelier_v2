// Statut de l'espace d'un restaurant (super-admin) : un petit rond de couleur (vert actif, jaune inscription, rouge test) ;
// un clic ouvre le choix des trois statuts, avec ce qu'ils veulent dire.
import { changerModeRestaurant } from '@/app/admin/super/actions';
import { MODES, type ModeRestaurant } from '@/lib/admin/prochaine-etape';

export function BoutonMode({ id, nom, mode, retour }: { id: string; nom: string; mode: string; retour: string }) {
  const m = MODES[mode as ModeRestaurant] ?? MODES.actif;
  return (
    <details className="bouton-mode">
      <summary aria-label={`Statut de ${nom} : ${m.libelle}. Changer`} title={`${m.libelle} : ${m.sens} Cliquez pour changer.`}>
        <span className="rond-mode" style={{ background: m.couleur, boxShadow: `0 0 0 3px ${m.couleur}2E` }} />
      </summary>
      <form action={changerModeRestaurant.bind(null, id)} className="menu-mode">
        <input type="hidden" name="retour" value={retour} />
        {(Object.entries(MODES) as [ModeRestaurant, (typeof MODES)[ModeRestaurant]][]).map(([k, x]) => (
          <button key={k} name="mode" value={k} aria-pressed={k === mode}>
            <span className="rond-mode" style={{ background: x.couleur }} />
            <span><b>{x.libelle}</b><small>{x.sens}</small></span>
          </button>
        ))}
      </form>
    </details>
  );
}
