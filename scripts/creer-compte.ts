/**
 * Crée un compte (ou reprend celui qui existe) et affiche un lien pour choisir son mot de passe, valable 24 heures.
 * Pour se connecter la première fois sans service d'envoi d'e-mails : à lancer dans le terminal du site (Coolify).
 *
 *   npm run creer-compte -- pat@exemple.com
 *
 * Aucun mot de passe ne se tape ici : il se choisit sur la page ouverte par le lien.
 */
import pg from 'pg';
import { sslBase } from '../src/lib/ssl-base';
import { empreinteJeton, nouveauJeton } from '../src/lib/comptes/secret';

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Indiquez l’adresse e-mail : npm run creer-compte -- pat@exemple.com');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquante.');
  const site = (process.env.URL_PUBLIQUE ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const db = new pg.Client({ connectionString: url, ssl: sslBase(url) });
  await db.connect();
  try {
    await db.query('insert into compte (email) values ($1) on conflict (lower(email)) do nothing', [email]);
    const { rows: [c] } = await db.query<{ id: string }>('select id from compte where lower(email) = $1', [email]);
    // Accès de restaurant donnés à cette adresse avant le compte : rattachés.
    await db.query(`update acces_restaurant a set user_id = $1 where lower(a.email) = $2 and a.user_id <> $1
                      and not exists (select 1 from acces_restaurant b where b.user_id = $1 and b.restaurant_id = a.restaurant_id)`, [c.id, email]);
    const jeton = nouveauJeton();
    await db.query(`insert into lien_compte (jeton, compte_id, expire_le) values ($1, $2, now() + interval '1 day')`, [empreinteJeton(jeton), c.id]);
    console.log(`Compte prêt pour ${email}. Ouvrez ce lien (valable 24 heures) pour choisir votre mot de passe :\n\n${site}/connexion/lien?${new URLSearchParams({ jeton, suite: '/admin/mot-de-passe' })}\n`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exitCode = 1; });
