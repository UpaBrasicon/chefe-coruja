// LG7, decisão A3: o médico abre a sessão de assinatura ICP-Brasil uma vez no
// começo do plantão (autoriza no celular, no aplicativo do provedor). Some da
// tela enquanto o assinador não estiver ligado ou sem provedor configurado.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSignature } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  assinaturaLigada, encerrarSessaoAssinatura, iniciarSessaoAssinatura, minhaSessaoAssinatura, textoDaSessao,
} from '@/lib/assinador'

export function SessaoAssinatura() {
  const ligada = assinaturaLigada()
  const qc = useQueryClient()
  const sessao = useQuery({
    queryKey: ['sessao-assinatura'],
    enabled: ligada,
    queryFn: minhaSessaoAssinatura,
    refetchOnWindowFocus: true, // volta da janela do provedor
    staleTime: 30_000,
  })
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    const ao = () => void qc.invalidateQueries({ queryKey: ['sessao-assinatura'] })
    window.addEventListener('cc-documento-assinado', ao)
    return () => window.removeEventListener('cc-documento-assinado', ao)
  }, [qc])

  if (!ligada || !sessao.data || sessao.data.provedores.length === 0) return null
  const s = sessao.data

  async function agir(fn: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['sessao-assinatura'] })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-label="Assinatura ICP-Brasil" className="mb-[22px] flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-3 shadow-repouso">
      <div className="flex flex-wrap items-center gap-2.5">
        <FileSignature className="size-4 shrink-0 text-acao" aria-hidden />
        <span className="min-w-0 flex-[1_1_240px] text-apoio text-pretty text-tinta">{textoDaSessao(s)}</span>
        {s.ativa ? (
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void agir(encerrarSessaoAssinatura)}>
            Encerrar sessão
          </Button>
        ) : (
          s.provedores.map((p) => (
            <Button key={p.id} size="sm" disabled={ocupado} onClick={() => void agir(() => iniciarSessaoAssinatura(p.id))}>
              Iniciar com {p.nome}
            </Button>
          ))
        )}
      </div>
      {!s.ativa && (
        <p className="text-rotulo text-tinta-sussurro">
          Abre a página do seu certificado em nuvem. Autorize no celular e volte aqui: a sessão vale até o fim do plantão.
        </p>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
    </section>
  )
}
