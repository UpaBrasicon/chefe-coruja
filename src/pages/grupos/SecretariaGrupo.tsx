import { Network } from 'lucide-react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { RedeSecretaria } from '@/pages/admin/RedeSecretaria'

/**
 * Rede do perfil Gestor da secretaria (pedido do RT, 24/11/2026): a árvore só
 * com a secretaria da pessoa, as mesmas fichas, e o caminho para configurar
 * cada unidade, a escala e os convites. O banco confere (rede_arvore_da_secretaria
 * e secretaria_gere_unidade, migration 20270421000023).
 */
export default function SecretariaGrupo() {
  return (
    <div className="flex flex-col gap-4">
      <TituloPagina
        icone={Network}
        titulo="Rede da secretaria"
        descricao="As unidades da sua secretaria. Abra uma unidade para ver a ficha, configurar setores e leitos, as vagas da escala e convidar pessoas."
        className="mb-0"
      />
      <RedeSecretaria modo="secretaria" />
    </div>
  )
}
