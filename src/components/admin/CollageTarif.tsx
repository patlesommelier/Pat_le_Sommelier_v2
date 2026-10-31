'use client';
// Tarif copié depuis le site d'un distributeur : le texte collé, et en coulisses la version « page web » du presse-papiers,
// qui contient l'adresse des images (étiquettes). Plusieurs collages (pages du site) s'ajoutent les uns aux autres.
import { useState } from 'react';

export function CollageTarif({ action, desactive }: { action: (f: FormData) => void | Promise<void>; desactive?: boolean }) {
  const [html, setHtml] = useState('');
  const [texte, setTexte] = useState('');
  const [pages, setPages] = useState(0);
  return (
    <form action={action} className="pile" style={{ gap: 10 }}>
      <textarea name="texte" rows={8} value={texte} required minLength={40} className="recherche" style={{ width: '100%', fontSize: 14 }}
        placeholder="Sur le site du distributeur, connecté à votre compte : sélectionnez la liste des vins (Ctrl + A ou Cmd + A), copiez-la, puis collez-la ici. Plusieurs pages du site : collez-les l’une après l’autre."
        onChange={(e) => setTexte(e.target.value)}
        onPaste={(e) => {
          const page = e.clipboardData.getData('text/html');
          if (page) { setHtml((h) => `${h}\n${page}`); setPages((n) => n + 1); }
          // Collage ajouté à la suite du texte déjà collé (une page du site après l'autre).
          const t = e.clipboardData.getData('text/plain');
          if (t && texte.trim()) { e.preventDefault(); setTexte((x) => `${x.trimEnd()}\n\n${t}`); }
        }} aria-label="Texte copié depuis le site du distributeur" />
      <input type="hidden" name="html" value={html} />
      <div className="ligne-actions" style={{ alignItems: 'center' }}>
        <button className="btn" disabled={desactive || texte.trim().length < 40}>Lire le texte collé</button>
        <span className="discret petit">{texte ? `${texte.split('\n').filter((l) => l.trim()).length} lignes` : ''}{pages ? ` · ${pages} page${pages > 1 ? 's' : ''} du site, avec les images` : texte ? ' · sans images (collez depuis le site pour les garder)' : ''}</span>
        {texte && <button type="button" className="btn fantome petit" onClick={() => { setTexte(''); setHtml(''); setPages(0); }}>Vider</button>}
      </div>
    </form>
  );
}
