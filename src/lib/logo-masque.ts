// Logo recoloré par un masque CSS (logo clair sur fond blanc, imprimé à la couleur du restaurant) : le navigateur
// refuse un masque pris sur un autre site (le stockage des logos) ; le logo passe donc par l'adresse du site.

/** Adresse du logo utilisable comme masque : sur le site même (inchangée si elle y est déjà). */
export const logoPourMasque = (url: string) => /^https?:\/\//i.test(url) ? `/api/logo?u=${encodeURIComponent(url)}` : url;
