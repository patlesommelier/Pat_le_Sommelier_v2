import Link from 'next/link';
import { creerAcces, retirerAcces } from '../../actions';
import { CopierLien } from '@/components/admin/CopierLien';
import { Icone } from '@/components/admin/Icone';
import { Entete, Message } from '@/components/admin/Ui';
import { getAcces } from '@/lib/admin/donnees';
import { adresseApp, qrSvg } from '@/lib/admin/qr';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export default async function Acces({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [acces, url, [etat]] = await Promise.all([getAcces(resto), adresseApp(resto),
    requete<{ statut: string; manquants: number }>(`select statut, (select count(*)::int from plat pl where pl.restaurant_id = r.id and pl.actif
       and not exists (select 1 from accord a where a.plat_id = pl.id)) as manquants from restaurant r where id = $1`, [resto])]);
  const svg = await qrSvg(url);
  return (
    <>
      <Entete titre="Accès & QR code" texte="Les accès permettent de retrouver vos accords, vos règles et votre QR code depuis n’importe quel appareil. Le QR code ouvre Pat sur les tables de vos clients." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      {sp.lien && <div className="carte-bo" style={{ padding: '14px 20px' }}><CopierLien url={sp.lien} titre="Lien pour choisir son mot de passe" /></div>}
      {etat && etat.statut !== 'en_service' && (
        <p className="carte-bo" style={{ margin: 0, padding: '14px 20px', borderColor: 'var(--ocre)' }}>
          {etat.statut === 'suspendu'
            ? 'Votre app est suspendue : vos clients qui scannent le QR code voient « momentanément indisponible ».'
            : `Votre app n’est pas encore ouverte à vos clients : ils voient « La carte des vins de Pat arrive très bientôt ». Elle s’ouvre dès que tous vos plats ont leurs accords${etat.manquants ? ` (encore ${etat.manquants} plat${etat.manquants > 1 ? 's' : ''})` : ''}. Vous pouvez déjà imprimer le QR code.`}
        </p>
      )}
      <div className="rangee">
        <div className="etroit" style={{ flex: '1 1 380px' }}>
          <form action={creerAcces.bind(null, resto)} className="carte-bo pile">
            <div><h2>Créer un accès</h2><p className="sous">Pour vous ou un membre de l’équipe : la personne reçoit un e-mail d’invitation et choisit son mot de passe.</p></div>
            <div className="champ"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="off" /></div>
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 14 }}>Ou choisir le mot de passe moi-même (sans e-mail)</summary>
              <div className="pile" style={{ gap: 12, marginTop: 10 }}>
                <div className="champ"><label htmlFor="mdp">Mot de passe</label><input id="mdp" name="mdp" type="password" minLength={10} autoComplete="new-password" /><span className="aide">10 caractères minimum ; à communiquer vous-même à la personne</span></div>
                <div className="champ"><label htmlFor="mdp2">Confirmer le mot de passe</label><input id="mdp2" name="mdp2" type="password" autoComplete="new-password" /></div>
              </div>
            </details>
            <button type="submit" className="btn">Créer l’accès</button>
          </form>
          <div className="carte-bo pile">
            <h2>Accès existants</h2>
            {!acces.length && <span className="discret">Aucun accès pour l’instant.</span>}
            {acces.map((a) => (
              <div key={a.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid var(--ligne)', paddingTop: 10 }}>
                <span><b>{a.email}</b><br /><span className="discret">depuis le {a.cree_le}</span></span>
                <form action={retirerAcces.bind(null, resto, a.user_id)}><button className="btn fantome petit">Retirer</button></form>
              </div>
            ))}
          </div>
        </div>
        <div className="large" style={{ gap: 24 }}>
          <section className="carte-bo sticker pile">
            <div><h2>QR code de votre carte</h2><p className="sous">Il ouvre Pat le sommelier à vos couleurs, sans application à installer. Il ne change pas quand vous modifiez votre menu ou votre carte.</p></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
              <div role="img" aria-label="QR code de la carte" style={{ width: 200, height: 200, padding: 10, border: '1px solid var(--ligne)', borderRadius: 16, background: '#FFFFFF' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="pile" style={{ flex: '1 1 240px', gap: 12 }}>
                <CopierLien url={url} />
                <div className="ligne-actions">
                  <a href={`/admin/${resto}/acces/qr?format=png`} className="btn sec petit"><Icone nom="download" taille={18} />PNG</a>
                  <a href={`/admin/${resto}/acces/qr?format=svg`} className="btn sec petit"><Icone nom="download" taille={18} />SVG</a>
                  <Link href={`/admin/${resto}/acces/chevalet`} className="btn petit"><Icone nom="print" taille={18} />Chevalet de table (3 modèles)</Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
