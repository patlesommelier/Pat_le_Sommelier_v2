import Link from 'next/link';
import { changerNote, modifierCommentaire, regenererTout, relancerPlatsSansAccord, validerPlat, validerTout } from '../../actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { ChoixNote } from '@/components/admin/ChoixNote';
import { Icone } from '@/components/admin/Icone';
import { PatAttente } from '@/components/PatAttente';
import { Entete, Etat, Message, Points, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getPlatsBO, getResume, getStatsAccordsParPlat } from '@/lib/admin/donnees';
import { LIBELLES_REGLAGES, pourquoiPas, raisonEcart } from '@/lib/admin/explications';
import { requete } from '@/lib/db';
import { getCandidats, getCarte, getReglages } from '@/lib/donnees';
import { parametresEnService } from '@/lib/regles/versions';
import { etatDernierLot, type EtatLot } from '@/lib/generation/file';
import { selectionner, tourSuivant, type Reglages } from '@/lib/selection';

const dateHeure = (d: string) => new Date(d).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const CAT: Record<string, string> = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert', fromage: 'Fromage' };

export default async function Accords({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ plat?: string; ok?: string; tous?: string; regeneration?: string; erreur?: string; commentaire?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [plats, stats, resume, R, u, etat, [derniere]] = await Promise.all([getPlatsBO(resto), getStatsAccordsParPlat(resto), getResume(resto), getReglages(resto), utilisateurCourant(), etatDernierLot(requete, resto),
    requete<{ le: string | null }>('select max(coalesce(regenere_le, explication_generee_le, calcule_le)) as le from accord where restaurant_id = $1', [resto])]);
  // Commentaires d'origine (import) pas encore réécrits par une régénération : souvent identiques d'un vin à l'autre.
  const anciens = new Map((await requete<{ plat_id: string; n: number }>(
    `select a.plat_id, count(*)::int as n from accord a join vin_carte v on v.id = a.vin_id and v.disponible
      where a.restaurant_id = $1 and a.regenere_le is null and a.statut <> 'refuse' and a.commentaire_sommelier is null group by a.plat_id`, [resto])).map((a) => [a.plat_id, a.n]));
  // Score et rankings : cuisine interne de Pat. Le classement est calculé ici, côté serveur ;
  // un compte restaurant ne reçoit que le rang et la note d’accord /5.
  const interne = Boolean(u?.admin);
  const actifs = plats.filter((p) => p.actif);
  const parPlat = new Map(stats.map((s) => [s.plat_id, s]));
  const sansAccord = plats.filter((p) => p.actif && !parPlat.has(p.id));
  // Plats dont les accords viennent encore de la passe rapide de l'inscription (Sonnet) : signalé au super-admin.
  const [{ rapides }] = interne ? await requete<{ rapides: number }>(
    `select count(*)::int as rapides from plat pl where pl.restaurant_id = $1 and pl.actif
        and (select g.modele from generation_accords g where g.plat_id = pl.id and g.statut = 'fait' order by g.id desc limit 1) is not null`, [resto])
    : [{ rapides: 0 }];
  const plat = actifs.find((p) => p.id === sp.plat) ?? actifs[0];
  const platsAnciens = actifs.filter((p) => anciens.get(p.id)).length;
  // Motif d'échec le plus fréquent de la dernière régénération (pour comprendre sans ouvrir les journaux).
  const raison = etat?.erreurs.map((e) => e.message ?? 'échec').sort((a, b) => etat.erreurs.filter((e) => e.message === b).length - etat.erreurs.filter((e) => e.message === a).length)[0]?.slice(0, 120);

  if (!resume.accords) {
    return (
      <>
        <Entete titre="Accords mets & vins" texte="Pat note chaque vin de votre carte sur chaque plat, de 1 à 5, avec sa méthode d’accord. Vos règles du sommelier choisissent ensuite les vins proposés au client." />
        <div className="carte-bo sticker pile">
          <h2>Les accords ne sont pas encore générés</h2>
          <p className="sous">Pat peut noter chaque vin de votre carte sur chaque plat et écrire le commentaire d’accord. Comptez quelques minutes pour toute la carte.</p>
          <form action={regenererTout.bind(null, resto)}><button className="btn"><Icone nom="reset" taille={18} />Générer tous les accords</button></form>
        </div>
        <SuiviRegeneration etat={etat} demande={sp.regeneration} erreur={sp.erreur} />
      </>
    );
  }

  // Ce que verra le client une fois les accords validés : sélection sur les accords proposés et validés.
  const { candidats, lignesParVin, exclus } = plat ? await getCandidats(resto, [plat.id], ['valide', 'propose']) : { candidats: [], lignesParVin: new Map(), exclus: new Set<string>() };
  // Logique de sélection (super-admin) : réglages en vigueur, vins hors classement et pourquoi.
  const logique = interne && plat ? await (async () => {
    const [base, carte, [brut], refuses] = await Promise.all([parametresEnService(requete), getCarte(resto),
      requete<{ reglages_selection: Record<string, unknown> | null }>('select reglages_selection from restaurant where id = $1', [resto]),
      requete<{ vin_id: string }>(`select vin_id from accord where plat_id = $1 and statut = 'refuse'`, [plat.id])]);
    const notes = new Set(candidats.map((c) => c.id));
    const refus = new Set(refuses.map((r) => r.vin_id));
    return {
      base, ajustes: Object.keys(brut?.reglages_selection ?? {}) as (keyof Reglages)[],
      carte: carte.length,
      exclus: carte.filter((v) => exclus.has(v.id)),
      refuses: carte.filter((v) => !exclus.has(v.id) && refus.has(v.id)),
      sansNote: carte.filter((v) => !notes.has(v.id) && !exclus.has(v.id) && !refus.has(v.id)),
    };
  })() : null;
  const sel = plat ? selectionner(candidats, [plat.id], { reglages: R }) : { liste: [], classement: [] };
  const retenus = new Set(sel.liste.map((r) => r.vin.id));
  const tour2 = new Set(tourSuivant(sel, [...retenus], R.tourSuivant, R.diversite, R.plafondBulles).map((r) => r.vin.id));
  const tous = [...candidats]
    .map((c) => ({ vin: c, note: c.notes[plat!.id], score: c.notes[plat!.id] + (c.ranking_producteur ?? 0) }))
    .sort((a, b) => b.score - a.score || b.note - a.note || a.vin.ordre - b.vin.ordre);
  const ordre = [...sel.liste.map((r) => r.vin.id), ...tous.map((t) => t.vin.id).filter((id) => !retenus.has(id))];
  const triComplet = tous.sort((a, b) => ordre.indexOf(a.vin.id) - ordre.indexOf(b.vin.id));
  const tri = sp.tous ? triComplet : triComplet.slice(0, 12);
  const s = plat ? parPlat.get(plat.id) : undefined;
  // « Limite » des commentaires générés : chargée pour Pat seulement.
  // Dernier passage de la régénération sur ce plat : bilan ou motif d'échec (pour comprendre un commentaire d'origine resté).
  const [bilanPlat] = plat && (anciens.get(plat.id) || !s) ? await requete<{ statut: string; message: string | null; le: string }>(
    `select statut, message, coalesce(fin_le, cree_le) as le from generation_accords where plat_id = $1 and statut in ('fait', 'erreur') order by id desc limit 1`, [plat.id]) : [];
  const prix = sel.liste.map((r) => r.vin.prix).filter((p): p is number => p !== null);

  return (
    <>
      <Entete titre="Accords mets & vins" texte="Pat note chaque vin de votre carte sur chaque plat, de 1 à 5. Vos règles du sommelier choisissent ensuite les vins proposés au client. Changez une note : la sélection se recalcule." />
      <div className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px 20px', padding: '16px 20px' }}>
        <span style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong>{resume.accords.toLocaleString('fr-BE')} accords · {resume.plats_avec_accords} plats × {resume.vins} vins</strong>
          <span className="discret">{resume.accords_proposes ? 'Les accords « proposés » ne sont montrés aux clients qu’une fois validés.' : 'Tous les accords sont validés.'}</span>
        </span>
        <span className="ligne-actions"><Etat type="propose">{resume.accords_proposes.toLocaleString('fr-BE')} à relire</Etat><Etat type="ok">{resume.accords_valides.toLocaleString('fr-BE')} validés</Etat></span>
        {resume.accords_proposes > 0 && <form action={validerTout.bind(null, resto)}><button className="btn petit"><Icone nom="check" taille={18} />Tout valider</button></form>}
        <span className="pile" style={{ gap: 4, alignItems: 'flex-start' }}>
          <form action={regenererTout.bind(null, resto)}><button className="btn sec petit" title="Pat recalcule les notes et les commentaires de tous les plats ; vos notes changées à la main sont gardées."><Icone nom="reset" taille={18} />Régénérer tous les accords</button></form>
          {derniere?.le && <span className="discret" style={{ fontSize: 12.5 }}>Dernière génération : {dateHeure(derniere.le)}</span>}
          {(!etat || etat.termine) && platsAnciens > 0 && <span style={{ fontSize: 12.5, color: 'var(--ocre)', maxWidth: 360 }}>
            {platsAnciens} plat{platsAnciens > 1 ? 's gardent' : ' garde'} des commentaires d’origine{raison ? ` (${raison})` : ''} : relancez la régénération.</span>}
        </span>
      </div>
      <SuiviRegeneration etat={etat} demande={sp.regeneration} erreur={sp.erreur} />
      {interne && rapides > 0 && (!etat || etat.termine) && (
        <div className="carte-bo pile" style={{ gap: 6, padding: '14px 20px', borderColor: 'var(--ocre)' }}>
          <strong>Accords de la passe rapide sur {rapides} plat{rapides > 1 ? 's' : ''}</strong>
          <span className="discret">À l’inscription, Pat écrit les premiers accords avec Sonnet pour que le restaurant les ait vite. « Régénérer tous les accords » les refait avec Opus.</span>
        </div>
      )}
      {(!etat || etat.termine) && sansAccord.length > 0 && (
        <div className="carte-bo pile" style={{ gap: 8, padding: '16px 20px', borderColor: 'var(--ocre)' }}>
          <strong>{sansAccord.length} plat{sansAccord.length > 1 ? 's n’ont' : ' n’a'} encore aucun accord</strong>
          <span className="discret">{etat?.erreurs.length ? 'La dernière génération n’a pas abouti pour ces plats.' : 'Ces plats n’ont pas encore été générés.'}
            {interne && etat?.erreurs.length ? ` Motif : ${[...new Set(etat.erreurs.map((e) => (e.message ?? 'inconnu').slice(0, 160)))].slice(0, 3).join(' · ')}` : ''}</span>
          <form action={relancerPlatsSansAccord.bind(null, resto)}><button className="btn sec petit"><Icone nom="reset" taille={18} />Relancer les plats sans accord</button></form>
        </div>
      )}
      <div className="rangee">
        <nav aria-label="Plats" className="etroit" style={{ flex: '1 1 240px', gap: 6 }}>
          {actifs.map((p) => {
            const st = parPlat.get(p.id);
            const on = p.id === plat?.id;
            return (
              <Link key={p.id} href={`/admin/${resto}/accords?plat=${p.id}`} aria-current={on ? 'true' : undefined}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 48, padding: '8px 14px', borderRadius: 12, textDecoration: 'none',
                  background: on ? 'var(--encre)' : '#FFF', color: on ? '#FFF' : 'var(--texte)', border: `1px solid ${on ? 'var(--encre)' : 'var(--ligne)'}` }}>
                <span style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontSize: 14.5 }}>{p.nom_court ?? p.nom}</b><span style={{ fontSize: 12.5, opacity: 0.8 }}>{CAT[p.categorie]}</span></span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{!st ? 'aucun' : st.valides === st.total ? 'validé' : `${st.total - st.valides} à relire`}
                  {anciens.get(p.id) ? <span style={{ fontWeight: 400, opacity: 0.85 }}>textes d’origine</span> : null}</span>
              </Link>
            );
          })}
        </nav>
        {plat && (
          <section className="large" style={{ gap: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div className="pile" style={{ gap: 6 }}><span className="surtitre">{CAT[plat.categorie]} · {plat.prix_variantes ?? euros(plat.prix)}</span><h2 style={{ fontSize: 26, fontWeight: 800 }}>{plat.nom}</h2></div>
              <span className="ligne-actions">
                <Link href={`/admin/${resto}/simulateur?plat=${plat.id}`} className="btn sec petit"><Icone nom="phone" taille={18} />Simulateur</Link>
                {s && s.valides < s.total && <form action={validerPlat.bind(null, resto, plat.id)}><button className="btn petit"><Icone nom="check" taille={18} />Valider ce plat</button></form>}
              </span>
            </div>
            <Message ok={sp.ok ? 'Accords de ce plat validés.' : sp.commentaire ? 'Commentaire enregistré : c’est lui que le client lit.' : undefined} />
            {!s ? <span style={{ fontSize: 13.5, color: 'var(--ocre)' }}>
              Aucun accord pour ce plat{bilanPlat ? ` — dernière génération (${dateHeure(bilanPlat.le)}) : ${bilanPlat.statut === 'erreur' ? 'échec' : 'terminée sans accord'}${interne && bilanPlat.message ? `, ${bilanPlat.message.slice(0, 200)}` : ''}` : ' — pas encore généré'}.</span> : null}
            {anciens.get(plat.id) ? <span style={{ fontSize: 13.5, color: 'var(--ocre)' }}>
              {anciens.get(plat.id)} vin{anciens.get(plat.id)! > 1 ? 's gardent leur' : ' garde son'} commentaire d’origine sur ce plat
              {bilanPlat?.message ? ` — dernière régénération (${dateHeure(bilanPlat.le)}) : ${bilanPlat.statut === 'erreur' ? 'échec, ' : ''}${bilanPlat.message.length > 160 ? `${bilanPlat.message.slice(0, 160)}…` : bilanPlat.message}` : ' — ce plat n’a pas encore été régénéré'}.</span> : null}
            <div className="pile">
              <div><h3 style={{ fontSize: 20 }}>Ce que verra le client</h3>
                <p className="discret" style={{ margin: '6px 0 0' }}>{sel.liste.length ? `${sel.liste.length} vin${sel.liste.length > 1 ? 's' : ''}${prix.length ? `, de ${euros(Math.min(...prix))} à ${euros(Math.max(...prix))}` : ''}.` : 'Aucun vin ne s’accorde assez bien : Pat le dira au client et proposera d’en parler.'}</p></div>
              <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
                {sel.liste.map((r, i) => (
                  <div key={r.vin.id} className="carte-bo pile" style={{ padding: 16, gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Vignette url={r.vin.etiquette_url} taille={56} />
                      <div className="pile" style={{ gap: 3 }}><span className="surtitre" style={{ fontSize: 12, letterSpacing: 0 }}>N° {i + 1} · {r.vin.id}</span><b style={{ fontSize: 14.5, lineHeight: 1.25 }}>{r.vin.libelle}</b><b style={{ fontSize: 13.5 }}>{euros(r.vin.prix ?? r.vin.prix_verre)}</b></div></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Points note={r.note} />{interne
                      ? <span className="discret" style={{ fontSize: 13 }}>score <b style={{ color: 'var(--texte)' }}>{r.score}</b></span>
                      : <span className="discret" style={{ fontSize: 13 }}>note <b style={{ color: 'var(--texte)' }}>{r.note}/5</b></span>}</div>
                    <Commentaire resto={resto} platId={plat.id} vinId={r.vin.id} ligne={lignesParVin.get(r.vin.id)?.[0]} tous={Boolean(sp.tous)} grand />
                  </div>
                ))}
              </div>
            </div>
            {logique && (
              <details className="carte-bo pile" style={{ padding: '14px 18px' }} open={!sel.liste.length}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Logique de sélection (super-admin)</summary>
                <div className="pile" style={{ gap: 10, marginTop: 10 }}>
                  <p style={{ margin: 0 }}>
                    {logique.carte} vins disponibles sur la carte · <b>{candidats.length}</b> notés sur ce plat
                    · {sel.classement.length} gardés après les règles 10 et 1 · <b>{sel.liste.length}</b> proposés
                    {logique.exclus.length ? ` · ${logique.exclus.length} exclu(s) par une règle ponctuelle` : ''}
                    {logique.refuses.length ? ` · ${logique.refuses.length} refusé(s)` : ''}
                    {logique.sansNote.length ? ` · ${logique.sansNote.length} sans note sur ce plat` : ''}.
                  </p>
                  {!sel.liste.length && (
                    <p style={{ margin: 0, color: 'var(--ocre)' }}>
                      {!candidats.length ? 'Aucun vin n’a de note sur ce plat : la génération n’a rien écrit (voir « Relancer les plats sans accord »).'
                        : !sel.classement.length ? `Tous les vins notés ont une note ≤ ${R.noteEliminatoire} (règle 1)${R.noteEliminatoire !== logique.base.noteEliminatoire ? ` — réglage du restaurant : ${R.noteEliminatoire} au lieu de ${logique.base.noteEliminatoire}` : ''}.`
                        : `Des vins passent les règles 1 et 10, mais aucun n’est retenu : vérifiez « ${LIBELLES_REGLAGES.premiers} » (${R.premiers}) et « ${LIBELLES_REGLAGES.plafondBulles} » (${R.plafondBulles}).`}
                    </p>
                  )}
                  <div className="tableau">
                    <table>
                      <thead><tr><th>Réglage</th><th className="droite">En vigueur</th><th className="droite">Pat</th><th /></tr></thead>
                      <tbody>{(Object.keys(LIBELLES_REGLAGES) as (keyof Reglages)[]).map((k) => {
                        const v = (x: unknown) => (typeof x === 'boolean' ? (x ? 'oui' : 'non') : String(x));
                        const different = R[k] !== logique.base[k];
                        return (
                          <tr key={k}><td>{LIBELLES_REGLAGES[k]}</td><td className="droite"><b>{v(R[k])}</b></td><td className="droite">{v(logique.base[k])}</td>
                            <td>{different ? <Etat type="propose">{logique.ajustes.includes(k) ? 'ajusté par le restaurant' : 'différent'}</Etat> : null}</td></tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                  {(logique.sansNote.length > 0 || logique.exclus.length > 0 || logique.refuses.length > 0) && (
                    <div className="pile" style={{ gap: 4 }}>
                      <b>Vins hors classement</b>
                      {logique.exclus.map((v) => <span key={v.id} className="petit">{v.libelle} — exclu par une règle ponctuelle (Règles du sommelier)</span>)}
                      {logique.refuses.map((v) => <span key={v.id} className="petit">{v.libelle} — accord refusé sur ce plat</span>)}
                      {logique.sansNote.slice(0, 15).map((v) => <span key={v.id} className="petit">{v.libelle} — pas de note sur ce plat (à régénérer)</span>)}
                      {logique.sansNote.length > 15 && <span className="petit discret">… et {logique.sansNote.length - 15} autre(s)</span>}
                    </div>
                  )}
                </div>
              </details>
            )}
            <div className="pile">
              <div><h3 style={{ fontSize: 20 }}>Classement complet</h3><p className="discret" style={{ margin: '6px 0 0' }}>{interne ? 'Classé par score de Pat.' : 'Pat classe les vins à partir de la note d’accord et de sa propre sélection.'}</p></div>
              <div className="tableau">
                <table style={{ minWidth: 900 }}>
                  <thead><tr><th className="droite">Rang</th><th>Vin</th><th>Note</th>{interne && <th className="droite">Score</th>}<th>Pourquoi (Pat)</th><th>Résultat</th></tr></thead>
                  <tbody>
                    {tri.map((t, rang) => {
                      const l = lignesParVin.get(t.vin.id)?.[0];
                      const [res, rk] = retenus.has(t.vin.id) ? [`Proposé · n° ${sel.liste.findIndex((r) => r.vin.id === t.vin.id) + 1}`, 'ok' as const]
                        : interne ? [raisonEcart(t, R, sel, tour2), (t.note <= R.noteEliminatoire ? 'defaut' : tour2.has(t.vin.id) ? 'propose' : '') as 'defaut' | 'propose' | '']
                        : pourquoiPas(t, R, sel.liste, tour2);
                      return (
                        <tr key={t.vin.id}>
                          <td className="droite"><b>{rang + 1}</b></td>
                          <td style={{ minWidth: 240 }}><div className="vin-cell"><Vignette url={t.vin.etiquette_url} taille={40} /><div><div className="nom">{t.vin.libelle}</div><div className="petit">{t.vin.id} · {euros(t.vin.prix ?? t.vin.prix_verre)}</div></div></div></td>
                          <td>
                            <form action={changerNote.bind(null, resto, plat.id, t.vin.id)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Points note={t.note} />{/* Clé = plat + note : la liste reprend la note à jour après une régénération ou un changement de plat. */}
                              <ChoixNote key={`${plat.id}-${t.note}`} note={t.note} libelle={t.vin.libelle} />
                              <noscript><button className="btn petit">OK</button></noscript>
                            </form>
                            {l?.statut === 'propose' && <span className="petit">à relire</span>}
                          </td>
                          {interne && <td className="droite"><b>{t.score}</b></td>}
                          <td className="petit" style={{ minWidth: 220, maxWidth: 340, lineHeight: 1.4 }}><Commentaire resto={resto} platId={plat.id} vinId={t.vin.id} ligne={l} tous={Boolean(sp.tous)} /></td>
                          <td><Etat type={rk}>{res}</Etat></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {triComplet.length > 12 && (sp.tous
                ? <Link href={`/admin/${resto}/accords?plat=${plat.id}`} className="lien-ligne">Ne montrer que les 12 premiers</Link>
                : <Link href={`/admin/${resto}/accords?plat=${plat.id}&tous=1`} className="lien-ligne">Voir les {triComplet.length} vins</Link>)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** Commentaire d'accord lu par le client, modifiable : le texte du restaurant remplace celui de Pat et n'est plus régénéré. */
function Commentaire({ resto, platId, vinId, ligne, tous, grand }: { resto: string; platId: string; vinId: string; ligne?: { explication: string | null; commentaire_sommelier?: string | null }; tous: boolean; grand?: boolean }) {
  const texte = ligne?.explication ?? null;
  return (
    <div className="pile" style={{ gap: 4 }}>
      <span style={grand ? { fontSize: 13.5, lineHeight: 1.4, fontStyle: 'italic' } : undefined}>{texte ?? '—'}</span>
      <details>
        <summary style={{ cursor: 'pointer', color: 'var(--encre)', fontWeight: 700, fontSize: 13 }}>{ligne?.commentaire_sommelier ? 'Votre commentaire · modifier' : 'Modifier'}</summary>
        <form action={modifierCommentaire.bind(null, resto, platId, vinId)} className="pile" style={{ gap: 6, marginTop: 6 }}>
          <textarea name="commentaire" rows={3} maxLength={400} defaultValue={texte ?? ''} aria-label="Commentaire d’accord"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1.5px solid var(--ligne)', font: '14px/1.4 Lato, sans-serif' }} />
          {tous && <input type="hidden" name="tous" value="1" />}
          <span><button className="btn petit">Enregistrer</button></span>
          <span className="petit" style={{ opacity: 0.8 }}>Votre texte remplace celui de Pat chez le client ; la régénération ne le touche plus. Videz le champ pour rendre la main à Pat.</span>
        </form>
      </details>
    </div>
  );
}

/** Suivi d'une régénération en cours : progression, rafraîchie toute seule. */
function SuiviRegeneration({ etat, demande, erreur }: { etat: EtatLot | null; demande?: string; erreur?: string }) {
  if (erreur) return <Message erreur={erreur} />;
  if (!etat) return null;
  // Une fois terminée, plus de bilan : la date de la dernière génération (sous le bouton) suffit.
  if (etat.termine) return null;
  const finis = etat.faits + etat.erreurs.length;
  return (
    <div className="carte-bo" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '16px 20px' }} aria-live="polite">
      <ActualisationAuto />
      <PatAttente taille={56} />
      <div className="pile" style={{ gap: 6 }}>
        <strong>Pat régénère les accords…</strong>
        <span className="discret">
          {`${finis} plat${finis > 1 ? 's' : ''} sur ${etat.total} · comptez une à deux minutes par plat, six plats à la fois`}
          {demande === 'deja' ? ' Une régénération est déjà en cours.' : ''}
        </span>
      </div>
    </div>
  );
}
