import { Coque } from '../Coque';
import { deciderProducteur } from '../actions';
import { Entete } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { getProducteursProposes } from '@/lib/admin/donnees';

export default async function ProducteursProposes() {
  const u = await exigerAdmin();
  const prods = await getProducteursProposes();
  return (
    <Coque utilisateur={u} etapes={[]}>
      <Entete titre="Producteurs proposés"
        texte="Producteurs trouvés sur les cartes des restaurants et absents de votre base. Validez-les pour qu’ils comptent comme les autres ; pour les garder durablement, ajoutez-les aussi à vos fichiers producteurs." />
      {!prods.length && <p className="discret">Aucun producteur en attente.</p>}
      <div className="pile">
        {prods.map((p) => (
          <article key={p.id} className="carte-bo pile" style={{ gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><h2 style={{ fontSize: 19 }}>{p.nom}</h2><span className="discret">{[p.region, p.pays].filter(Boolean).join(' · ')} · {p.id}</span></div>
              <div className="ligne-actions">
                <form action={deciderProducteur.bind(null, p.id, 'valide')}><button className="btn petit">Valider</button></form>
                <form action={deciderProducteur.bind(null, p.id, 'retire')}><button className="btn sec petit">Écarter</button></form>
              </div>
            </div>
            {p.vins && <span className="discret">Sur la carte : {p.vins}</span>}
            {p.notes_objectives && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{p.notes_objectives}</p>}
            {p.a_verifier && <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)', margin: 0 }}>À vérifier : {p.a_verifier}</p>}
          </article>
        ))}
      </div>
    </Coque>
  );
}
