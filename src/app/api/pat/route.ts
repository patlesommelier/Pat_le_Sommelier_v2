import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { chargerContexte } from '@/lib/contexte';
import { extraireVins, systemePat, texteCarte, textePlat } from '@/lib/pat-cerveau';

export const runtime = 'nodejs';

interface Corps {
  restaurant: string;
  plat?: string | null;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export async function POST(req: Request) {
  const corps = (await req.json()) as Corps;
  if (!corps?.restaurant || !Array.isArray(corps.messages) || !corps.messages.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ erreur: "Pat n'est pas encore branché : ANTHROPIC_API_KEY manquante." }, { status: 503 });
  }

  const ctx = await chargerContexte(corps.restaurant);
  if (!ctx.carte.length) return NextResponse.json({ erreur: 'Restaurant inconnu' }, { status: 404 });
  const plat = corps.plat ? ctx.plats.find((p) => p.id === corps.plat) : undefined;

  const contexte = [
    `CARTE DES VINS DISPONIBLES (code | couleur | vin | millésime | format | prix | cépages | profil | …)\n${texteCarte(ctx.carte)}`,
    `MENU DU RESTAURANT\n${ctx.plats.map((p) => `- ${p.nom} (${p.categorie})`).join('\n')}`,
    plat ? `LE CLIENT REGARDE CE PLAT\n${textePlat(plat)}` : null,
    `Termine toujours ta réponse par une ligne « VINS : » suivie des codes des vins que tu proposes (ou « VINS : aucun »). Réponds en 120 mots maximum.`,
  ].filter(Boolean).join('\n\n');

  // Questions courtes : on garde les 12 derniers messages de la conversation.
  const historique = corps.messages
    .slice(-12)
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: String(m.content).slice(0, 2000) }));
  while (historique.length && historique[0].role !== 'user') historique.shift();
  if (!historique.length) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 });
  historique[0] = { ...historique[0], content: `${contexte}\n\n---\n\n${historique[0].content}` };

  const client = new Anthropic();
  const r = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    max_tokens: 700,
    system: systemePat(corps.restaurant, ctx.principes, ctx.regles),
    messages: historique,
  });
  const texte = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const { reponse, vins } = extraireVins(texte, ctx.carte.map((v) => v.id));
  return NextResponse.json({
    reponse,
    vins: vins.map((id) => {
      const v = ctx.carte.find((x) => x.id === id)!;
      return { id, libelle: v.libelle, prix: v.prix };
    }),
  });
}
