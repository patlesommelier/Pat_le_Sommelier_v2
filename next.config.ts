import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Envois de fichiers : pages du menu et de la carte, tarifs des distributeurs (PDF ou Excel, 20 Mo au plus).
  // (middlewareClientMaxBodySize : un envoi qui passerait quand même par le middleware n'est pas coupé à 10 Mo.)
  experimental: { serverActions: { bodySizeLimit: '21mb' }, middlewareClientMaxBodySize: '21mb' },
  // Lecture du texte des PDF (tarifs) : laissée hors du paquet du serveur.
  serverExternalPackages: ['unpdf'],
  // Ancien parcours d'inscription sur mobile : remplacé par le formulaire de la page d'accueil.
  async redirects() {
    return [{ source: '/inscription/:chemin*', destination: '/', permanent: false }];
  },
};

export default nextConfig;
