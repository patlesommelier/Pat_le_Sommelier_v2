// pg ne publie pas de types pour ce module interne : prepareValue convertit une valeur JS comme pg le fait
// pour ses paramètres (tableaux → littéral Postgres, dates, JSON…).
declare module 'pg/lib/utils' {
  export function prepareValue(valeur: unknown): unknown;
}
