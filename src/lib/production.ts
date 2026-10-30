// En production (Netlify, ou serveur Hetzner lancé par « next start ») : jamais de raccourci de développement
// (connexion de test sans mot de passe, photos gardées sur le disque, inscription sans compte).
export const enProduction = () => Boolean(process.env.NETLIFY) || process.env.NODE_ENV === 'production';
