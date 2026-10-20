'use client';
// Conversation avec Pat : il demande comment il peut aider ; à chaque plat écrit, il répond avec l'accord de référence le plus proche
// (vins conseillés, pourquoi, une alternative plus accessible et deux autres pistes), et propose les plats voisins.
import { useEffect, useRef, useState, useTransition } from 'react';
import { demanderAPat } from './actions';
import type { AccordReference } from '@/lib/app/recherche';
import s from './app.module.css';

type Echange = { question: string; accords: AccordReference[] };
const EXEMPLES = ['Un magret de canard', 'Des moules marinières', 'Un risotto aux champignons', 'Un plateau de fromages'];

export function ConversationPat({ prenom }: { prenom: string | null }) {
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const [texte, setTexte] = useState('');
  const [enCours, demarrer] = useTransition();
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { if (echanges.length) fin.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [echanges.length]);

  const demander = (question: string) => {
    const q = question.trim();
    if (!q || enCours) return;
    setTexte('');
    demarrer(async () => { const accords = await demanderAPat(q); setEchanges((e) => [...e, { question: q, accords }]); });
  };

  return (
    <>
      <main className={`${s.large} ${s.contenu}`}>
        <div className={s.patQuestion}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pat/pat-attable-rouge.svg" alt="Pat, le sommelier" width={560} height={440} />
          <p className={`${s.bulle} ${s.bullePat}`}>Bonjour{prenom ? ` ${prenom}` : ''}&#8239;! Comment puis-je t’aider&#8239;? Dis-moi ce que tu manges, je te dis quel vin choisir.</p>
        </div>
        {!echanges.length && (
          <div className={s.puces} aria-label="Exemples">
            {EXEMPLES.map((e) => <button key={e} type="button" className={s.puce} onClick={() => demander(e)}>{e}</button>)}
          </div>
        )}
        <div className={s.fil} aria-live="polite">
          {echanges.map((e, i) => (
            <div key={i} className={s.fil} ref={i === echanges.length - 1 ? fin : undefined}>
              <p className={`${s.bulle} ${s.bulleClient}`}>{e.question}</p>
              {e.accords.length ? <Reponse accord={e.accords[0]} autres={e.accords.slice(1)} demander={demander} /> : (
                <p className={`${s.bulle} ${s.bullePat}`} style={{ fontSize: 16 }}>Je n’ai pas encore ce plat dans mon carnet. Dis-le-moi autrement (le produit principal, la cuisson ou la sauce), ou essaie un plat voisin.</p>
              )}
            </div>
          ))}
          {enCours && <p className={`${s.bulle} ${s.bullePat}`} style={{ fontSize: 16 }}>Je réfléchis…</p>}
        </div>
      </main>
      <div className={`${s.barre}`}>
        <div className={s.large}>
          <form onSubmit={(ev) => { ev.preventDefault(); demander(texte); }}>
            <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Ce que je mange…" aria-label="Ce que je mange" maxLength={300} />
            <button className={s.envoyer} disabled={!texte.trim() || enCours} aria-label="Demander à Pat">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function Reponse({ accord: a, autres, demander }: { accord: AccordReference; autres: AccordReference[]; demander: (q: string) => void }) {
  const pistes = [a.axe_diversite_2, a.axe_diversite_3].filter((x): x is NonNullable<typeof x> => Boolean(x?.vins_recommandes));
  return (
    <article className={s.reponse}>
      <span className={s.etiquette}>{a.nom}</span>
      <h3>Je te conseille</h3>
      <p className={s.vins}>{a.vins_recommandes}</p>
      {a.justification_charnelle && <p>{a.justification_charnelle}</p>}
      {a.alternative_accessible && <p><b>Plus accessible :</b> {a.alternative_accessible}</p>}
      {a.notes_pratiques && <p><b>Au service :</b> {a.notes_pratiques}</p>}
      {pistes.length > 0 && (
        <div className={s.autres}>
          <span className={s.etiquette}>Pour changer</span>
          {pistes.map((p) => <p key={p.vins_recommandes}><b>{p.vins_recommandes}</b> — {p.justification_courte}</p>)}
        </div>
      )}
      {autres.length > 0 && (
        <div className={s.autres}>
          <span className={s.etiquette}>Tu pensais peut-être à</span>
          <div className={s.puces}>{autres.map((o) => <button key={o.id} type="button" className={s.puce} onClick={() => demander(o.nom)}>{o.nom}</button>)}</div>
        </div>
      )}
    </article>
  );
}
