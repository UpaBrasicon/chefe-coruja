// "Designar gestor" na ficha da unidade, para o perfil Gestor da secretaria
// (RT, 25/11/2026; teste de fluxo A, A-17). O primeiro gestor de uma unidade
// nova não entra por convite: quem designa é a gestão da secretaria, escolhendo
// uma pessoa com conta ativa. O banco confere (secretaria_gere_unidade,
// migration 20270426000015) e avisa a pessoa designada.
//
// BT2 (revisão das telas novas, RT 25/11/2026): a unidade pode ter mais de um
// gestor; designar ACRESCENTA (o banco só dá o vínculo novo e não desliga
// ninguém). A busca abre dentro da própria gaveta, na seção Gestão, sem janela
// por cima; mostra o resultado ao digitar; e a confirmação diz o que muda.
import { useMutation, useQuery } from '@tanstack/react-query'
import { UserCheck } from 'lucide-react'
import * as React from 'react'

import { OpcaoLista } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { confirmacaoDeGestor, ordemDaBusca, termoDeBuscaDeConta } from '@/lib/redeSecretaria'
import { supabase } from '@/lib/supabase'

type Conta = { perfil_id: string; nome: string; email: string | null; ja_gestor: boolean }

export function DesignarGestor({ unidadeId, unidadeNome, gestoresAtuais, onDesignado }: {
  unidadeId: string; unidadeNome: string; gestoresAtuais: string[]; onDesignado: () => void
}) {
  const [aberto, setAberto] = React.useState(false)
  const [texto, setTexto] = React.useState('')
  const [buscado, setBuscado] = React.useState('')
  const [escolhida, setEscolhida] = React.useState<Conta | null>(null)
  const [feito, setFeito] = React.useState<string | null>(null)
  const termo = termoDeBuscaDeConta(texto)

  // resultado ao digitar: busca 300 ms depois da última letra
  React.useEffect(() => {
    const t = window.setTimeout(() => setBuscado(termo ?? ''), 300)
    return () => window.clearTimeout(t)
  }, [termo])

  const contas = useQuery({
    queryKey: ['secretaria-buscar-contas', unidadeId, buscado],
    enabled: aberto && buscado !== '',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('secretaria_buscar_contas', { p_unidade: unidadeId, p_termo: buscado })
      if (error) throw error
      return ordemDaBusca((data ?? []) as Conta[])
    },
  })
  const designar = useMutation({
    mutationFn: async (c: Conta) => {
      const { data, error } = await supabase.rpc('secretaria_designar_gestor', { p_unidade: unidadeId, p_perfil: c.perfil_id })
      if (error) throw error
      return data as unknown as { mudou: boolean; nome: string }
    },
    onSuccess: (r) => {
      setFeito(r.mudou ? `${r.nome} agora também é gestor da ${unidadeNome}. A pessoa foi avisada.` : `${r.nome} já era gestor da ${unidadeNome}.`)
      fechar(false)
      onDesignado()
    },
  })

  function fechar(limparAviso = true) {
    setAberto(false); setTexto(''); setBuscado(''); setEscolhida(null)
    if (limparAviso) setFeito(null)
  }

  if (!aberto) {
    return (
      <div className="mt-2.5 flex flex-col items-start gap-1.5">
        {feito && <p role="status" className="text-apoio text-conforme">{feito}</p>}
        <Button size="sm" variant="outline" onClick={() => { setFeito(null); designar.reset(); setAberto(true) }}><UserCheck /> Designar gestor</Button>
      </div>
    )
  }

  return (
    <section aria-label={`Designar gestor: ${unidadeNome}`} className="mt-2.5 flex flex-col gap-2 rounded-cartao border border-fio bg-campo p-3">
      {escolhida ? (
        <>
          <p className="text-apoio text-tinta">{confirmacaoDeGestor(escolhida.nome, gestoresAtuais)}</p>
          <MensagemErro erro={designar.error} acao="designar o gestor" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={designar.isPending} onClick={() => { designar.reset(); setEscolhida(null) }}>Voltar à busca</Button>
            <Button size="sm" disabled={designar.isPending} onClick={() => designar.mutate(escolhida)}>
              <UserCheck /> Designar {escolhida.nome}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="designar-gestor-busca">Nome ou e-mail</Label>
            <Input id="designar-gestor-busca" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoFocus
              aria-describedby="designar-gestor-ajuda" />
            <span id="designar-gestor-ajuda" className="text-rotulo text-tinta-sussurro">
              Pelo nome, aparece quem já trabalha na rede; para alguém de fora, escreva o e-mail inteiro.
            </span>
          </div>
          {contas.isFetching && <Spinner />}
          <MensagemErro erro={contas.error} acao="buscar as contas" />
          {!contas.isFetching && buscado !== '' && contas.data?.length === 0 && (
            <p className="text-apoio text-tinta-apoio">Ninguém encontrado. Confira o nome ou escreva o e-mail inteiro da conta.</p>
          )}
          {!contas.isFetching && contas.data && contas.data.length > 0 && (
            <div role="listbox" aria-label="Contas encontradas" className="flex max-h-64 flex-col overflow-y-auto rounded-controle border border-fio bg-superficie">
              {contas.data.map((c) => (
                <OpcaoLista key={c.perfil_id} disabled={c.ja_gestor} onClick={() => setEscolhida(c)}>
                  <span className="flex flex-col">
                    <span className="text-controle text-tinta">{c.nome}</span>
                    <span className="text-rotulo text-tinta-sussurro">{c.email ?? 'sem e-mail'}{c.ja_gestor ? ' · já é gestor desta unidade' : ''}</span>
                  </span>
                </OpcaoLista>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => fechar()}>Cancelar</Button>
          </div>
        </>
      )}
    </section>
  )
}
