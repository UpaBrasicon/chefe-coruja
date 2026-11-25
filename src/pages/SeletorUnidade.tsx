import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_LABEL } from '@/lib/constants'
import { agruparPerfisPorUnidade, type GrupoDePerfis } from '@/lib/perfisPorUnidade'
import { telaAoEntrar } from '@/components/casca/navegacao'
import { PaginaEntrada } from '@/components/entrada/LadoMarca'
import type { Papel } from '@/types/database'

export function SeletorUnidade() {
  const { vinculos, unidadeAtiva, papeisDaUnidade, setUnidadeAtivaId } = useUnidade()
  const navigate = useNavigate()
  // Todos os papéis de cada unidade (RT, 25/11/2026): antes a linha mostrava
  // só o primeiro vínculo da unidade e os outros perfis pareciam ter sumido.
  const grupos = useMemo(
    () => agruparPerfisPorUnidade(vinculos, unidadeAtiva?.unidade_id, papeisDaUnidade),
    [vinculos, unidadeAtiva?.unidade_id, papeisDaUnidade],
  )

  function escolher(grupo: GrupoDePerfis, papel: Papel) {
    setUnidadeAtivaId(grupo.unidadeId, papel)
    // A mesma regra da tela inicial (RedirectHome): numa UBS a tela de porta ou
    // de leito dá lugar ao primeiro item do menu do papel, e a recepção abre em
    // "Hoje". Sem isso, escolher uma UBS aqui caía no Pronto-Socorro da
    // enfermagem ou na Triagem, telas que a UBS não tem (teste de fluxo, 25/11/2026).
    navigate(telaAoEntrar(papel, grupo.tipo), { replace: true })
  }

  return (
    <PaginaEntrada titulo="Escolha a unidade." abertura="Selecione a unidade e o perfil em que vai trabalhar agora.">
      <div className="cc-linhas">
        {grupos.map((g) =>
          g.papeis.length === 1 ? (
            // padrao-ok: linha de registro clicável da tela de marca (entrada.css), não um botão de ação
            <button key={g.unidadeId} type="button" className="cc-linha px-1" onClick={() => escolher(g, g.papeis[0])}>
              <span className="flex flex-col gap-0.5">
                <b>{g.nome}</b>
                <span>{PAPEL_LABEL[g.papeis[0]]}</span>
              </span>
              <ArrowRight className="size-4 text-acao" aria-hidden />
            </button>
          ) : (
            <div key={g.unidadeId} className="cc-linha px-1" role="group" aria-label={g.nome}>
              <b>{g.nome}</b>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {g.papeis.map((p) => (
                  <Button key={p} variant="outline" size="lg" onClick={() => escolher(g, p)} aria-label={`${PAPEL_LABEL[p]} · ${g.nome}`}>
                    {PAPEL_LABEL[p]}
                    <ArrowRight className="size-3.5 text-acao" aria-hidden />
                  </Button>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </PaginaEntrada>
  )
}
