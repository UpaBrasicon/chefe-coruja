// Passagem de plantão com aceite (Fase 3): enviar a um colega da escala do
// setor, retirar, ver a recusa.
import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { Secao } from './caixas'
import { type Acao, hora, type Internacao, type Passagem, rpc } from './comum'

export function BlocoPassagem({ i, lista, eu, acao }: { i: Internacao; lista: Passagem[]; eu?: string; acao: Acao }) {
  const [aberto, setAberto] = React.useState(false)
  const [para, setPara] = React.useState('')
  const [resumo, setResumo] = React.useState('')
  const colegas = useQuery({
    queryKey: ['colegas-passagem', i.id],
    enabled: aberto,
    queryFn: async () => (await rpc('colegas_para_passagem', { p_internacao: i.id })) as { perfil_id: string; nome: string; inicio: string }[],
  })
  const aguardando = lista.find((p) => p.situacao === 'aguardando')
  const ultima = lista[0]
  return (
    <Secao titulo="Passagem de plantão">
      {aguardando ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.06] px-3 py-2">
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
          {!aberto ? (
            <Button size="xs" variant="outline" className="self-start" onClick={() => setAberto(true)}>
              <ArrowRightLeft /> {ultima ? 'Passar de novo' : 'Passar este paciente'}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Select items={Object.fromEntries((colegas.data ?? []).map((c) => [c.perfil_id, `${c.nome} · a partir de ${hora(c.inicio)}`]))} value={para || null} onValueChange={(x) => setPara(x ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder={colegas.isLoading ? 'Carregando a escala…' : 'Para quem (escala do setor, agora ou nas próximas 12h)'} /></SelectTrigger>
                <SelectContent>
                  {(colegas.data ?? []).map((c) => <SelectItem key={c.perfil_id} value={c.perfil_id}>{c.nome} · a partir de {hora(c.inicio)}</SelectItem>)}
                </SelectContent>
              </Select>
              {colegas.data && colegas.data.length === 0 && <p className="text-xs text-atencao">Ninguém na escala deste setor agora nem nas próximas 12 horas.</p>}
              <Textarea placeholder="Situação, o que está pendente, o que observar (mínimo de 15 letras)" value={resumo} onChange={(e) => setResumo(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={!para || resumo.trim().length < 15}
                  onClick={() => acao(() => rpc('enviar_passagem', { p_internacao: i.id, p_para: para, p_resumo: resumo }), 'Passagem enviada. Aguarda aceite.').then((r) => { if (r) { setAberto(false); setResumo('') } })}>
                  Enviar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Secao>
  )
}
