import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Inscription : photos du menu et de la carte (réduites dans le navigateur). Netlify refuse au-delà de 6 Mo par requête.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default nextConfig;
