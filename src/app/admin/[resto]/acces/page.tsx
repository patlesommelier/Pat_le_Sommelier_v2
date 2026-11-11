import Link from 'next/link';
import { CopierLien } from '@/components/admin/CopierLien';
import { Icone } from '@/components/admin/Icone';
import { Entete, Message } from '@/components/admin/Ui';
import { adresseApp, qrSvg } from '@/lib/admin/qr';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export default async function Acces({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [url, [etat]] = await Promise.all([adresseApp(resto),
    requete<{ statut: string; manquants: number }>(`select statut, (select count(*)::int from plat pl where pl.restaurant_id = r.id and pl.actif
       and not exists (select 1 from accord a where a.plat_id = pl.id)) as manquants from restaurant r where id = $1`, [resto])]);
  const svg = await qrSvg(url);
  return (
    <>
      <Entete titre="QR code" texte="Le QR code ouvre Pat sur les tables de vos clients. Les utilisateurs de votre espace se gèrent dans Paramètres du restaurant." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      {etat && etat.statut !== 'en_service' && (
        <p className="carte-bo" style={{ margin: 0, padding: '14px 20px', borderColor: 'var(--ocre)' }}>
          {etat.statut === 'suspendu'
            ? 'Votre app est suspendue : vos clients qui scannent le QR code voient « momentanément indisponible ».'
            : `Votre app n’est pas encore ouverte à vos clients : ils voient « La carte des vins de Pat arrive très bientôt ». Elle s’ouvre dès que tous vos plats ont leurs accords${etat.manquants ? ` (encore ${etat.manquants} plat${etat.manquants > 1 ? 's' : ''})` : ''}. Vous pouvez déjà imprimer le QR code.`}
        </p>
      )}
      <div className="rangee">
        <div className="large" style={{ gap: 24 }}>
          <section className="carte-bo sticker pile">
            <div><h2>QR code de votre carte</h2><p className="sous">Il ouvre Pat le sommelier à vos couleurs, sans application à installer. Il ne change pas quand vous modifiez votre menu ou votre carte.</p></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
              <div role="img" aria-label="QR code de la carte" style={{ width: 200, height: 200, padding: 10, border: '1px solid var(--ligne)', borderRadius: 16, background: '#FFFFFF' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="pile" style={{ flex: '1 1 240px', gap: 12 }}>
                <CopierLien url={url} />
                <div className="ligne-actions">
                  <a href={`/admin/${resto}/acces/qr?format=png`} className="btn sec petit"><Icone nom="download" taille={18} />Image</a>
                  <a href={`/admin/${resto}/acces/qr?format=svg`} className="btn sec petit"><Icone nom="download" taille={18} />Fichier pour l’imprimeur</a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
