import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useUnidade, type VinculoComUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_LABEL, ROTA_INICIAL } from '@/lib/constants'
import { PaginaEntrada } from '@/components/entrada/LadoMarca'

export function SeletorUnidade() {
  const { unidades, setUnidadeAtivaId } = useUnidade()
  const navigate = useNavigate()

  function escolher(unidade: VinculoComUnidade) {
    setUnidadeAtivaId(unidade.unidade_id)
    navigate(ROTA_INICIAL[unidade.papel], { replace: true })
  }

  return (
    <PaginaEntrada titulo="Escolha a unidade." abertura="Selecione a unidade em que vai trabalhar agora. Vale o papel que você tem nela.">
      <div className="cc-linhas">
        {unidades.map((u) => (
          // padrao-ok: linha de registro clicável da tela de marca (entrada.css), não um botão de ação
          <button key={u.unidade_id} type="button" className="cc-linha px-1" onClick={() => escolher(u)}>
            <span className="flex flex-col gap-0.5">
              <b>{u.unidade.nome}</b>
              <span>{PAPEL_LABEL[u.papel]}</span>
            </span>
            <ArrowRight className="size-4 text-acao" aria-hidden />
          </button>
        ))}
      </div>
    </PaginaEntrada>
  )
}
