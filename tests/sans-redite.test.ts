import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sansRedite } from '../src/lib/admin/intitule';

test('intitulé sans redite', () => {
  assert.equal(sansRedite('Châteauneuf-du-Pape CHATEAUNEUF DU PAPE'), 'Châteauneuf-du-Pape');
  assert.equal(sansRedite('CHATEAUNEUF DU PAPE Châteauneuf-du-Pape Domaine X'), 'Châteauneuf-du-Pape Domaine X');
  assert.equal(sansRedite('Saint Joseph "Les Ediles" Domaine de Bonserine'), 'Saint Joseph "Les Ediles" Domaine de Bonserine');
  assert.equal(sansRedite('Côtes du Rhône Villages Domaine Mont Redon'), 'Côtes du Rhône Villages Domaine Mont Redon');
  assert.equal(sansRedite('Domaine du Pont du Pont'), 'Domaine du Pont');
});
