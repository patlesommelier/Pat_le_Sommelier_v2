import Link from 'next/link';
import { Icone } from '@/components/admin/Icone';
import { ApercuApp } from '@/components/admin/ApercuApp';
import { requete } from '@/lib/db';
import { Entete, Points, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getPlatsBO } from '@/lib/admin/donnees';
import { pourquoiRetenu } from '@/lib/admin/explications';
import { accordsVisibles, getCandidats, getReglages } from '@/lib/donnees';
import { selectionner, tourSuivant } from '@/lib/selection';

export default async function Simulateur({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ plat?: string | string[]; arelire?: string; tour?: string; bienvenue?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const bienvenue = sp.bienvenue === '1';
  const [plats, R, u, avecAccords] = await Promise.all([getPlatsBO(resto), getReglages(resto), utilisateurCourant(),
    // Plats que l'app sait montrer (au moins un accord visible des clients) : le téléphone n'ouvre jamais une page vide.
    requete<{ plat_id: string }>('select distinct plat_id from accord where restaurant_id = $1 and statut = any($2)', [resto, accordsVisibles()])
      .then((r) => new Set(r.map((x) => x.plat_id)))]);
  // Score et rankings : cuisine interne, montrés à Pat seulement. Le restaurant voit le rang et la note /5.
  const interne = Boolean(u?.admin);
  const actifs = plats.filter((p) => p.actif);
  // Sans plat demandé : le premier plat du menu qui a des accords. Arrivée après l'inscription : aucun, le téléphone montre
  // le menu de l'app et le restaurateur choisit lui-même son plat, comme un client.
  const parDefaut = bienvenue ? undefined : actifs.find((p) => avecAccords.has(p.id))?.id ?? actifs[0]?.id;
  const choisis = (Array.isArray(sp.plat) ? sp.plat : sp.plat ? [sp.plat] : parDefaut ? [parDefaut] : []).filter((id) => actifs.some((p) => p.id === id)) as string[];
  const arelire = sp.arelire === '1';
  const tour = Math.max(1, Math.min(5, Number(sp.tour) || 1));
  const statuts = arelire ? ['valide', 'propose'] : accordsVisibles();
  const { candidats, lignesParVin, exclus } = choisis.length ? await getCandidats(resto, choisis, statuts) : { candidats: [], lignesParVin: new Map(), exclus: new Set<string>() };
  const suggestion = actifs.some((p) => choisis.includes(p.id) && p.categorie === 'suggestion');
  const sel = selectionner(candidats, choisis, { reglages: R, suggestion });
  // Tours suivants : chaque tour reprend là où le précédent s'est arrêté.
  const proposes = sel.liste.map((r) => r.vin.id);
  let liste = sel.liste;
  for (let t = 2; t <= tour; t++) {
    liste = tourSuivant(sel, proposes, R.tourSuivant, R.diversite && choisis.length === 1, R.plafondBulles, R.bullesApres);
    proposes.push(...liste.map((r) => r.vin.id));
  }
  const elimines = candidats.filter((c) => choisis.every((p) => typeof c.notes[p] === 'number') && Math.min(...choisis.map((p) => c.notes[p])) <= R.noteEliminatoire).length;
  const plusieurs = choisis.length > 1;
  const nomPlat = (id: string) => { const p = actifs.find((x) => x.id === id); return p?.nom_court ?? p?.nom ?? id; };

  return (
    <>
      <Entete titre="Simulateur" />
      <div className="rangee">
        {/* Le téléphone : la vraie app, où l'on choisit ses plats comme un client ; la page suit le plat choisi. */}
          <div style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span className="surtitre">L’app de vos clients</span>
            <ApercuApp resto={resto} garder={bienvenue ? { bienvenue: '1' } : {}}
              src={!choisis[0] || !avecAccords.has(choisis[0]) ? `/${resto}` : `/${resto}/plat/${encodeURIComponent(choisis[0])}?${new URLSearchParams({ ...(choisis.length > 1 ? { et: choisis.slice(1).join(',') } : {}), ...(tour > 1 ? { tour: String(tour) } : {}) })}`} />
            <span className="discret" style={{ fontSize: 13, textAlign: 'center' }}>{choisis[0] ? 'Touchez l’écran pour choisir un autre plat.' : 'Touchez l’écran pour choisir un plat.'}</span>
          </div>
        {!choisis.length ? (
          <section className="large" style={{ flex: '1 1 340px' }}>
            {/* Le QR code de l'app : scanné avec son téléphone, on vit l'app comme un client, à table. */}
            <div className="carte-bo" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/admin/${resto}/acces/qr?affichage=1`} alt="QR code de votre app" width={96} height={96}
                style={{ padding: 6, borderRadius: 12, border: '1px solid var(--ligne)', background: '#FFFFFF', flexShrink: 0 }} />
              <span className="discret" style={{ fontSize: 15 }}>Scannez-le avec votre téléphone pour essayer l’app à table, comme vos clients.</span>
            </div>
            <div className="carte-bo pile">
              <div className="ligne-actions">
                <Link href={`/admin/${resto}/regles`} className="btn sec petit"><Icone nom="sliders" taille={16} />Ajuster les règles</Link>
                <Link href={`/admin/${resto}/accords`} className="btn sec petit"><Icone nom="link" taille={16} />Revoir les accords</Link>
              </div>
            </div>
          </section>
        ) : <section className="large" style={{ flex: '1 1 340px' }}>
            {/* Le QR code de l'app : scanné avec son téléphone, on vit l'app comme un client, à table. */}
            <div className="carte-bo" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/admin/${resto}/acces/qr?affichage=1`} alt="QR code de votre app" width={96} height={96}
                style={{ padding: 6, borderRadius: 12, border: '1px solid var(--ligne)', background: '#FFFFFF', flexShrink: 0 }} />
              <span className="discret" style={{ fontSize: 15 }}>Scannez-le avec votre téléphone pour essayer l’app à table, comme vos clients.</span>
            </div>
          <div className="carte-bo pile">
            <div>
              <h2>Pourquoi ces vins ?</h2>
              <p className="sous">{plusieurs ? `Un vin pour toute la table (${choisis.map(nomPlat).join(' + ')}) : la note la plus basse compte.` : `${nomPlat(choisis[0] ?? '')}${tour > 1 ? ` · tour ${tour}` : ''}`}{interne ? ' · note · score' : ' · rang · note /5 · prix'}</p>
            </div>
            {!liste.length && <p className="discret">{tour > 1 ? 'Plus aucun vin assez bien noté : Pat propose de revenir aux premières propositions.' : 'Aucun vin ne s’accorde assez bien.'}</p>}
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {liste.map((r, i) => (
                <li key={r.vin.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--encre)', color: '#EFEBE9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                  <Vignette url={r.vin.etiquette_url} taille={44} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <b>{r.vin.libelle}</b>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--encre)', fontWeight: 700 }}><Points note={r.note} />{interne ? `${r.note}/5 · score ${r.score}` : `${r.note}/5`} · {euros(r.vin.prix ?? r.vin.prix_verre)}</span>
                    <span className="discret" style={{ fontSize: 13.5 }}>{pourquoiRetenu(r, i + 1, liste, interne)}</span>
                    {plusieurs && <span className="discret" style={{ fontSize: 12.5 }}>{choisis.map((p) => `${nomPlat(p)} ${r.vin.notes[p]}`).join(' · ')}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <span className="discret" style={{ fontSize: 13 }}>{elimines} vin{elimines > 1 ? 's' : ''} trop faible{elimines > 1 ? 's' : ''} avec {plusieurs ? 'ces plats' : 'ce plat'}{exclus.size ? ` · ${exclus.size} vin${exclus.size > 1 ? 's' : ''} que vous avez retiré${exclus.size > 1 ? 's' : ''}` : ''}.</span>
            <div className="ligne-actions">
              <Link href={`/admin/${resto}/regles`} className="btn sec petit"><Icone nom="sliders" taille={16} />Ajuster les règles</Link>
              <Link href={`/admin/${resto}/accords${choisis[0] ? `?plat=${encodeURIComponent(choisis[0])}` : ''}`} className="btn sec petit"><Icone nom="link" taille={16} />Revoir les accords</Link>
            </div>
            {lignesParVin.size === 0 && choisis.length > 0 && <p className="discret">{!plusieurs && !avecAccords.has(choisis[0]) ? 'Pat n’a pas encore d’accord pour ce plat : ouvrez « Revoir les accords » pour les préparer.' : `Aucun accord ${arelire ? '' : 'validé '}pour ${plusieurs ? 'ces plats' : 'ce plat'}${arelire ? '.' : ' : relisez ses accords pour que vos clients voient des vins.'}`}</p>}
          </div>
        </section>}
      </div>
    </>
  );
}
