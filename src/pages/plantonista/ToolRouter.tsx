import { useParams } from 'react-router-dom'
import { Suspense } from 'react'
import { FolderSearch, Star } from 'lucide-react'

import { acharSecao, CHAVES_FERRAMENTAS, secaoExibida } from '@/content/registry'
import { publicoDaFerramenta } from '@/content/publicoFerramentas'
import { chaveFerramenta, useFavoritos, useRegistrarUso } from '@/lib/useFavoritos'
import { cn } from '@/lib/utils'
import { Trilha, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { FaixaModo, SeloSemReferenciaPediatrica } from '@/components/plantonista/central/ModoNaFerramenta'
import { LateralSecao } from '@/components/plantonista/LateralSecao'
import { useModoNaFerramenta } from '@/lib/pacienteCentral'

export function ToolRouter() {
  const { section, tool } = useParams()
  const secao = acharSecao(section ?? '')
  // a seção como a Central mostra (as Calculadoras aparecem dentro das condutas do adulto)
  const exibida = secaoExibida(section ?? '')
  const def = secao?.tools.find((t) => t.slug === tool)
  const { favoritos, usos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const chave = secao && def ? chaveFerramenta(secao.slug, def.slug) : null
  const publico = publicoDaFerramenta(secao?.slug ?? '', def?.slug ?? '', def?.publico)
  const { suprimir } = useModoNaFerramenta(publico)

  useRegistrarUso(chave)

  if (!secao || !def || !chave) {
    return <Vazio icone={FolderSearch} titulo="Ferramenta não encontrada" texto="O endereço não corresponde a nenhuma ferramenta da Central." />
  }

  const Component = def.component
  const ehFavorito = favoritos.includes(chave)
  const vezes = usos[chave] ?? 0

  return (
    // Leitura de manual (revisão visual 3.8, opção C): a seção à esquerda, a ferramenta ao lado.
    <div className="grid items-start gap-x-8 lg:grid-cols-[232px_minmax(0,1fr)]">
      {exibida && <LateralSecao secao={exibida} atual={{ secao: secao.slug, slug: def.slug }} />}
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Trilha niveis={[{ rotulo: 'Central do Plantonista', to: '/plantonista' }, { rotulo: exibida?.label ?? secao.label, to: `/plantonista/${exibida?.slug ?? secao.slug}` }, { rotulo: def.label }]} />
          <div className="flex flex-wrap items-center gap-2">
            <SeloSemReferenciaPediatrica publico={publico} />
            {vezes > 0 && <span className="text-rotulo text-tinta-sussurro tabular" title="Quantas vezes você abriu esta ferramenta">{vezes}×</span>}
            <Button variant="ghost" size="sm" aria-pressed={ehFavorito} onClick={() => alternarFavorito(chave)}>
              <Star className={cn(ehFavorito && 'fill-acao text-acao')} />
              {ehFavorito ? 'Favorita' : 'Favoritar'}
            </Button>
          </div>
        </div>
        <FaixaModo publico={publico} />
        {!suprimir && (
          <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
            {/* Estado de resposta por ferramenta: a chave remonta o formulário, e
                as respostas de um escore não vazam para o próximo (telas/20). */}
            <Component key={chave} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
