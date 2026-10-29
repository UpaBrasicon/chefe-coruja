// Passagem de plantão com aceite (Fase 3): enviar a um colega da escala do
// setor, retirar, ver a recusa. No caderno do leito (ponto 7 do plantonista,
// RT 29/10/2026) o "Passar este paciente" mora no cabeçalho e abre o
// formulário numa janela; o bloco do Resumo fica só com a situação.
import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { Secao } from './caixas'
import { type Acao, hora, type Internacao, msg, type Passagem, rpc } from './comum'

/** Situação da passagem; com `semBotao` (caderno), o pedido de passar fica no cabeçalho. */
export function BlocoPassagem({ i, lista, eu, acao, semBotao = false }: { i: Internacao; lista: Passagem[]; eu?: string; acao: Acao; semBotao?: boolean }) {
  const [aberto, setAberto] = React.useState(false)
  const aguardando = lista.find((p) => p.situacao === 'aguardando')
  const ultima = lista[0]
  if (semBotao && !ultima) return null
  return (
    <Secao titulo="Passagem de plantão">
      {aguardando ? (
        <div className="flex flex-wrap items-center gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2">
          <span className="flex-1">Aguardando aceite desde {hora(aguardando.enviada_em)}. Seu check-out fica bloqueado até lá.</span>
          {aguardando.de_perfil === eu && (
            <Button size="xs" variant="outline" onClick={() => acao(() => rpc('retirar_passagem', { p_passagem: aguardando.id }), 'Passagem retirada.')}>Retirar</Button>
          )}
        </div>
      ) : (
        <>
          {ultima?.situacao === 'recusada' && (
            <p className="text-atencao">Recusada: “{ultima.motivo_recusa}”. Reenvie quando puder.</p>
          )}
          {ultima?.situacao === 'aceita' && <p className="text-conforme">Última passagem aceita.</p>}
          {semBotao ? null : !aberto ? (
            <Button size="xs" variant="outline" className="self-start" onClick={() => setAberto(true)}>
              <ArrowRightLeft /> {ultima ? 'Passar de novo' : 'Passar este paciente'}
            </Button>
          ) : (
            <FormPassagem i={i} acao={acao} aoFechar={() => setAberto(false)} />
          )}
        </>
      )}
    </Secao>
  )
}

/** O formulário de passar numa janela (cabeçalho do caderno). */
export function DialogoPassagem({ i, acao, aoFechar }: { i: Internacao; acao: Acao; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar() }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-dialogo">Passar este paciente</DialogTitle>
          <DialogDescription className="text-controle">O colega recebe e aceita. Até o aceite, o seu check-out fica bloqueado.</DialogDescription>
        </DialogHeader>
        <FormPassagem i={i} acao={acao} aoFechar={aoFechar} />
      </DialogContent>
    </Dialog>
  )
}

function FormPassagem({ i, acao, aoFechar }: { i: Internacao; acao: Acao; aoFechar: () => void }) {
  const [para, setPara] = React.useState('')
  const [resumo, setResumo] = React.useState('')
  // na janela, o erro aparece aqui também (o aviso do leito fica atrás dela)
  const [erro, setErro] = React.useState<string | null>(null)
  const colegas = useQuery({
    queryKey: ['colegas-passagem', i.id],
    queryFn: async () => (await rpc('colegas_para_passagem', { p_internacao: i.id })) as { perfil_id: string; nome: string; inicio: string }[],
  })
  return (
    <div className="flex flex-col gap-2">
      <Select items={Object.fromEntries((colegas.data ?? []).map((c) => [c.perfil_id, `${c.nome} · a partir de ${hora(c.inicio)}`]))} value={para || null} onValueChange={(x) => setPara(x ?? '')}>
        <SelectTrigger className="w-full"><SelectValue placeholder={colegas.isLoading ? 'Carregando a escala…' : 'Para quem (escala do setor, agora ou nas próximas 12h)'} /></SelectTrigger>
        <SelectContent>
          {(colegas.data ?? []).map((c) => <SelectItem key={c.perfil_id} value={c.perfil_id}>{c.nome} · a partir de {hora(c.inicio)}</SelectItem>)}
        </SelectContent>
      </Select>
      {colegas.data && colegas.data.length === 0 && <p className="text-rotulo text-atencao">Ninguém na escala deste setor agora nem nas próximas 12 horas.</p>}
      <Textarea placeholder="Situação, o que está pendente, o que observar (mínimo de 15 letras)" value={resumo} onChange={(e) => setResumo(e.target.value)} />
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!para || resumo.trim().length < 15}
          onClick={() => acao(() => rpc('enviar_passagem', { p_internacao: i.id, p_para: para, p_resumo: resumo }).catch((e: unknown) => { setErro(msg(e)); throw e }), 'Passagem enviada. Aguarda aceite.').then((r) => { if (r) aoFechar() })}>
          Enviar
        </Button>
        <Button size="sm" variant="ghost" onClick={aoFechar}>Cancelar</Button>
      </div>
    </div>
  )
}
