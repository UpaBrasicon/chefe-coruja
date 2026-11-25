import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useUnidade, type VinculoComUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_LABEL, ROTA_INICIAL } from '@/lib/constants'
import { foraDoTipo, inicioDoPapel } from '@/components/casca/navegacao'
import { PaginaEntrada } from '@/components/entrada/LadoMarca'

export function SeletorUnidade() {
  const { unidades, setUnidadeAtivaId } = useUnidade()
  const navigate = useNavigate()

  function escolher(unidade: VinculoComUnidade) {
    setUnidadeAtivaId(unidade.unidade_id, unidade.papel)
    // A mesma regra da tela inicial (RedirectHome): numa UBS a tela de porta ou
    // de leito dá lugar ao primeiro item do menu do papel, e a recepção abre em
    // "Hoje". Sem isso, escolher uma UBS aqui caía no Pronto-Socorro da
    // enfermagem ou na Triagem, telas que a UBS não tem (teste de fluxo, 25/11/2026).
    const tipo = unidade.unidade.tipo ?? null
    const inicial = ROTA_INICIAL[unidade.papel]
    const alvo = tipo === 'ubs' && unidade.papel === 'recepcao' ? '/recepcao/hoje'
      : foraDoTipo(inicial, tipo) ? inicioDoPapel(unidade.papel, tipo) : inicial
    navigate(alvo, { replace: true })
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
