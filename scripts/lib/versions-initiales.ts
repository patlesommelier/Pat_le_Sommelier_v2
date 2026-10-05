/**
 * Premières versions des principes et des règles, si la base n'en a pas encore :
 * principes V5 en service (ceux avec lesquels les accords en place ont été calculés), V6 en brouillon, règles V7 en service.
 * Appelé après les migrations (npm run migrer, donc au déploiement de production) et par `npm run versions`.
 */
import fs from 'node:fs';
import type { Requete } from '../../src/lib/generation/accords';
import { lireFichier } from '../../src/lib/principes/format';
import { brouillon, importerVersion, installerEnService, versionEnService } from '../../src/lib/principes/versions';
import { installerReglesEnService, reglesEnService } from '../../src/lib/regles/versions';
import { REGLAGES_PAT } from '../../src/lib/selection';

export const FICHIERS = { enService: { code: 'V5', fichier: 'data/pat/principes_pat_V5.xlsx' }, brouillon: { code: 'V6', fichier: 'data/pat/principes_pat_V6.xlsx' } };

export async function initialiserVersionsSiAbsentes(q: Requete) {
  const faites: string[] = [];
  if (!(await versionEnService(q))) {
    const { code, fichier } = FICHIERS.enService;
    await installerEnService(q, code, await lireFichier(fichier, fs.readFileSync(fichier)), 'initialisation', fichier);
    faites.push(`principes ${code} en service`);
    if (!(await brouillon(q))) {
      const b = FICHIERS.brouillon;
      const r = await importerVersion(q, { nomFichier: b.fichier, contenu: fs.readFileSync(b.fichier), par: 'initialisation', code: b.code });
      if (r.erreurs.length) throw new Error(`${b.code} : ${r.erreurs.join(' ; ')}`);
      faites.push(`principes ${b.code} en brouillon`);
    }
  }
  if (!(await reglesEnService(q))) {
    await installerReglesEnService(q, 'V7', REGLAGES_PAT, 'initialisation', 'Règles de sélection V7 (regles_selection.xlsx, 30/09/2026).');
    faites.push('règles V7 en service');
  }
  return faites;
}
