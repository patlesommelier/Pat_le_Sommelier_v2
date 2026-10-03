'use client';
export function BoutonImprimer() {
  return <button type="button" className="btn" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '10px 20px', borderRadius: 999, border: 0, background: '#610420', color: '#FFF', font: '700 15px Lato, sans-serif', cursor: 'pointer' }}>Imprimer</button>;
}
