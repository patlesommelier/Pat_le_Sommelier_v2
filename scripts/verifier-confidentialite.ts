/**
 * Vérifie qu'un compte restaurant ne reçoit jamais la cuisine interne de Pat (ranking, score, limite d'accord).
 * Parcourt l'espace restaurant et l'app client comme le ferait le navigateur : page HTML et données React
 * (en-tête RSC, ce que montre l'onglet Réseau), puis cherche les mots interdits dans chaque réponse.
 *
 *   AUTH_DEV_EMAIL=resto@lola.be AUTH_DEV_RESTAURANT=lola npx next start -p 3499   (serveur local, compte restaurant)
 *   npm run verifier-confidentialite -- --url http://localhost:3499 --restaurant lola [--autre bistro]
 *   --autre : un autre restaurant, dont aucune page du back-office ne doit être servie au compte de --restaurant.
 *
 * Code de sortie 1 si un mot interdit est trouvé.
 */
import 'dotenv/config';
import pg from 'pg';

const arg = (nom: string, defaut: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : defaut; };
const base = arg('url', 'http://localhost:3499');
const resto = arg('restaurant', 'lola');
const autre = arg('autre', '');

// Champs et mots de la cuisine interne. « limite » seul est un mot courant : on cherche le champ et les tournures internes.
const INTERDITS: [string, RegExp][] = [
  ['ranking', /ranking/i],
  ['score', /\bscores?\b/i],
  ['champ limite', /["']limite["']\s*:/],
  ['limite interne', /limite \(interne\)/i],
  ['rk prod', /rk\.? prod/i],
];

async function adresses(): Promise<string[]> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const plats = (await pool.query('select id from plat where restaurant_id = $1 and actif order by ordre', [resto])).rows.map((r) => r.id as string);
    const vins = (await pool.query('select id from vin_carte where restaurant_id = $1 and disponible order by ordre limit 15', [resto])).rows.map((r) => r.id as string);
    const admin = ['', '/menu', '/carte', '/accords', '/accords?tous=1', '/regles', '/apparence', '/acces', '/simulateur', '/carte/imprimer', '/carte/preparer', '/supports']
      .map((s) => `/admin/${resto}${s}`);
    return [
      ...admin,
      ...plats.flatMap((p) => [`/admin/${resto}/accords?plat=${p}&tous=1`, `/admin/${resto}/simulateur?plat=${p}`, `/admin/${resto}/menu?plat=${p}`]),
      ...vins.map((v) => `/admin/${resto}/carte?vin=${v}`),
      // Espace super-admin : un compte restaurant doit être renvoyé ailleurs sans rien recevoir.
      '/admin/super', '/admin/super/producteurs', '/admin/super/base', '/admin/super/base?onglet=terroirs', '/admin/super/principes',
      '/admin/super/regles', '/admin/super/principes/export?code=V5&format=json',
      `/${resto}`, `/${resto}/carte`,
      ...plats.map((p) => `/${resto}/plat/${p}`),
      ...vins.map((v) => `/${resto}/vin/${v}`),
    ];
  } finally {
    await pool.end();
  }
}

async function main() {
  const liste = await adresses();
  const trouves: string[] = [];
  let reponses = 0;
  for (const chemin of liste) {
    // Deux formes : la page complète, et les données React envoyées lors d'une navigation dans l'app.
    for (const entetes of [{}, { RSC: '1', 'Next-Router-State-Tree': '%5B%22%22%2C%7B%7D%5D' }] as Record<string, string>[]) {
      const r = await fetch(base + chemin, { headers: entetes, redirect: 'manual' });
      reponses++;
      const corps = await r.text();
      for (const [nom, re] of INTERDITS) {
        const m = corps.match(re);
        if (m) {
          const i = m.index ?? 0;
          trouves.push(`${chemin}${entetes.RSC ? ' (données React)' : ''} : « ${nom} » … ${corps.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, ' ')} …`);
        }
      }
    }
  }
  // Pages d'un autre restaurant : jamais servies (redirection, sans contenu).
  if (autre) {
    // Contenu propre à l'autre restaurant : son nom et ceux de ses plats.
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const secrets = (await pool.query(`select nom from restaurant where id = $1 union all select nom from plat where restaurant_id = $1`, [autre])).rows.map((r) => r.nom as string);
    await pool.end();
    for (const s of ['', '/menu', '/carte', '/accords', '/regles', '/apparence', '/acces', '/acces/chevalet', '/simulateur', '/supports', '/carte/preparer', '/carte/imprimer', '/acces/qr']) {
      for (const entetes of [{}, { RSC: '1', 'Next-Router-State-Tree': '%5B%22%22%2C%7B%7D%5D' }] as Record<string, string>[]) {
        const r = await fetch(`${base}/admin/${autre}${s}`, { headers: entetes, redirect: 'manual' });
        reponses++;
        const corps = await r.text();
        // Une réponse React peut valoir 200 en ne contenant que la redirection (NEXT_REDIRECT) : c'est le contenu qui compte.
        const fuite = secrets.find((x) => corps.includes(x)) ?? (r.status === 200 && !corps.includes('NEXT_REDIRECT') ? `page servie (HTTP 200)` : null);
        if (fuite) trouves.push(`/admin/${autre}${s}${entetes.RSC ? ' (données React)' : ''} : servie au compte de ${resto} — « ${fuite} »`);
      }
    }
  }
  console.log(`${liste.length} adresses, ${reponses} réponses lues.`);
  if (trouves.length) {
    console.log(`\n${trouves.length} fuite(s) de la cuisine interne :\n${trouves.join('\n')}`);
    process.exit(1);
  }
  console.log('Aucun ranking, score ni limite dans ce que reçoit le compte restaurant.');
}

main().catch((e) => { console.error(e); process.exit(1); });
