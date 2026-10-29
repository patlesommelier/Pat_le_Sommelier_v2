# Pat le Sommelier sur un serveur (Hetzner + Coolify) : construit le site Next.js, puis, à chaque démarrage,
# applique les migrations de la base (comme le faisait le build Netlify) et lance le serveur sur le port 3000.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependances
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS construction
COPY --from=dependances /app/node_modules ./node_modules
COPY . .
# Variables lues par le navigateur : fournies au moment de la construction (« Build Variable » dans Coolify).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DEMO_URL
RUN npm run build

FROM base AS service
ENV NODE_ENV=production PORT=3000
COPY --from=construction /app ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm run migrer && exec node_modules/.bin/next start"]
