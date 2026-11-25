import { ArrowRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_LABEL } from '@/lib/constants'
import { BUSCA_DE_UNIDADES_A_PARTIR, agruparPerfisPorUnidade, filtrarGrupos, type GrupoDePerfis } from '@/lib/perfisPorUnidade'
import { telaAoEntrar } from '@/components/casca/navegacao'
import { PaginaEntrada } from '@/components/entrada/LadoMarca'
import type { Papel } from '@/types/database'

// ME2 (revisão das telas novas, RT 25/11/2026): a unidade em uso (ou a última
// usada) no topo, marcada "em uso", e as outras sempre em ordem alfabética; a
// ordem parecia mudar entre visitas porque a unidade em uso subia sem marca.
// Busca quando há mais de seis unidades. O administrador geral aparece uma
// vez, à parte, em vez de entrar só na unidade em uso.
const rotuloPapel = (p: Papel) => PAPEL_LABEL[p]

export function SeletorUnidade() {
  const { vinculos, unidadeAtiva, ehSuperAdmin, setUnidadeAtivaId } = useUnidade()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  // Todos os papéis de cada unidade (RT, 25/11/2026): antes a linha mostrava
  // só o primeiro vínculo da unidade e os outros perfis pareciam ter sumido.
  const grupos = useMemo(
    () => agruparPerfisPorUnidade(vinculos, unidadeAtiva?.unidade_id, ehSuperAdmin),
    [vinculos, unidadeAtiva?.unidade_id, ehSuperAdmin],
  )
  const comBusca = grupos.length >= BUSCA_DE_UNIDADES_A_PARTIR
  const visiveis = comBusca ? filtrarGrupos(grupos, busca, rotuloPapel) : grupos

  function escolher(grupo: GrupoDePerfis, papel: Papel) {
    setUnidadeAtivaId(grupo.unidadeId, papel)
    // A mesma regra da tela inicial (RedirectHome): numa UBS a tela de porta ou
    // de leito dá lugar ao primeiro item do menu do papel, e a recepção abre em
    // "Hoje". Sem isso, escolher uma UBS aqui caía no Pronto-Socorro da
    // enfermagem ou na Triagem, telas que a UBS não tem (teste de fluxo, 25/11/2026).
    navigate(telaAoEntrar(papel, grupo.tipo), { replace: true })
  }

  const nomeDaUnidade = (g: GrupoDePerfis) => (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <b>{g.nome}</b>
      {g.ativa && <span className="text-rotulo text-tinta-sussurro">em uso</span>}
    </span>
  )
  const ativa = grupos.find((g) => g.ativa) ?? grupos[0]

  return (
    <PaginaEntrada titulo="Escolha a unidade" abertura="Selecione a unidade e o perfil em que vai trabalhar agora.">
      {comBusca && (
        <label className="relative mb-3 flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-tinta-sussurro" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" placeholder="Buscar unidade ou perfil" aria-label="Buscar unidade ou perfil" />
        </label>
      )}
      <div className="cc-linhas">
        {ehSuperAdmin && ativa && !busca.trim() && (
          // padrao-ok: linha de registro clicável da tela de marca (entrada.css), não um botão de ação
          <button type="button" className="cc-linha px-1" onClick={() => escolher(ativa, 'admin')}>
            <span className="flex flex-col gap-0.5">
              <b>Toda a rede</b>
              <span>{PAPEL_LABEL.admin}</span>
            </span>
            <ArrowRight className="size-4 text-acao" aria-hidden />
          </button>
        )}
        {visiveis.length === 0 && <p className="px-1 py-3 text-apoio text-tinta-sussurro">Nenhuma unidade com esse nome.</p>}
        {visiveis.map((g) =>
          g.papeis.length === 1 ? (
            // padrao-ok: linha de registro clicável da tela de marca (entrada.css), não um botão de ação
            <button key={g.unidadeId} type="button" className="cc-linha px-1" onClick={() => escolher(g, g.papeis[0])}
              aria-label={`${PAPEL_LABEL[g.papeis[0]]} · ${g.nome}${g.ativa ? ' (em uso)' : ''}`}>
              <span className="flex flex-col gap-0.5">
                {nomeDaUnidade(g)}
                <span>{PAPEL_LABEL[g.papeis[0]]}</span>
              </span>
              <ArrowRight className="size-4 text-acao" aria-hidden />
            </button>
          ) : (
            <div key={g.unidadeId} className="cc-linha px-1" role="group" aria-label={`${g.nome}${g.ativa ? ' (em uso)' : ''}`}>
              {nomeDaUnidade(g)}
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
