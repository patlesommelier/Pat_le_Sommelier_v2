import Link from 'next/link';
import { notFound } from 'next/navigation';
import { annuler, confirmer, relancer } from '../../actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { requete } from '@/lib/db';
import { changementsPublication, etatPublication } from '@/lib/publication/publication';
import { exigerAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/** Publication des principes ou des règles : avancement de la préparation, changements visibles par le client, mise en service. */
export default async function Publication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { id } = await params;
  const sp = await searchParams;
  const e = await etatPublication(requete, id);
  if (!e) notFound();
  const lignes = await changementsPublication(requete, id);
  const ids = [...new Set(lignes.flatMap((l) => [...(l.changements?.entrent ?? []), ...(l.changements?.sortent ?? []), ...(l.changements?.notes ?? []).map((n) => n.vin)]))];
  const noms = new Map((await requete<{ id: string; libelle: string }>('select id, libelle from vin_carte where id = any($1)', [ids])).map((v) => [v.id, v.libelle]));
  const restos = new Map((await requete<{ id: string; nom: string }>('select id, nom from restaurant')).map((r) => [r.id, r.nom]));
  const nom = (v: string) => noms.get(v) ?? v;
  const avecChangements = lignes.filter((l) => l.changements && (l.changements.entrent.length || l.changements.sortent.length || l.changements.notes.length));
  const echecs = lignes.filter((l) => l.statut === 'erreur');
  const retour = e.type === 'principes' ? '/admin/super/principes' : '/admin/super/regles';
  const statut: Record<string, [string, 'ok' | 'propose' | 'defaut' | '']> = {
    en_preparation: ['En préparation', 'propose'], preparee: ['Prête', 'ok'], confirmee: ['En service', 'ok'], annulee: ['Annulée', 'defaut'],
  };

  return (
    <>
      <Entete titre={`Publier ${e.type === 'principes' ? 'les principes' : 'les règles'} ${e.code}`}
        texte="Rien ne change pour les clients avant « Mettre en service ». Les notes changées à la main et les commentaires réécrits par les restaurants sont conservés.">
        <Link href={retour} className="btn sec">← {e.type === 'principes' ? 'Principes' : 'Règles'}</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      <div className="carte-bo pile" style={{ gap: 8 }} aria-live="polite">
        {e.statut === 'en_preparation' && <ActualisationAuto />}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Etat type={statut[e.statut]?.[1] ?? ''}>{statut[e.statut]?.[0] ?? e.statut}</Etat>
          <span>{e.faits + e.erreurs} plat(s) sur {e.total} recalculé(s){e.erreurs ? ` · ${e.erreurs} en échec` : ''} · {e.platsModifies} plat(s) où le client verra une différence</span>
        </div>
        {e.statut === 'en_preparation' && <span className="discret">Pat note à nouveau chaque plat avec le brouillon : comptez une à deux minutes par plat, six plats à la fois. La page se met à jour toute seule.</span>}
        {e.versionModifiee && e.statut !== 'confirmee' && e.statut !== 'annulee' && (
          <span className="message" style={{ margin: 0 }}>Le brouillon a été modifié depuis la préparation : la mise en service sera refusée. Relancez la publication depuis {e.type === 'principes' ? 'les principes' : 'les règles'}.</span>)}
        <div className="ligne-actions">
          {e.statut === 'preparee' && !e.erreurs && <form action={confirmer.bind(null, id)}><button className="btn">Mettre en service</button></form>}
          {echecs.length > 0 && e.statut !== 'confirmee' && e.statut !== 'annulee' && <form action={relancer.bind(null, id)}><button className="btn sec">Relancer les {echecs.length} plat(s) en échec</button></form>}
          {(e.statut === 'preparee' || e.statut === 'en_preparation') && <form action={annuler.bind(null, id)}><button className="btn fantome">Annuler</button></form>}
        </div>
      </div>

      {echecs.length > 0 && (
        <section className="pile" style={{ gap: 6 }}>
          <h2>Plats en échec</h2>
          {echecs.map((l) => <span key={l.plat_id} className="message" style={{ margin: 0, background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>{restos.get(l.restaurant_id)} · {l.plat} : {l.message ?? 'échec'}</span>)}
        </section>
      )}

      <section className="pile" style={{ gap: 10 }}>
        <h2>Ce qui change pour les clients</h2>
        {!avecChangements.length && <p className="discret">{e.statut === 'en_preparation' ? 'Rien pour l’instant.' : 'Aucun changement visible : les mêmes vins restent proposés avec les mêmes notes.'}</p>}
        {[...new Set(avecChangements.map((l) => l.restaurant_id))].map((rid) => (
          <div key={rid} className="pile" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 18 }}>{restos.get(rid) ?? rid}</h3>
            {avecChangements.filter((l) => l.restaurant_id === rid).map((l) => (
              <div key={l.plat_id} className="carte-bo pile" style={{ gap: 4, padding: '12px 16px' }}>
                <b>{l.plat}</b>
                {l.changements!.entrent.length > 0 && <span style={{ color: 'var(--vert)' }}>Entrent : {l.changements!.entrent.map(nom).join(' · ')}</span>}
                {l.changements!.sortent.length > 0 && <span style={{ color: 'var(--ocre)' }}>Sortent : {l.changements!.sortent.map(nom).join(' · ')}</span>}
                {l.changements!.notes.length > 0 && <span className="petit">Notes : {l.changements!.notes.map((n) => `${nom(n.vin)} ${n.avant} → ${n.apres}`).join(' · ')}</span>}
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
