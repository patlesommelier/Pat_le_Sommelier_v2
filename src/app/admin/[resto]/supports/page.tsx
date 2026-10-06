import { autrePresentation, enregistrerPresentation } from '../../actions';
import { BoutonCarteImprimee } from '@/components/admin/BoutonCarteImprimee';
import { Entete, Message } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export const dynamic = 'force-dynamic';

const COULEURS: [string, string][] = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux']];

/** Rubrique « Supports » : la carte des vins imprimable et la relecture des présentations de Pat (3 à 4 lignes par vin). */
export default async function Supports({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; nouvelle?: string; erreur?: string }> }) {
  const { resto } = await params;
  const sp = await searchParams;
  await exigerAcces(resto);
  // Champs publics des vins seulement : jamais de ranking ni de score.
  const vins = await requete<{ id: string; libelle: string; millesime: string | null; format: string; couleur: string; presentation_carte: string | null; presentation_carte_perso: string | null }>(
    `select id, libelle, nullif(millesime, 'NM') as millesime, format, couleur::text as couleur, presentation_carte, presentation_carte_perso
       from vin_carte where restaurant_id = $1 and disponible order by ordre`, [resto]);
  const sans = vins.filter((v) => !v.presentation_carte && !v.presentation_carte_perso).length;
  const perso = vins.filter((v) => v.presentation_carte_perso).length;

  return (
    <>
      <Entete titre="Imprimer la carte des vins" texte="La carte des vins à imprimer ou à enregistrer en PDF : couverture avec votre logo et le QR code, puis chaque vin présenté par Pat en trois à quatre lignes.">
        <BoutonCarteImprimee resto={resto} />
      </Entete>
      <div className="carte-bo pile" style={{ gap: 6, padding: '16px 20px' }}>
        <strong>Format, couleurs et contenu se règlent sur la carte elle-même</strong>
        <span className="discret">A4 ou A5, couleur du restaurant ou noir et blanc, ordre de l’app ou par prix ; présentations, producteurs et millésimes, couverture, rappel « Demandez à Pat ». Puis « Imprimer / Enregistrer en PDF ». Les présentations manquantes sont écrites par Pat avant l’ouverture.</span>
      </div>

      <section className="pile" style={{ gap: 14 }}>
        <div>
          <h2>Relire les présentations</h2>
          <p className="discret" style={{ margin: '6px 0 0' }}>
            {vins.length} vins · {vins.length - sans} présentés{perso ? ` · ${perso} corrigés par vous` : ''}{sans ? ` · ${sans} encore sans texte (Pat les écrira à l’impression)` : ''}.
            Votre texte prime sur celui de Pat et n’est jamais réécrit ; « Autre proposition » demande un nouveau texte à Pat.
          </p>
        </div>
        <Message erreur={sp.erreur} ok={sp.nouvelle ? 'Nouvelle proposition de Pat enregistrée.' : sp.ok ? 'Présentation enregistrée.' : undefined} />
        {COULEURS.map(([c, titre]) => {
          const liste = vins.filter((v) => v.couleur === c);
          if (!liste.length) return null;
          return (
            <div key={c} className="pile" style={{ gap: 10 }}>
              <h3 style={{ fontSize: 18 }}>{titre}</h3>
              {liste.map((v) => {
                const texte = v.presentation_carte_perso ?? v.presentation_carte;
                return (
                  <article key={v.id} id={v.id} className="carte-bo pile" style={{ gap: 8, padding: '14px 18px', scrollMarginTop: 16,
                    outline: sp.ok === v.id || sp.nouvelle === v.id ? '2px solid var(--encre)' : undefined }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <b>{v.libelle}{v.millesime ? ` ${v.millesime}` : ''}{v.format && v.format !== '75 cl' ? <span className="discret" style={{ fontWeight: 400 }}> · {v.format}</span> : null}</b>
                      <span className="petit discret">{v.presentation_carte_perso ? 'Votre texte' : v.presentation_carte ? 'Texte de Pat' : 'Pas encore écrite'}</span>
                    </div>
                    <form action={enregistrerPresentation.bind(null, resto, v.id)} className="pile" style={{ gap: 8 }}>
                      <textarea name="presentation" rows={3} maxLength={600} defaultValue={texte ?? ''} aria-label={`Présentation de ${v.libelle}`}
                        placeholder="Pat écrira cette présentation à l’impression, ou écrivez-la ici."
                        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid var(--ligne)', font: '15px/1.45 Lato, sans-serif' }} />
                      <span className="ligne-actions">
                        <button className="btn petit">Enregistrer</button>
                        <button className="btn sec petit" formAction={autrePresentation.bind(null, resto, v.id)}>Autre proposition</button>
                      </span>
                    </form>
                  </article>
                );
              })}
            </div>
          );
        })}
      </section>
    </>
  );
}
