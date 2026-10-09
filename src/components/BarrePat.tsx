'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { euros } from '@/lib/format';
import { Etiquette } from './Etiquette';
import { Envoyer, Micro } from './Icones';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Vins proposés : étiquette et texte complet de l'accord (ou présentation du vin), affichés sous la réponse. */
  vins?: { id: string; plat: string | null; libelle: string; producteur: string | null; millesime: string | null; prix: number | null;
    prix_verre: number | null; etiquette_url: string | null; texte: string | null }[];
  erreur?: boolean;
}

/** Texte de Pat : seuls les passages **en gras** (lignes de vins) sont mis en forme ; le reste reste du texte brut. */
function TextePat({ texte }: { texte: string }) {
  return <>{texte.split(/(\*\*[^*\n]+\*\*)/g).map((m, i) => (/^\*\*[^*\n]+\*\*$/.test(m) ? <strong key={i}>{m.slice(2, -2)}</strong> : m))}</>;
}

/** Barre « Demandez à Pat », toujours visible en bas ; ouvre la conversation au premier message. */
export function BarrePat({ restaurant, nom }: { restaurant: string; nom: string }) {
  const chemin = usePathname();
  const plat = chemin.match(/\/plat\/([^/]+)/)?.[1] ?? null;
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attente, setAttente] = useState(false);
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  // Les autres écrans peuvent pré-remplir une question (bouton « Demander à Pat »).
  useEffect(() => {
    const ecoute = (e: Event) => {
      setTexte((e as CustomEvent<string>).detail);
      champ.current?.focus();
    };
    window.addEventListener('pat:demander', ecoute);
    return () => window.removeEventListener('pat:demander', ecoute);
  }, []);

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' });
  }, [messages, attente]);

  async function envoyer(e?: React.FormEvent) {
    e?.preventDefault();
    const question = texte.trim();
    if (!question || attente) return;
    const suite: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(suite);
    setTexte('');
    setOuvert(true);
    setAttente(true);
    try {
      const r = await fetch('/api/pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant, plat, messages: suite.filter((m) => !m.erreur).map(({ role, content }) => ({ role, content })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erreur ?? 'Pat ne répond pas pour le moment.');
      setMessages([...suite, { role: 'assistant', content: d.reponse, vins: d.vins }]);
    } catch (err) {
      setMessages([...suite, { role: 'assistant', content: (err as Error).message, erreur: true }]);
    } finally {
      setAttente(false);
    }
  }

  return (
    <>
      {ouvert && (
        <section className="conversation" aria-label="Conversation avec Pat">
          <div className="conversation-haut">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pat/pat.png" alt="" width={28} height={31} />
            <strong>Pat, votre sommelier</strong>
            <button type="button" onClick={() => setOuvert(false)}>Fermer</button>
          </div>
          <div className="fil" ref={fil} aria-live="polite">
            {messages.length === 0 && (
              <div className="message pat">
                Bienvenue chez {nom}. Je vous aide à choisir un vin qui accompagnera parfaitement votre plat. Qu’allez-vous manger ?
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.erreur ? 'erreur' : m.role === 'user' ? 'client' : 'pat'}`}>
                {m.role === 'assistant' && !m.erreur ? <TextePat texte={m.content} /> : m.content}
                {m.vins && m.vins.length > 0 && (
                  <div className="vins-cites">
                    {m.vins.map((v) => (
                      <Link key={v.id} className="fiche-chat" href={`/${restaurant}/vin/${v.id}${v.plat ?? plat ? `?plat=${v.plat ?? plat}` : ''}`} onClick={() => setOuvert(false)}>
                        <span className="fiche-chat-haut">
                          <Etiquette url={v.etiquette_url} nom={v.libelle} largeur={72} hauteur={96} />
                          <span className="fiche-chat-nom">
                            <strong>{v.libelle}</strong>
                            {(v.producteur || v.millesime) && <span>{[v.producteur && !/^non /i.test(v.producteur) ? v.producteur : null, v.millesime].filter(Boolean).join(' · ')}</span>}
                            {(v.prix ?? v.prix_verre) !== null && <b>{euros(v.prix ?? v.prix_verre)}{v.prix && v.prix_verre ? <small> · verre {euros(v.prix_verre)}</small> : null}</b>}
                          </span>
                        </span>
                        {v.texte && <span className="fiche-chat-texte">{v.texte}</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {attente && <div className="message pat">Je cherche pour vous…</div>}
          </div>
        </section>
      )}
      <div className="barre-pat">
        <form onSubmit={envoyer}>
          <button type="button" className="avatar-pat" aria-label="Ouvrir la conversation avec Pat" onClick={() => setOuvert((o) => !o)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pat/pat.png" alt="" />
          </button>
          <label htmlFor="question-pat" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Votre question à Pat
          </label>
          <textarea
            id="question-pat"
            ref={champ}
            rows={1}
            placeholder="Demandez à Pat…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) envoyer(e);
            }}
          />
          <button type="button" className="rond secondaire" aria-label="Dicter (bientôt disponible)" disabled>
            <Micro />
          </button>
          <button type="submit" className="rond principal" aria-label="Envoyer" disabled={!texte.trim() || attente}>
            <Envoyer />
          </button>
        </form>
      </div>
    </>
  );
}
