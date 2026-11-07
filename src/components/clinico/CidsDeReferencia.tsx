import { useCidSugerido } from '@/hooks/useCidSugerido'
import { rotuloMotivo, sugestoesVisiveis, type CidSugerido } from '@/lib/cidSugerido'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// CIDs de referência a partir do texto da hipótese (achado guardado de
// 07/10/2026; decisão do RT em 06/11/2026, A em C1 a C7). O sistema mostra
// códigos de referência; a escolha é do médico. O clique só PREENCHE o campo
// CID: não registra, não grava diagnóstico. Quem chama decide o que fazer com
// o código (o campo continua editável e conferido como antes).
export function CidsDeReferencia({ texto, valorDoCampo, onEscolher, className }: {
  /** texto livre da hipótese (Avaliação do SOAP, ou o auxiliar do Diagnóstico) */
  texto: string
  /** o que está no campo CID agora, para não repetir o mesmo código */
  valorDoCampo: string
  onEscolher: (cid: CidSugerido) => void
  className?: string
}) {
  const q = useCidSugerido(texto)
  const lista = sugestoesVisiveis(q.data ?? [], valorDoCampo)
  if (lista.length === 0) return null
  return (
    <div role="group" aria-label="CIDs de referência" className={cn('flex flex-wrap items-center gap-1.5 text-rotulo text-tinta-sussurro', className)}>
      <span>CIDs de referência (só referência; a escolha é sua):</span>
      {lista.map((c) => (
        <Button key={c.codigo} type="button" size="xs" variant="outline" title={`${rotuloMotivo(c.motivo)}. ${c.descricao}`}
          onClick={() => onEscolher(c)}>
          <span className="font-semibold tabular-nums">{c.codigo}</span>
          <span className="max-w-56 truncate font-normal">{c.descricao}</span>
        </Button>
      ))}
    </div>
  )
}
