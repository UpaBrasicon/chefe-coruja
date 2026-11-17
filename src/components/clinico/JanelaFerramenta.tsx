import { useQuery } from '@tanstack/react-query'
import { ExternalLink, UserCheck } from 'lucide-react'
import * as React from 'react'
import { Link, Route, Routes } from 'react-router-dom'

import { RelacionadasContexto } from '@/components/plantonista/calc/contexto'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { acharSecao } from '@/content/registry'
import type { FaixaEtaria } from '@/domain/idade'
import { ROTULO_BLOCO_CID } from '@/lib/ferramentasDoCid'
import { alterarPaciente, definirModo } from '@/lib/pacienteCentral'
import { idadeParaFerramenta, pesoParaFerramenta, type PesoAferido } from '@/lib/pacienteDoAtendimento'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// F3 das ferramentas pelo CID (pedido do RT de 17/11/2026, CF5 = A, e as
// condições da sessão de obrigatórios legais). A ferramenta abre por cima do
// atendimento, sem sair dele (o rascunho do SOAP continua salvo no servidor).
// Idade e peso do prontuário só entram na ferramenta depois do clique em "Usar
// idade e peso"; o selo do campo diz a origem e a data, e o campo continua
// editável. Peso velho não vai (criança > 24 h, adulto > 7 dias). Nada do
// paciente vai na URL: a rota da ferramenta é só o endereço interno da janela.
// Abrir e fechar zera o paciente da Central desta aba, para o dado de um
// paciente nunca aparecer na ferramenta de outro.

export type FerramentaNaJanela = { rota: string; rotulo: string }

function componenteDaRota(rota: string) {
  const [, , secao, slug] = rota.split('/')
  return acharSecao(secao)?.tools.find((t) => t.slug === slug)?.component ?? null
}

const modoDaFaixa = (faixa: FaixaEtaria) => (faixa === 'pediatrico' ? 'pediatrico' : faixa === 'adulto' ? 'adulto' : null)

export function JanelaFerramenta({ ferramenta, pacienteId, nascimento, faixa, aoFechar }: {
  ferramenta: FerramentaNaJanela | null
  pacienteId: string
  nascimento: string | null
  faixa: FaixaEtaria
  aoFechar: () => void
}) {
  const [usou, setUsou] = React.useState(false)
  const [versao, setVersao] = React.useState(0)
  const aberta = ferramenta !== null

  // zera a Central ao abrir (no modo da idade do paciente) e ao fechar. Cada
  // ferramenta aberta é uma janela nova (key no FerramentasDoCid): "usou" e a
  // versão começam do zero.
  React.useEffect(() => {
    if (!aberta) return
    definirModo(modoDaFaixa(faixa))
    return () => definirModo(null)
  }, [aberta, faixa])

  const peso = useQuery({
    queryKey: ['peso-atual', pacienteId],
    enabled: aberta,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observacao').select('valor_num, aferido_em, conceito!inner(nome)')
        .eq('paciente_id', pacienteId).eq('conceito.nome', 'peso').order('aferido_em', { ascending: false }).limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as PesoAferido | null
    },
  })
  const agora = new Date()
  const idade = idadeParaFerramenta(nascimento, agora)
  const pesoUsavel = pesoParaFerramenta(peso.data, faixa, agora)
  const temAlgo = idade !== null || pesoUsavel.kg !== null

  function usarDados() {
    const origem = pesoUsavel.kg !== null ? pesoUsavel.origem : 'idade do prontuário'
    alterarPaciente({
      peso: pesoUsavel.kg !== null ? String(pesoUsavel.kg).replace('.', ',') : '',
      idade: idade ? String(idade.valor) : '',
      unidadeIdade: idade?.unidade ?? 'anos',
      origem,
    })
    setUsou(true)
    setVersao((v) => v + 1) // a ferramenta lê a Central uma vez, ao abrir: remonta
  }

  const Componente = ferramenta ? componenteDaRota(ferramenta.rota) : null
  return (
    <Dialog open={aberta} onOpenChange={(o) => { if (!o) aoFechar() }}>
      <DialogContent className="h-dvh max-h-dvh w-full max-w-none rounded-none p-3 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-cartao sm:p-5">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="text-controle font-semibold text-tinta">{ferramenta?.rotulo}</DialogTitle>
          <DialogDescription className="text-rotulo text-tinta-sussurro">{ROTULO_BLOCO_CID}</DialogDescription>
        </div>
        <div role="group" aria-label="Dados do atendimento" className="flex flex-wrap items-center gap-2 rounded-cartao border border-fio bg-campo px-3 py-2 text-apoio">
          <span className="font-medium text-tinta">Do atendimento:</span>
          <span>{idade ? `idade ${idade.rotulo}` : 'sem data de nascimento'}</span>
          <span aria-hidden>·</span>
          <span>{peso.isLoading ? 'peso…' : pesoUsavel.kg !== null ? `${String(pesoUsavel.kg).replace('.', ',')} kg (${pesoUsavel.origem})` : pesoUsavel.motivo}</span>
          {usou ? (
            <span className="ml-auto text-rotulo text-tinta-sussurro">Na ferramenta, com o selo da origem. Confira e mude no campo se precisar.</span>
          ) : (
            <Button type="button" size="xs" variant="outline" className="ml-auto" disabled={!temAlgo || peso.isLoading} onClick={usarDados}>
              <UserCheck className="size-3.5" aria-hidden /> Usar idade e peso na ferramenta
            </Button>
          )}
        </div>
        {ferramenta && Componente ? (
          <RelacionadasContexto.Provider value={[]}>
            <React.Suspense fallback={<p className="text-apoio text-tinta-sussurro">Abrindo a ferramenta…</p>}>
              <Routes location={ferramenta.rota}>
                <Route path="/plantonista/:section/:tool" element={React.createElement(Componente, { key: versao })} />
              </Routes>
            </React.Suspense>
          </RelacionadasContexto.Provider>
        ) : (
          <p className="text-apoio text-tinta-sussurro">Ferramenta não encontrada na Central.</p>
        )}
        {ferramenta && (
          <Link to={ferramenta.rota} target="_blank" rel="noopener"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'self-start')}>
            Abrir na Central, numa aba nova <ExternalLink className="size-3" aria-hidden />
          </Link>
        )}
      </DialogContent>
    </Dialog>
  )
}
