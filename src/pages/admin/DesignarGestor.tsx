// "Designar gestor" na ficha da unidade, para o perfil Gestor da secretaria
// (RT, 25/11/2026; teste de fluxo A, A-17). O primeiro gestor de uma unidade
// nova não entra por convite: quem designa é a gestão da secretaria, escolhendo
// uma pessoa com conta ativa. O banco confere (secretaria_gere_unidade,
// migration 20270426000015) e avisa a pessoa designada.
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search, UserCheck } from 'lucide-react'
import * as React from 'react'

import { OpcaoLista } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { termoDeBuscaDeConta } from '@/lib/redeSecretaria'
import { supabase } from '@/lib/supabase'

type Conta = { perfil_id: string; nome: string; email: string | null; ja_gestor: boolean }

export function DesignarGestor({ unidadeId, unidadeNome, onDesignado }: { unidadeId: string; unidadeNome: string; onDesignado: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [texto, setTexto] = React.useState('')
  const [buscado, setBuscado] = React.useState('')
  const [escolhida, setEscolhida] = React.useState<Conta | null>(null)
  const [feito, setFeito] = React.useState<string | null>(null)
  const termo = termoDeBuscaDeConta(texto)

  const contas = useQuery({
    queryKey: ['secretaria-buscar-contas', unidadeId, buscado],
    enabled: aberto && buscado !== '',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('secretaria_buscar_contas', { p_unidade: unidadeId, p_termo: buscado })
      if (error) throw error
      return (data ?? []) as Conta[]
    },
  })
  const designar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('secretaria_designar_gestor', { p_unidade: unidadeId, p_perfil: escolhida!.perfil_id })
      if (error) throw error
      return data as unknown as { mudou: boolean; nome: string }
    },
    onSuccess: (r) => {
      setFeito(r.mudou ? `${r.nome} agora é gestor da ${unidadeNome}. A pessoa foi avisada.` : `${r.nome} já era gestor da ${unidadeNome}.`)
      setEscolhida(null)
      onDesignado()
    },
  })

  const fechar = () => { setAberto(false); setTexto(''); setBuscado(''); setEscolhida(null); setFeito(null); designar.reset() }
  const buscar = () => { if (termo) { setEscolhida(null); setFeito(null); designar.reset(); setBuscado(termo) } }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}><UserCheck /> Designar gestor</Button>
      <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Designar gestor: {unidadeNome}</DialogTitle>
            <DialogDescription>
              Escolha uma pessoa com conta ativa no app. Pelo nome, a busca mostra quem já trabalha na rede; para alguém de fora, escreva o e-mail inteiro.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); buscar() }}>
            <Label htmlFor="designar-gestor-busca">Nome ou e-mail</Label>
            <div className="flex gap-2">
              <Input id="designar-gestor-busca" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
              <Button type="submit" variant="outline" disabled={!termo || contas.isFetching}><Search /> Buscar</Button>
            </div>
            {!termo && texto.trim() !== '' && <span className="text-rotulo text-tinta-sussurro">Ao menos 3 letras do nome, ou o e-mail inteiro.</span>}
          </form>
          {contas.isFetching && <Spinner />}
          {contas.error && <MensagemErro erro={contas.error} acao="buscar as contas" />}
          {!contas.isFetching && contas.data && contas.data.length === 0 && (
            <p className="text-apoio text-tinta-apoio">Ninguém encontrado. Confira o nome ou escreva o e-mail inteiro da conta.</p>
          )}
          {!contas.isFetching && contas.data && contas.data.length > 0 && (
            <ul role="listbox" aria-label="Contas encontradas" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {contas.data.map((c) => (
                <li key={c.perfil_id}>
                  <OpcaoLista role="option" aria-selected={escolhida?.perfil_id === c.perfil_id} disabled={c.ja_gestor}
                    className="w-full" onClick={() => setEscolhida(c)}>
                    <span className="flex flex-col">
                      <span className="text-controle text-tinta">{c.nome}{escolhida?.perfil_id === c.perfil_id ? ' · escolhida' : ''}</span>
                      <span className="text-rotulo text-tinta-sussurro">{c.email ?? 'sem e-mail'}{c.ja_gestor ? ' · já é gestor desta unidade' : ''}</span>
                    </span>
                  </OpcaoLista>
                </li>
              ))}
            </ul>
          )}
          {designar.error && <MensagemErro erro={designar.error} acao="designar o gestor" />}
          {feito && <p role="status" className="text-apoio text-conforme">{feito}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Fechar</Button>
            <Button disabled={!escolhida || designar.isPending} onClick={() => designar.mutate()}>
              <UserCheck /> {escolhida ? `Designar ${escolhida.nome}` : 'Designar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
