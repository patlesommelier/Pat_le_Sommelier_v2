'use client';
// Bouton « Imprimer le pense-bête » (page des accords) : ouvre le pense-bête dans un autre onglet et fait disparaître tout
// de suite le post-it qui le montrait (le serveur le note aussi pour les visites suivantes).
export function LienPenseBete({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const vu = () => {
    try { sessionStorage.setItem('pat-guide-chevalet-vu-11', '1'); sessionStorage.setItem('pat-guide-chevalet-annonce-faite', '1'); } catch { /* rien */ }
    window.dispatchEvent(new Event('pat-annonce-vue'));
  };
  return <a id="bouton-pense-bete" href={href} target="_blank" rel="noopener" className={className} onClick={vu}>{children}</a>;
}
