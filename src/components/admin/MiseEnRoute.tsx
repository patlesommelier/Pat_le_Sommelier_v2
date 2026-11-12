import Link from 'next/link';
import type { RegleDuJour } from '@/lib/admin/donnees';
import { titreCarte } from '@/lib/admin/intitule';
import { sansContenance } from '@/lib/format';

const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;

/**
 * Tableau de bord d'un restaurant inscrit seul, tant qu'aucun client n'a encore ouvert l'app : trois pas pour être prêt.
 * 1. Voir ce que ses clients vont vivre (un vrai accord de sa carte), et l'essayer comme un client.
 * 2. Vérifier ce que la lecture des cartes n'a pas trouvé (vins et plats sans prix).
 * 3. Poser le QR code sur les tables.
 */
export function MiseEnRoute({ resto, app, exemple, verifier }: {
  resto: string; app: string; exemple: RegleDuJour | null; verifier: { vins: { id: string; nom: string }[]; plats: { id: string; nom: string }[] };
}) {
  const vin = exemple && titreCarte(exemple.vin);
  const manques = verifier.vins.length + verifier.plats.length;
  return (
    <section className="pile" style={{ gap: 18 }} aria-labelledby="mise-en-route">
      <div className="pile" style={{ gap: 6 }}>
        <span className="surtitre">Votre mise en route</span>
        <h2 id="mise-en-route" style={{ fontSize: 26 }}>Votre app est prête : plus que 3 pas</h2>
        <p className="discret" style={{ margin: 0, fontSize: 15.5 }}>Ce bloc disparaît dès que votre premier client aura utilisé l’app.</p>
      </div>

      <div className="mise-en-route">
        {/* 1. Le moment « waouh » : un vrai plat, un vrai vin de sa carte, et l'explication de Pat. */}
        <article className="carte-bo pile" style={{ gap: 14 }}>
          <span className="pas-mise-en-route">1</span>
          <h3 style={{ fontSize: 20 }}>Voyez ce que vos clients vont vivre</h3>
          {exemple && vin ? (
            <div className="pile" style={{ gap: 10, padding: 16, borderRadius: 14, background: 'var(--fond)', border: '1px solid var(--ligne)' }}>
              <span className="surtitre">Le client choisit : {exemple.plat}</span>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {exemple.vin.etiquette_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={exemple.vin.etiquette_url} alt="" style={{ width: 56, maxHeight: 84, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
                )}
                <div className="pile" style={{ gap: 2 }}>
                  <span className="discret" style={{ fontSize: 13.5 }}>Pat lui propose</span>
                  <b style={{ fontSize: 17 }}>{vin.titre}</b>
                  {vin.sousTitre && <span className="discret" style={{ fontSize: 14 }}>{vin.sousTitre}</span>}
                </div>
              </div>
              {exemple.explication && (
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, paddingLeft: 12, borderLeft: '3px solid var(--rouge)' }}>{sansContenance(exemple.explication)}</p>
              )}
            </div>
          ) : <p className="discret" style={{ margin: 0 }}>Choisissez un de vos plats : Pat vous propose le vin de votre carte qui l’accompagne, et vous dit pourquoi.</p>}
          <div className="ligne-actions mise-en-route-action">
            <Link href={`/admin/${resto}/simulateur`} className="btn">Ouvrir le simulateur →</Link>
            <a href={app} target="_blank" rel="noopener" className="btn sec petit">Ouvrir l’app comme un client</a>
          </div>
        </article>

        {/* 2. Vérifier la carte des vins lue par Pat (noms, prix, contenances), dans la page de la carte. */}
        <article className="carte-bo pile" style={{ gap: 14 }}>
          <span className="pas-mise-en-route">2</span>
          <h3 style={{ fontSize: 20 }}>Vérifiez la lecture de votre carte</h3>
          <p className="discret" style={{ margin: 0, fontSize: 15 }}>
            Relisez vos vins tels que Pat les a lus : leurs noms, leurs prix et leurs contenances.
            {manques > 0 && <> Il manque encore le prix de {[verifier.vins.length && pl(verifier.vins.length, 'vin'), verifier.plats.length && pl(verifier.plats.length, 'plat')].filter(Boolean).join(' et ')}.</>}
          </p>
          <div className="ligne-actions mise-en-route-action">
            <Link href={`/admin/${resto}/carte`} className="btn">Vérifier ma carte des vins →</Link>
            <Link href={`/admin/${resto}/menu`} className="btn sec petit">Vérifier mon menu</Link>
          </div>
        </article>

        {/* 3. Le QR code sur les tables. */}
        <article className="carte-bo pile" style={{ gap: 14 }}>
          <span className="pas-mise-en-route">3</span>
          <h3 style={{ fontSize: 20 }}>Posez le QR code sur vos tables</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/admin/${resto}/acces/qr?affichage=1`} alt="Votre QR code" width={112} height={112}
              style={{ padding: 6, borderRadius: 12, border: '1px solid var(--ligne)', background: '#FFFFFF' }} />
            <p className="discret" style={{ margin: 0, fontSize: 15, flex: '1 1 160px' }}>Vos clients le scannent avec leur téléphone : Pat les conseille à table.</p>
          </div>
          <div className="ligne-actions mise-en-route-action">
            <Link href={`/admin/${resto}/chevalet`} className="btn">Imprimer un chevalet de table</Link>
            <a href={`/admin/${resto}/acces/qr?format=png`} download className="btn sec petit">Télécharger l’image</a>
          </div>
        </article>
      </div>
    </section>
  );
}
