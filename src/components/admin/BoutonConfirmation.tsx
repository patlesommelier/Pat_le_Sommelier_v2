'use client';
// Bouton d'une action irréversible : demande confirmation avant d'envoyer le formulaire.
// Avec `saisie`, il faut retaper ce texte (le nom du restaurant) : il part dans le champ « confirmation », revérifié côté serveur.
export function BoutonConfirmation({ action, libelle, question, saisie, className = 'btn sec petit' }: {
  action: (f: FormData) => void | Promise<void>; libelle: string; question: string; saisie?: string; className?: string;
}) {
  return (
    <form action={action} onSubmit={(e) => {
      const champ = e.currentTarget.elements.namedItem('confirmation') as HTMLInputElement;
      if (saisie) {
        const tape = window.prompt(`${question}\n\nPour confirmer, tapez : ${saisie}`);
        if (tape?.trim() !== saisie) { e.preventDefault(); if (tape !== null) window.alert('Le nom ne correspond pas : rien n’a été supprimé.'); return; }
        champ.value = tape.trim();
      } else if (!window.confirm(question)) e.preventDefault();
    }}>
      <input type="hidden" name="confirmation" />
      <button type="submit" className={className}>{libelle}</button>
    </form>
  );
}
