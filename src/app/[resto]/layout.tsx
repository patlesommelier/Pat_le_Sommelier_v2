import { notFound } from 'next/navigation';
import '../creme.css';
import type { CSSProperties } from 'react';
import { BarrePat } from '@/components/BarrePat';
import { contrasteBlanc, couleurClaire, eclaircir } from '@/lib/couleurs';
import { couleurDuLogo } from '@/lib/couleur-logo';
import { getRestaurant } from '@/lib/donnees';
import { appOuverte } from '@/lib/ouverture';
import { requete } from '@/lib/db';
import { reparerLogo } from '@/lib/logo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ resto: string }> }) {
  const r = await getRestaurant((await params).resto);
  return { title: r ? `${r.nom} · Pat le sommelier` : 'Pat le sommelier' };
}

export default async function LayoutRestaurant({ children, params }: { children: React.ReactNode; params: Promise<{ resto: string }> }) {
  const restaurant = await getRestaurant((await params).resto);
  if (!restaurant) notFound();
  // Logo d'un restaurant inscrit déposé avant le recadrage automatique : rogné et mesuré une fois.
  if (restaurant.logo_url && restaurant.logo_ratio == null && restaurant.origine === 'inscription') await reparerLogo(restaurant.id, restaurant.logo_url);
  const clair = couleurClaire(restaurant.couleur);
  // Couleur claire (logo sur fond blanc…) : les boutons prennent la couleur foncée du logo (bleu marine de Bercuit…), sinon le noir.
  // Calculée une fois d'après le logo, et de nouveau quand la couleur ou le logo changent.
  let boutons = '#1A1A1A';
  if (clair) {
    const logo = restaurant.logo_fonce_url || restaurant.logo_url;
    const cle = `${restaurant.couleur}|${logo ?? ''}`;
    let trouvee = restaurant.couleur_boutons ?? '';
    if (restaurant.couleur_boutons_cle !== cle) {
      trouvee = (logo && await couleurDuLogo(logo)) || '';
      await requete('update restaurant set couleur_boutons = $2, couleur_boutons_cle = $3 where id = $1', [restaurant.id, trouvee, cle]);
    }
    if (/^#[0-9a-f]{6}$/i.test(trouvee) && contrasteBlanc(trouvee) >= 4.5) boutons = trouvee.toUpperCase();
  }
  // Mise en page choisie dans « Apparence » : « Crème et courbes » (par défaut), « Classique » (l'ancienne) ou « Sombre »
  // (la même que Crème et courbes, sur fond sombre).
  // Bento, Néo-brutalisme et Éditorial : posés sur Crème et courbes (même structure), chacun avec son style.
  const sombre = restaurant.design_app === 'sombre';
  const creme = restaurant.design_app !== 'classique';
  const style = ['bento', 'brut', 'edito'].includes(restaurant.design_app ?? '') ? restaurant.design_app : null;
  // Sur une couleur claire, le bandeau écrit en foncé ; les textes « couleur de marque » sur fond blanc aussi.
  const theme = {
    '--marque': restaurant.couleur, '--marque-claire': restaurant.couleur_claire,
    '--sur-marque': clair ? '#1A1A1A' : '#FFFFFF', '--marque-texte': clair ? boutons : restaurant.couleur,
    // Boutons pleins (« Trouver mon vin »…) : sur une couleur claire, ils passent en foncé pour rester bien visibles sur fond blanc.
    '--bouton': clair ? boutons : restaurant.couleur, '--sur-bouton': '#FFFFFF',
    // Design « Crème et courbes » : fond de page, pastilles et filets dans des teintes très claires de la couleur des boutons.
    ...(creme && !sombre && !style ? { '--fond': eclaircir(clair ? boutons : restaurant.couleur, 0.07), '--fond-pastille': eclaircir(clair ? boutons : restaurant.couleur, 0.1),
      '--ligne-creme': eclaircir(clair ? boutons : restaurant.couleur, 0.2) } : {}),
  } as CSSProperties;
  const classe = `ecran${creme ? ' design-creme' : ''}${sombre ? ' design-sombre' : ''}${style ? ` design-${style}` : ''}${creme && clair ? ' bandeau-clair' : ''}`;
  // Pas encore en service (ou suspendu) : page d'attente pour les clients ; chaque page vérifie aussi (rendu en parallèle).
  if (!(await appOuverte(restaurant.id))) {
    return (
      <div className={classe} style={theme}>
        <main style={{ minHeight: '70dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, textAlign: 'center' }}>
          {/* Page blanche : le logo foncé s'y lit mieux, s'il existe. */}
          {restaurant.logo_fonce_url || restaurant.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={(restaurant.logo_fonce_url || restaurant.logo_url)!} alt={restaurant.nom} style={{ maxWidth: 180, maxHeight: 110, objectFit: 'contain' }} />
            : <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--marque-texte)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="logo-pat-pastille" style={{ width: 88, height: 88 }}><img src="/pat/pat-avatar.svg" alt="" /></span>{restaurant.nom}</h1>}
          <p style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{restaurant.statut === 'suspendu' ? 'La carte des vins de Pat est momentanément indisponible.' : 'La carte des vins de Pat arrive très bientôt.'}</p>
          <p style={{ fontSize: 15, margin: 0, opacity: 0.75 }}>En attendant, demandez conseil à l’équipe : elle se fera un plaisir de vous guider.</p>
        </main>
      </div>
    );
  }
  // Première ouverture de l'app (le QR code vient d'être scanné) : notée une seule fois.
  await requete('update restaurant set premier_scan_le = now() where id = $1 and premier_scan_le is null', [restaurant.id]);
  return (
    <div className={classe} style={theme}>
      {children}
      <BarrePat restaurant={restaurant.id} nom={restaurant.nom} />
    </div>
  );
}
