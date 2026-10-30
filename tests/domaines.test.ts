import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adressePour, cote, redirectionDomaine } from '../src/lib/domaines';

const env = { URL_ADMIN: 'https://quidvinum.com', URL_PUBLIQUE: 'https://patlesommelier.com/' };

test('domaines : chaque page de son côté', () => {
  assert.equal(cote('/'), 'admin');
  assert.equal(cote('/admin/lola/carte'), 'admin');
  assert.equal(cote('/lola'), 'client');
  assert.equal(cote('/lola/plat/12'), 'client');
  assert.equal(cote('/pat/connexion'), 'client');
  assert.equal(cote('/administration'), 'client'); // un restaurant pourrait s'appeler ainsi
  for (const c of ['/api/sante', '/connexion/lien', '/conditions', '/pat/pat-logo-rouge.svg', '/.netlify/functions/x']) assert.equal(cote(c), 'commun', c);
});

test('domaines : renvois entre quidvinum.com et patlesommelier.com', () => {
  const r = (host: string, chemin: string) => redirectionDomaine(host, chemin, env);
  assert.equal(r('patlesommelier.com', '/'), 'https://quidvinum.com');
  assert.equal(r('patlesommelier.com', '/admin/lola'), 'https://quidvinum.com');
  assert.equal(r('patlesommelier.com', '/lola'), null);
  assert.equal(r('quidvinum.com', '/lola'), 'https://patlesommelier.com');
  assert.equal(r('quidvinum.com', '/pat'), 'https://patlesommelier.com');
  assert.equal(r('quidvinum.com', '/admin'), null);
  assert.equal(r('quidvinum.com', '/api/sante'), null);
  assert.equal(r('patlesommelier.com', '/connexion/lien'), null);
  assert.equal(r('www.quidvinum.com', '/admin'), 'https://quidvinum.com');
  assert.equal(r('www.patlesommelier.com', '/lola'), 'https://patlesommelier.com');
  assert.equal(r('www.quidvinum.com', '/api/sante'), 'https://quidvinum.com');
  assert.equal(r('essai.patlesommelier.com', '/admin'), null); // adresse d'essai : jamais renvoyée
  assert.equal(r('localhost:3124', '/'), null);
  assert.equal(redirectionDomaine('patlesommelier.com', '/', { URL_PUBLIQUE: 'https://patlesommelier.com' }), null); // sans URL_ADMIN
});

test('domaines : liens envoyés par e-mail', () => {
  assert.equal(adressePour('/admin/mot-de-passe', env), 'https://quidvinum.com');
  assert.equal(adressePour('/pat/mot-de-passe', env), 'https://patlesommelier.com');
  assert.equal(adressePour('/admin/mot-de-passe', { URL_PUBLIQUE: 'https://patlesommelier.com' }), 'https://patlesommelier.com');
  assert.equal(adressePour('/admin', {}), null);
});
