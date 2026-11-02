// Cépage écrit dans le nom d'un vin (« Riesling », « Alsace 'Pinot Gris' », « PORTILLO Malbec ») : il devient son cépage, sans IA.
// Sans « server-only » : fonction pure, testée, aussi utilisée en arrière-plan (recherche sur le site d'un distributeur).
const CEPAGES_NOMMES = ['pinot gris', 'pinot grigio', 'pinot blanc', 'pinot bianco', 'pinot noir', 'pinot nero', 'pinot meunier', 'riesling', 'gewurztraminer',
  'sylvaner', 'muscat', 'chardonnay', 'sauvignon blanc', 'sauvignon', 'chenin blanc', 'chenin', 'viognier', 'gamay', 'syrah', 'shiraz', 'grenache',
  'merlot', 'cabernet franc', 'cabernet sauvignon', 'malbec', 'carmenere', 'pinotage', 'zinfandel', 'nero d avola', 'nebbiolo', 'sangiovese', 'barbera',
  'primitivo', 'aglianico', 'montepulciano', 'vermentino', 'grillo', 'fiano', 'falanghina', 'friulano', 'ribolla gialla', 'garganega', 'glera', 'trebbiano',
  'tempranillo', 'garnacha', 'monastrell', 'mencia', 'godello', 'verdejo', 'albarino', 'gruner veltliner', 'blaufrankisch', 'zweigelt', 'furmint',
  'assyrtiko', 'xinomavro', 'auxerrois', 'aligote', 'marsanne', 'roussanne', 'picpoul', 'carignan', 'cinsault', 'mourvedre', 'petit verdot', 'tannat',
  'gros manseng', 'petit manseng', 'colombard', 'touriga nacional', 'alvarinho', 'torrontes', 'semillon', 'muller thurgau', 'silvaner'];

/** Cépages nommés dans le nom du vin (en minuscules, séparés par des virgules) ; null s'il n'y en a pas. */
export function cepageDuNom(libelle: string): string | null {
  const t = ` ${libelle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  const trouves = CEPAGES_NOMMES.filter((c) => t.includes(` ${c} `)).filter((c, _, l) => !l.some((x) => x !== c && x.includes(c)));
  return trouves.length ? trouves.join(', ') : null;
}
