'use client';
// Configuration d'un restaurant (super-admin) : verrouiller le restaurant sur un seul distributeur Quid Vinum, avec confirmation.

export function FormulaireVerrou({ action, actuel, distributeurs, restaurant }: {
  action: (f: FormData) => Promise<void>; actuel: string | null; distributeurs: { id: string; nom: string; actif: boolean }[]; restaurant: string;
}) {
  return (
    <form action={action} className="ligne-actions" style={{ alignItems: 'center' }} onSubmit={(e) => {
      const id = String(new FormData(e.currentTarget).get('distributeur') ?? '');
      if (id === (actuel ?? '')) { e.preventDefault(); return; }
      const d = distributeurs.find((x) => x.id === id);
      const autres = distributeurs.filter((x) => x.actif && x.id !== id).map((x) => x.nom);
      const question = d
        ? `Verrouiller « ${restaurant} » sur « ${d.nom} » ? Il ne verra et ne commandera plus que ce distributeur Quid Vinum.`
          + (autres.length ? `\n\nRetirés de sa sélection : ${autres.join(', ')} (leurs vins n’auront plus de distributeur ; les commandes passées restent).` : '')
        : `Retirer le verrou ? Tous les distributeurs Quid Vinum seront de nouveau proposés à « ${restaurant} ».`;
      if (!window.confirm(question)) e.preventDefault();
    }}>
      <select name="distributeur" defaultValue={actuel ?? ''} aria-label="Distributeur Quid Vinum unique" style={{ minHeight: 36, borderRadius: 8, border: '1.5px solid var(--ligne)', padding: '0 8px' }}>
        <option value="">Pas de verrou : tous les distributeurs Quid Vinum</option>
        {distributeurs.map((d) => <option key={d.id} value={d.id}>Seulement {d.nom}</option>)}
      </select>
      <button className="btn sec petit">Enregistrer</button>
    </form>
  );
}
