// Démarrage du serveur : tâches de fond qui n'attendent aucune visite (serveur Node seulement, jamais l'« edge »).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
