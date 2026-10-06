import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Inscription : pages du menu et de la carte (images réduites dans le navigateur). Netlify refuse au-delà de 6 Mo par requête.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  // Ancien parcours d'inscription sur mobile : remplacé par le formulaire de la page d'accueil.
  async redirects() {
    return [{ source: '/inscription/:chemin*', destination: '/', permanent: false }];
  },
};

export default nextConfig;
