import Link from 'next/link';
import { changerNote, regenererTout, validerPlat, validerTout } from '../../actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { ChoixNote } from '@/components/admin/ChoixNote';
import { Icone } from '@/components/admin/Icone';
import { Entete, Etat, Message, Points, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant } from '@/lib/admin/auth';
import { getLimitesInternes, getPlatsBO, getResume, getStatsAccordsParPlat } from '@/lib/admin/donnees';
import { pourquoiPas, pourquoiRetenu } from '@/lib/admin/explications';
import { requete } from '@/lib/db';
import { getCandidats, getReglages } from '@/lib/donnees';
import { etatDernierLot, type EtatLot } from '@/lib/generation/file';
import { selectionner, tourSuivant } from '@/lib/selection';

const dateHeure = (d: string) => new Date(d).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const CAT: Record<string, string> = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert', fromage: 'Fromage' };

export default async function Accords({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ plat?: string; ok?: string; tous?: string; regeneration?: string; erreur?: string }> }) {
  const { resto } = await params;
  const sp = await searchParams;
  const [plats, stats, resume, R, u, etat, [derniere]] = await Promise.all([getPlatsBO(resto), getStatsAccordsParPlat(resto), getResume(resto), getReglages(resto), utilisateurCourant(), etatDernierLot(requete, resto),
    requete<{ le: string | null }>('select max(coalesce(regenere_le, explication_generee_le, calcule_le)) as le from accord where restaurant_id = $1', [resto])]);
  // Commentaires d'origine (import) pas encore réécrits par une régénération : souvent identiques d'un vin à l'autre.
  const anciens = new Map((await requete<{ plat_id: string; n: number }>(
    `select a.plat_id, count(*)::int as n from accord a join vin_carte v on v.id = a.vin_id and v.disponible
      where a.restaurant_id = $1 and a.regenere_le is null and a.statut <> 'refuse' group by a.plat_id`, [resto])).map((a) => [a.plat_id, a.n]));
  // Score et rankings : cuisine interne de Pat. Le classement est calculé ici, côté serveur ;
  // un compte restaurant ne reçoit que le rang et la note d’accord /5.
  const interne = Boolean(u?.admin);
  const actifs = plats.filter((p) => p.actif);
  const parPlat = new Map(stats.map((s) => [s.plat_id, s]));
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
  const { candidats, lignesParVin } = plat ? await getCandidats(resto, [plat.id], ['valide', 'propose']) : { candidats: [], lignesParVin: new Map() };
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
  const limites = interne && plat ? await getLimitesInternes(resto, plat.id) : null;
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
          {etat?.termine && platsAnciens > 0 && <span style={{ fontSize: 12.5, color: 'var(--ocre)', maxWidth: 360 }}>
            {platsAnciens} plat{platsAnciens > 1 ? 's gardent' : ' garde'} des commentaires d’origine{raison ? ` (${raison})` : ''} : relancez la régénération.</span>}
        </span>
      </div>
      <SuiviRegeneration etat={etat} demande={sp.regeneration} erreur={sp.erreur} />
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
            <Message ok={sp.ok ? 'Accords de ce plat validés.' : undefined} />
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
                    <span className="discret" style={{ fontSize: 13 }}>{pourquoiRetenu(r, i + 1, sel.liste, interne)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pile">
              <div><h3 style={{ fontSize: 20 }}>Classement complet</h3><p className="discret" style={{ margin: '6px 0 0' }}>{interne ? 'Classé par score de Pat.' : 'Classement établi par Pat à partir de la note d’accord et de sa connaissance des vignerons.'}</p></div>
              <div className="tableau">
                <table style={{ minWidth: 900 }}>
                  <thead><tr><th className="droite">Rang</th><th>Vin</th><th>Note</th>{interne && <th className="droite">Score</th>}<th>Pourquoi (Pat)</th><th>Résultat</th></tr></thead>
                  <tbody>
                    {tri.map((t, rang) => {
                      const l = lignesParVin.get(t.vin.id)?.[0];
                      const [res, rk] = retenus.has(t.vin.id) ? [`Proposé · n° ${sel.liste.findIndex((r) => r.vin.id === t.vin.id) + 1}`, 'ok' as const] : pourquoiPas(t, R, sel.liste, tour2);
                      return (
                        <tr key={t.vin.id}>
                          <td className="droite"><b>{rang + 1}</b></td>
                          <td style={{ minWidth: 240 }}><div className="vin-cell"><Vignette url={t.vin.etiquette_url} taille={40} /><div><div className="nom">{t.vin.libelle}</div><div className="petit">{t.vin.id} · {euros(t.vin.prix ?? t.vin.prix_verre)}</div></div></div></td>
                          <td>
                            <form action={changerNote.bind(null, resto, plat.id, t.vin.id)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Points note={t.note} /><ChoixNote note={t.note} libelle={t.vin.libelle} />
                              <noscript><button className="btn petit">OK</button></noscript>
                            </form>
                            {l?.statut === 'propose' && <span className="petit">à relire</span>}
                          </td>
                          {interne && <td className="droite"><b>{t.score}</b></td>}
                          <td className="petit" style={{ minWidth: 220, maxWidth: 340, lineHeight: 1.4 }}>{l?.explication ?? '—'}{limites?.get(t.vin.id) && <><br /><i>Limite (interne) : {limites.get(t.vin.id)}</i></>}</td>
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

/** Suivi d'une régénération en cours : progression, rafraîchie toute seule. */
function SuiviRegeneration({ etat, demande, erreur }: { etat: EtatLot | null; demande?: string; erreur?: string }) {
  if (erreur) return <Message erreur={erreur} />;
  if (!etat) return null;
  // Une fois terminée, plus de bilan : la date de la dernière génération (sous le bouton) suffit.
  if (etat.termine) return null;
  const finis = etat.faits + etat.erreurs.length;
  return (
    <div className="carte-bo pile" style={{ gap: 8, padding: '16px 20px' }} aria-live="polite">
      <ActualisationAuto />
      <strong>Pat régénère les accords…</strong>
      <span className="discret">
        {`${finis} plat${finis > 1 ? 's' : ''} sur ${etat.total} · comptez une à deux minutes par plat, trois plats à la fois`}
        {demande === 'deja' ? ' Une régénération est déjà en cours.' : ''}
      </span>
    </div>
  );
}
