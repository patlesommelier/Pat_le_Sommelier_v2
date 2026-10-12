'use client';
// Formulaire « Fusionner » de la fiche d'un vin de la base : le choix du vin à garder est dans la fiche (attribut form) ;
// une confirmation est demandée avant l'envoi (le doublon est retiré de la base).
export function FormulaireFusion({ action, retour }: { action: (f: FormData) => void | Promise<void>; retour: string }) {
  return (
    <form id="fusion" action={action} onSubmit={(e) => {
      const choix = document.getElementById('cible') as HTMLSelectElement | null;
      const nom = choix?.selectedOptions[0]?.text ?? '';
      if (!window.confirm(`Fusionner ce vin dans « ${nom} » ?\n\nSes vins sur les cartes y seront reliés et ce vin sera retiré de la base.`)) e.preventDefault();
    }}>
      <input type="hidden" name="retour" value={retour} />
    </form>
  );
}
