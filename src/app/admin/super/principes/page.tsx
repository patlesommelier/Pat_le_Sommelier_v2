import Link from 'next/link';
import { creerBrouillonPrincipes, modifierPrincipe, preparer, verifierImportPrincipes } from '../actions';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { requete } from '@/lib/db';
import type { Differences, Principe } from '@/lib/principes/format';
import { brouillon, listeVersions, versionEnService } from '@/lib/principes/versions';
import { dernierePublication } from '@/lib/publication/publication';
import { exigerAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

type Sp = { filtre?: string; tag?: string; import?: string; ok?: string; erreur?: string; n?: string };
const date = (d: string | null) => (d ? new Date(d).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut' | '']> = {
  en_service: ['En service', 'ok'], brouillon: ['Brouillon', 'propose'], remplacee: ['Remplacée', ''], archivee: ['Archivée', 'defaut'],
};

function Differences({ d }: { d: Differences | null }) {
  if (!d) return null;
  const vide = !d.ajoutes.length && !d.supprimes.length && !d.archives.length && !d.modifies.length;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6 }}>
      {vide && <li>Aucune différence avec la version en service.</li>}
      {d.modifies.length > 0 && <li>Modifiés : {d.modifies.map((m) => `n°${m.n} (${m.champs.join(', ')})`).join(' · ')}</li>}
      {d.archives.length > 0 && <li>Archivés : {d.archives.map((n) => `n°${n}`).join(', ')}</li>}
      {d.ajoutes.length > 0 && <li>Ajoutés : {d.ajoutes.map((n) => `n°${n}`).join(', ')}</li>}
      {d.supprimes.length > 0 && <li>Supprimés : {d.supprimes.map((n) => `n°${n}`).join(', ')}</li>}
    </ul>
  );
}

/** Principes de Pat : brouillon modifiable, comparaison avec la version en service, import, export, historique, publication. */
export default async function Principes({ searchParams }: { searchParams: Promise<Sp> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [service, b, versions, pub] = await Promise.all([versionEnService(requete), brouillon(requete), listeVersions(requete), dernierePublication(requete, 'principes')]);
  const [imp] = sp.import ? await requete<{ id: string; nom_fichier: string; resultat: { erreurs: string[]; avertissements: string[]; differences: Differences | null } }>(
    'select id, nom_fichier, resultat from principes_import where id = $1', [sp.import]) : [];
  const affichee = b ?? service;
  const enService = new Map((service?.principes ?? []).map((p) => [p.n, p]));
  const modifie = (p: Principe) => { const s = enService.get(p.n); return !s || s.regle !== p.regle || s.titre !== p.titre || s.statut !== p.statut || s.tags.join() !== p.tags.join(); };
  const tags = [...new Set((affichee?.principes ?? []).flatMap((p) => p.tags))].sort();
  const liste = (affichee?.principes ?? []).filter((p) =>
    sp.filtre === 'modifies' ? modifie(p) : sp.filtre === 'archives' ? p.statut === 'archive' : sp.filtre === 'relire' ? p.aRelire : sp.tag ? p.tags.includes(sp.tag) : true);
  const filtre = (cle: string, libelle: string, href: string) => (
    <Link href={href} className={`btn ${(sp.filtre ?? '') === cle && !sp.tag ? '' : 'sec'} petit`}>{libelle}</Link>
  );

  return (
    <>
      <Entete titre="Principes de Pat" texte="Les principes décident des notes d’accord. Modifiez le brouillon, comparez-le à la version en service, puis publiez : Pat recalcule tout et vous montre ce qui change avant la mise en service.">
        {service && <a href={`/admin/super/principes/export?code=${service.code}&format=xlsx`} className="btn sec">Exporter {service.code}</a>}
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />

      <div className="carte-bo pile" style={{ gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            En service : <b>{service?.code ?? 'aucune'}</b>{service?.publie_le ? <span className="discret"> (depuis le {date(service.publie_le)})</span> : null}
            {' · '}{b ? <>Brouillon : <b>{b.code}</b> <span className="discret">(modifié le {date(b.maj_le)})</span></> : 'Pas de brouillon : importez une version ci-dessous.'}
          </span>
          {b && <form action={preparer.bind(null, 'principes')}><button className="btn">Publier les principes</button></form>}
        </div>
        {b && <Differences d={b.differences} />}
        {pub && !['annulee'].includes(pub.statut) && (
          <span className="petit">Dernière publication : <Link href={`/admin/super/publications/${pub.id}`}>{pub.code} — {
            pub.statut === 'en_preparation' ? `en préparation (${pub.faits + pub.erreurs}/${pub.total} plats)` : pub.statut === 'preparee' ? 'prête à mettre en service' : 'mise en service'}</Link></span>
        )}
      </div>

      {affichee && (
        <section className="pile" style={{ gap: 10 }}>
          <h2>{b ? `Brouillon ${b.code}` : `Version en service ${service?.code}`} · {affichee.principes.length} numéros</h2>
          <nav className="ligne-actions" aria-label="Filtres">
            {filtre('', 'Tous', '/admin/super/principes')}
            {filtre('modifies', 'Modifiés', '/admin/super/principes?filtre=modifies')}
            {filtre('archives', 'Archivés', '/admin/super/principes?filtre=archives')}
            {filtre('relire', 'À relire', '/admin/super/principes?filtre=relire')}
            <form method="get" style={{ display: 'inline-flex', gap: 6 }}>
              <select name="tag" defaultValue={sp.tag ?? ''} aria-label="Tag" style={{ minHeight: 36, borderRadius: 8, border: '1.5px solid var(--ligne)' }}>
                <option value="">Tag…</option>{tags.map((t) => <option key={t}>{t}</option>)}
              </select><button className="btn fantome petit">OK</button>
            </form>
          </nav>
          {liste.map((p) => {
            const s = enService.get(p.n);
            const cites = [...new Set([...p.regle.matchAll(/n°\s?(\d+)/g)].map((m) => Number(m[1])))];
            const decisions = (affichee.decisions ?? []).filter((d) => new RegExp(`n°\\s?${p.n}\\b`).test(`${d.question} ${d.effet}`));
            return (
              <details key={p.n} id={`p${p.n}`} className="carte-bo" style={{ padding: '10px 16px' }} open={sp.n === String(p.n)}>
                <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline' }}>
                  <b style={{ minWidth: 40 }}>n°{p.n}</b>
                  <span style={{ flex: '1 1 260px', textDecoration: p.statut === 'archive' ? 'line-through' : undefined }}>{p.titre}</span>
                  {p.statut === 'archive' && <Etat type="defaut">Archivé</Etat>}
                  {b && modifie(p) && <Etat type="propose">Modifié</Etat>}
                  {p.aRelire && <Etat type="">À relire</Etat>}
                  <span className="petit discret">{p.tags.join(', ')}</span>
                </summary>
                {b ? (
                  <form action={modifierPrincipe.bind(null, p.n)} className="pile" style={{ gap: 8, marginTop: 10 }}>
                    <div className="champ"><label htmlFor={`t${p.n}`}>Titre</label><input id={`t${p.n}`} name="titre" defaultValue={p.titre} /></div>
                    <div className="champ"><label htmlFor={`r${p.n}`}>Règle</label><textarea id={`r${p.n}`} name="regle" rows={4} defaultValue={p.regle} />
                      <span className="aide">Pour archiver un principe fusionné, commencez la règle par « Fusionné » : il garde son numéro.</span></div>
                    <div className="champ"><label htmlFor={`g${p.n}`}>Tags (séparés par des virgules)</label><input id={`g${p.n}`} name="tags" defaultValue={p.tags.join(', ')} /></div>
                    <label className="case"><input type="checkbox" name="relu" defaultChecked={!p.aRelire} /><span>Marquer comme relu</span></label>
                    {cites.length > 0 && <span className="petit">Principes cités : {cites.map((n, i) => <span key={n}>{i ? ', ' : ''}<a href={`#p${n}`}>n°{n}</a></span>)}</span>}
                    {decisions.map((d) => <span key={d.n} className="petit">Décision liée : {d.decision} — {d.effet}</span>)}
                    {s && s.regle !== p.regle && (
                      <details><summary className="petit" style={{ cursor: 'pointer' }}>Voir le texte de la version en service ({service?.code})</summary>
                        <p className="petit" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{s.titre} — {s.regle}</p></details>
                    )}
                    <span><button className="btn petit">Enregistrer dans le brouillon</button></span>
                  </form>
                ) : <p style={{ margin: '10px 0 0', fontSize: 14.5 }}>{p.regle}</p>}
              </details>
            );
          })}
        </section>
      )}

      {(affichee?.questions ?? []).length > 0 && (
        <section className="carte-bo pile" style={{ gap: 6 }}>
          <h2>Questions ouvertes</h2>
          {affichee!.questions.map((q) => <span key={q.n} style={{ fontSize: 14.5 }}><b>{q.n}.</b> {q.question}{q.principes ? <span className="discret"> (principe {q.principes})</span> : null}</span>)}
        </section>
      )}

      <section className="carte-bo pile">
        <h2>Importer une version</h2>
        <p className="discret" style={{ margin: 0 }}>Fichier .xlsx (onglet « Principes » : N° | Identifiant | Titre | Règle | Tags) ou .json. Vous voyez les erreurs, les avertissements et les différences avant de créer le brouillon.</p>
        <form action={verifierImportPrincipes} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input type="file" name="fichier" accept=".xlsx,.json" required />
          <button className="btn sec petit">Vérifier le fichier</button>
        </form>
        {imp && (
          <div className="pile" style={{ gap: 8, padding: 14, borderRadius: 12, background: 'var(--fond)' }}>
            <b>{imp.nom_fichier}</b>
            <span>{imp.resultat.erreurs.length} erreur(s) · {imp.resultat.avertissements.length} avertissement(s)</span>
            {[...imp.resultat.erreurs.map((e) => ['erreur', e]), ...imp.resultat.avertissements.map((e) => ['avertissement', e])].map(([t, e], i) => (
              <span key={i} className="message" style={{ margin: 0, background: t === 'erreur' ? undefined : 'var(--ocre-fond)', color: t === 'erreur' ? undefined : 'var(--ocre)' }}>{e}</span>))}
            <span className="surtitre">Différences avec {service?.code ?? 'la version en service'}</span>
            <Differences d={imp.resultat.differences} />
            {!imp.resultat.erreurs.length && (
              <form action={creerBrouillonPrincipes.bind(null, imp.id)} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {b && <label className="case"><input type="checkbox" name="remplacer" required /><span>Remplacer le brouillon {b.code}</span></label>}
                <button className="btn">Créer le brouillon</button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="pile" style={{ gap: 8 }}>
        <h2>Historique des versions</h2>
        <div className="tableau"><table style={{ minWidth: 560 }}>
          <thead><tr><th>Version</th><th>Statut</th><th>Source</th><th>Mise en service</th><th>Export</th></tr></thead>
          <tbody>{versions.map((v) => (
            <tr key={v.code}><td><b>{v.code}</b></td><td><Etat type={STATUTS[v.statut]?.[1] ?? ''}>{STATUTS[v.statut]?.[0] ?? v.statut}</Etat></td>
              <td className="petit">{v.source?.fichier ?? '—'}</td><td className="petit">{date(v.publie_le)}{v.publie_par ? ` · ${v.publie_par}` : ''}</td>
              <td><a href={`/admin/super/principes/export?code=${v.code}&format=xlsx`}>Excel</a> · <a href={`/admin/super/principes/export?code=${v.code}&format=json`}>JSON</a></td></tr>))}
          </tbody></table></div>
      </section>
    </>
  );
}
