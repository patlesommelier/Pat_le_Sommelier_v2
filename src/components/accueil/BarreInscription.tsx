'use client';
// Téléphone : barre « Inscrire mon restaurant · gratuit » fixée en bas de l'écran (styles dans quidvinum.module.css).
// Cachée tant que le haut de la page (et son bouton du menu) est à l'écran, et quand le formulaire d'inscription est visible.
import { useEffect, useState } from 'react';
import s from './quidvinum.module.css';

export function BarreInscription() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const maj = () => {
      const form = document.getElementById('demarrer')?.getBoundingClientRect();
      const formVisible = form ? form.top < innerHeight && form.bottom > 0 : false;
      setVisible(scrollY > 300 && !formVisible);
    };
    maj();
    addEventListener('scroll', maj, { passive: true });
    addEventListener('resize', maj);
    return () => { removeEventListener('scroll', maj); removeEventListener('resize', maj); };
  }, []);
  return <a href="#demarrer" className={s.barreMobile} data-visible={visible} aria-hidden={!visible} tabIndex={visible ? 0 : -1}>Inscrire mon restaurant · gratuit</a>;
}
