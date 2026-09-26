import { useParams } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { FolderSearch, Star } from 'lucide-react'

import { acharSecao, CHAVES_FERRAMENTAS } from '@/content/registry'
import { chaveFerramenta, registrarRecente, useFavoritos } from '@/lib/useFavoritos'
import { cn } from '@/lib/utils'
import { Trilha, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

export function ToolRouter() {
  const { section, tool } = useParams()
  const secao = acharSecao(section ?? '')
  const def = secao?.tools.find((t) => t.slug === tool)
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)

  useEffect(() => {
    if (section && tool) registrarRecente(chaveFerramenta(section, tool))
  }, [section, tool])

  if (!secao || !def) {
    return <Vazio icone={FolderSearch} titulo="Ferramenta não encontrada" texto="O endereço não corresponde a nenhuma ferramenta da Central." />
  }

  const Component = def.component
  const chave = chaveFerramenta(secao.slug, def.slug)
  const ehFavorito = favoritos.includes(chave)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Trilha niveis={[{ rotulo: 'Central do Plantonista', to: '/plantonista' }, { rotulo: secao.label, to: `/plantonista/${secao.slug}` }, { rotulo: def.label }]} />
        <Button variant="ghost" size="sm" aria-pressed={ehFavorito} onClick={() => alternarFavorito(chave)}>
          <Star className={cn(ehFavorito && 'fill-marca text-marca')} />
          {ehFavorito ? 'Favorita' : 'Favoritar'}
        </Button>
      </div>
      <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
        {/* Estado de resposta por ferramenta: a chave remonta o formulário, e
            as respostas de um escore não vazam para o próximo (telas/20). */}
        <Component key={chave} />
      </Suspense>
    </>
  )
}
