import { Entete } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

const FOURNISSEURS: Record<string, string> = { email: 'E-mail', google: 'Google', apple: 'Apple' };
const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Comptes des utilisateurs de l'App consommateur (/pat). */
export default async function UtilisateursApp({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigerAdmin();
  const { q = '' } = await searchParams;
  const lignes = await requete<{ user_id: string; email: string; prenom: string | null; fournisseur: string; cree_le: string; derniere_connexion: string }>(
    `select user_id, email, prenom, fournisseur, cree_le::text, derniere_connexion::text from utilisateur_app
      where $1 = '' or email ilike '%' || $1 || '%' or prenom ilike '%' || $1 || '%' order by cree_le desc limit 500`, [q.trim()]);
  return (
    <>
      <Entete titre="Utilisateurs de l’App" texte="Les comptes de l’App de Pat (/pat) : créés avec un e-mail et un mot de passe, ou avec Google ou Apple." />
      <form method="get" className="carte-bo" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '14px 18px' }}>
        <div className="champ" style={{ flex: 1 }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={q} placeholder="Prénom ou e-mail…" /></div>
        <button className="btn petit">Chercher</button>
      </form>
      <p className="discret" style={{ margin: 0 }}>{lignes.length} compte{lignes.length > 1 ? 's' : ''}</p>
      {lignes.length > 0 && (
        <div className="tableau">
          <table style={{ minWidth: 640 }}>
            <thead><tr><th>Prénom</th><th>E-mail</th><th>Connexion</th><th>Créé le</th><th>Dernière visite</th></tr></thead>
            <tbody>
              {lignes.map((u) => (
                <tr key={u.user_id}><td><b>{u.prenom ?? '—'}</b></td><td>{u.email}</td><td>{FOURNISSEURS[u.fournisseur] ?? u.fournisseur}</td>
                  <td>{date(u.cree_le)}</td><td>{date(u.derniere_connexion)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
