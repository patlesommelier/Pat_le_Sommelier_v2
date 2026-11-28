// Page d'accueil d'un restaurant (Home) : bonjour, les deux promesses du site (Quid Vinum pour le restaurateur,
// Pat le sommelier pour ses clients) avec quelques chiffres, le QR code des tables et l'app qui tourne sur un téléphone.
// Pat le sommelier d'abord (toujours actif), puis Quid Vinum (la gestion de cave peut ne pas être encore ouverte) ;
// le téléphone et le QR code à droite.
import Link from 'next/link';
import { euros } from '@/lib/bon-commande';
import { getRestaurantBO, getResume, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getPrixAchat, stockBas } from '@/lib/admin/stocks';
import { regrouperVins } from '@/app/admin/[resto]/carte/etats';
import { MESSAGE_CARTE_A_VALIDER } from '@/lib/admin/prochaine-etape';

type Chiffre = { n: string; libelle: string; lien: string; alerte?: boolean };

async function chiffres(resto: string, cave: boolean) {
  const [vins, r, s, ouvertes, achats] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), getResume(resto),
    cave ? getCommandes(resto, ['ouverte']) : [], cave ? getPrixAchat(resto) : new Map<string, number>()]);
  const base = `/admin/${resto}`;
  const carte = regrouperVins(vins);
  const pat: Chiffre[] = [
    { n: String(s.plats), libelle: s.plats > 1 ? 'plats au menu' : 'plat au menu', lien: `${base}/menu` },
    { n: s.accords.toLocaleString('fr-BE'), libelle: 'accords mets-vins', lien: `${base}/accords` },
    { n: String(carte.filter((g) => g.tous.some((x) => x.coup_de_coeur)).length), libelle: 'coups de cœur', lien: `${base}/carte` },
  ];
  const qv: Chiffre[] = [{ n: String(carte.length), libelle: 'vins sur la carte', lien: `${base}/carte` }];
  if (cave) {
    const groupes = regrouperVins(vins.filter((v) => !v.frigo)).map((g) => ({ ...g, disponible: g.tous.some((x) => x.disponible) }));
    const bas = groupes.filter((g) => g.disponible && stockBas(g.principal.stock, r?.stock_limite_basse ?? 2)).length;
    qv.push(
      { n: groupes.reduce((n, g) => n + g.principal.stock, 0).toLocaleString('fr-BE'), libelle: 'bouteilles en stock', lien: `${base}/stocks` },
      { n: String(bas), libelle: bas > 1 ? 'vins en stock bas' : 'vin en stock bas', lien: `${base}/stocks?filtre=bas`, alerte: bas > 0 },
      { n: euros(groupes.reduce((n, g) => n + (achats.get(g.principal.id) ?? 0) * g.principal.stock, 0)), libelle: 'valeur du stock HTVA', lien: `${base}/stocks` },
      { n: String(ouvertes.length), libelle: ouvertes.length > 1 ? 'commandes en cours' : 'commande en cours', lien: `${base}/commandes` },
    );
  }
  return { pat, qv };
}

const Chiffres = ({ liste }: { liste: Chiffre[] }) => (
  <div className="ha-chiffres">
    {liste.map((c) => (
      <Link key={c.libelle} href={c.lien} className={`ha-chiffre${c.alerte ? ' alerte' : ''}`}><b>{c.n}</b><span>{c.libelle}</span></Link>
    ))}
  </div>
);

const CarteQv = ({ children }: { children?: React.ReactNode }) => (
  <section className="ha-carte ha-qv">
    <div className="ha-carte-tete">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/quidvinum/icone.png" alt="" width={44} height={44} />
      <span><b>Quid Vinum</b><small>pour vous restaurateur</small></span>
    </div>
    <p>Gestion de stock, commandes et carte des vins au même endroit : Quid Vinum vous fait gagner du temps et de l’argent.</p>
    {children}
  </section>
);

const CartePat = ({ children }: { children?: React.ReactNode }) => (
  <section className="ha-carte ha-pat">
    <div className="ha-carte-tete">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pat/pat-avatar.svg" alt="" width={44} height={44} />
      <span><b>Pat le sommelier</b><small>pour vos clients à table</small></span>
    </div>
    <p>Un QR code sur la table permet à chaque client de trouver rapidement le vin qui accompagnera parfaitement son plat.</p>
    {children}
  </section>
);

/** Le QR code des tables (celui du chevalet), avec le lien vers son impression. */
const QrCode = ({ resto, taille = 132 }: { resto: string; taille?: number }) => (
  <div className="ha-qr">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/admin/${resto}/acces/qr?affichage=1`} alt="QR code de votre app" width={taille} height={taille} />
    <span><b>Votre QR code</b><small>Scannez-le pour essayer l’app, comme vos clients.</small>
      <Link href={`/admin/${resto}/chevalet`} className="btn sec petit">Imprimer le chevalet</Link></span>
  </div>
);

/** L'app du restaurant, vivante, dans un petit téléphone (lien vers le simulateur). */
const Telephone = ({ resto, echelle = 0.5 }: { resto: string; echelle?: number }) => (
  <Link href={`/admin/${resto}/simulateur`} className="ha-tel" style={{ width: 390 * echelle + 16, height: 800 * echelle + 16 }} aria-label="Ouvrir le simulateur">
    <iframe src={`/${resto}`} title="Votre app, comme vos clients la voient" tabIndex={-1} style={{ transform: `scale(${echelle})` }} />
  </Link>
);

export async function AccueilResto({ resto, cave, entete, etape }: {
  resto: string; cave: boolean;
  /** « Bonjour Patrick » et la date. */
  entete: React.ReactNode;
  /** La prochaine étape conseillée (bandeau fin), s'il y en a une. */
  etape: React.ReactNode;
}) {
  const { pat, qv } = await chiffres(resto, cave);
  return (
    <div className="ha ha-b">
      <div className="ha-b-gauche">
        {entete}
        {etape}
        <CartePat><Chiffres liste={pat} /></CartePat>
        <CarteQv>
          <Chiffres liste={qv} />
          {!cave && <p className="petit discret" style={{ margin: 0 }}>{MESSAGE_CARTE_A_VALIDER}.</p>}
        </CarteQv>
      </div>
      <aside className="ha-b-droite">
        <Telephone resto={resto} echelle={0.62} />
        <QrCode resto={resto} taille={110} />
      </aside>
    </div>
  );
}
