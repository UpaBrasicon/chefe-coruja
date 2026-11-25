// "Avisar médico" (NIR2, modelo do RT de 25/11/2026). O NIR registra a
// pendência do pedido e o aviso vai aos médicos de plantão no setor do
// paciente (a escala diz quem; sem ninguém escalado no setor, o NIR escolhe
// entre os médicos da unidade). Motivos de 1 clique, urgência e o texto.
// "Copiar para WhatsApp / plantão" leva leito, nº do pedido, setor e a
// pendência, SEM o nome do paciente (LGPD; decisão do RT, 25/11/2026).
// RPCs regulacao_pendencia_unidade_criar e nir_medicos_do_setor (migration
// 20270425000030).
import { useMutation } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { useMedicosDoSetor } from '@/components/nir/dadosNir'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { MOTIVOS, textoParaWhatsApp, type MotivoPendencia } from '@/lib/nirPainel'
import { supabase } from '@/lib/supabase'

export type AlvoAviso = {
  solicitacaoId: string; numero: number; leito: string | null; setor: { id: string; nome: string } | null; paciente: string
}

export function AvisarMedico({ unidadeId, alvo, motivoInicial, aoFechar, aoSalvar }: {
  unidadeId: string; alvo: AlvoAviso | null; motivoInicial?: MotivoPendencia
  aoFechar: () => void; aoSalvar: (solicitacaoId: string) => void
}) {
  return (
    <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) aoFechar() }}>
      <DialogContent className="sm:max-w-[560px]">
        {alvo && <Formulario key={alvo.solicitacaoId} unidadeId={unidadeId} alvo={alvo} motivoInicial={motivoInicial} aoFechar={aoFechar} aoSalvar={aoSalvar} />}
      </DialogContent>
    </Dialog>
  )
}

async function copiar(texto: string) {
  await navigator.clipboard.writeText(texto)
}

function Formulario({ unidadeId, alvo, motivoInicial, aoFechar, aoSalvar }: {
  unidadeId: string; alvo: AlvoAviso; motivoInicial?: MotivoPendencia; aoFechar: () => void; aoSalvar: (solicitacaoId: string) => void
}) {
  const [dono, setDono] = React.useState<'medico' | 'nir'>('medico')
  const [motivo, setMotivo] = React.useState<MotivoPendencia>(motivoInicial ?? 'outro')
  const [texto, setTexto] = React.useState(motivoInicial && motivoInicial !== 'outro' ? MOTIVOS[motivoInicial].texto : '')
  const [urgencia, setUrgencia] = React.useState<'alta' | 'normal'>('normal')
  const [escolhidos, setEscolhidos] = React.useState<string[] | null>(null)
  const [copiado, setCopiado] = React.useState<string | null>(null)
  const medicos = useMedicosDoSetor(unidadeId, alvo.setor?.id ?? null, true)
  const lista = medicos.data?.medicos ?? []
  // com plantão no setor, já vêm marcados; sem, o NIR escolhe
  const marcados = escolhidos ?? (medicos.data?.no_plantao ? lista.map((m) => m.id) : [])
  const alternar = (id: string) => setEscolhidos(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id])
  const nomes = lista.filter((m) => marcados.includes(m.id)).map((m) => m.nome)

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_pendencia_unidade_criar', {
        p_solicitacao: alvo.solicitacaoId, p_motivo: motivo, p_titulo: texto.trim(), p_urgencia: urgencia,
        p_medicos: dono === 'medico' ? marcados : null, p_dono: dono,
      })
      if (error) throw error
    },
    onSuccess: () => { aoSalvar(alvo.solicitacaoId); aoFechar() },
  })
  const podeSalvar = texto.trim().length >= 5 && (dono === 'nir' || marcados.length > 0) && !salvar.isPending

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (podeSalvar) salvar.mutate() }}>
      <DialogHeader>
        <DialogTitle>Avisar médico</DialogTitle>
        <DialogDescription>
          {alvo.leito ?? 'Sem leito'}{alvo.setor ? ` · ${alvo.setor.nome}` : ''} · {alvo.paciente} · Regulação nº {alvo.numero}
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="Para quem" className="flex flex-wrap gap-2">
        <Chip radio variante="opcao" ativo={dono === 'medico'} onClick={() => setDono('medico')}>Médico (recebe o aviso)</Chip>
        <Chip radio variante="opcao" ativo={dono === 'nir'} onClick={() => setDono('nir')}>Pendência do NIR (sem aviso)</Chip>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-apoio font-medium text-tinta-apoio">Motivo (1 clique)</span>
        <div role="radiogroup" aria-label="Motivo" className="flex flex-wrap gap-2">
          {(Object.keys(MOTIVOS) as (keyof typeof MOTIVOS)[]).map((m) => (
            <Chip key={m} radio variante="opcao" ativo={motivo === m} onClick={() => { setMotivo(m); setTexto(MOTIVOS[m].texto) }}>{MOTIVOS[m].botao}</Chip>
          ))}
          <Chip radio variante="opcao" ativo={motivo === 'outro'} onClick={() => setMotivo('outro')}>Outro</Chip>
        </div>
      </div>

      {dono === 'medico' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-tinta-apoio">
            {medicos.data?.no_plantao === false ? 'Ninguém escalado no setor agora: escolha entre os médicos da unidade' : 'Médico / equipe de plantão no setor'}
          </span>
          {medicos.isLoading ? <Spinner /> : medicos.error ? <MensagemErro texto={(medicos.error as Error).message} />
            : lista.length === 0 ? <span className="text-apoio text-tinta-sussurro">Não há médico com vínculo nesta unidade.</span> : (
              <div role="group" aria-label="Médicos avisados" className="flex flex-wrap gap-2">
                {lista.map((m) => <Chip key={m.id} variante="opcao" ativo={marcados.includes(m.id)} onClick={() => alternar(m.id)}>{m.nome}</Chip>)}
              </div>
            )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-apoio font-medium text-tinta-apoio">Urgência</span>
        <div role="radiogroup" aria-label="Urgência" className="flex flex-wrap gap-2">
          <Chip radio variante="opcao" ativo={urgencia === 'normal'} onClick={() => setUrgencia('normal')}>Normal (plantão atual)</Chip>
          <Chip radio variante="opcao" tom="critico" ativo={urgencia === 'alta'} onClick={() => setUrgencia('alta')}>Alta (risco de perder a vaga)</Chip>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`aviso-${alvo.solicitacaoId}`}>{dono === 'medico' ? 'Pendência para o médico' : 'Pendência do NIR'}</Label>
        <Textarea id={`aviso-${alvo.solicitacaoId}`} rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="O que o médico precisa atualizar, pedir ou responder" />
      </div>

      <MensagemErro texto={salvar.error ? (salvar.error as Error).message : null} />
      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        <Button type="button" variant="outline" disabled={texto.trim().length < 5}
          onClick={() => {
            const t = textoParaWhatsApp({ leito: alvo.leito, numero: alvo.numero, setor: alvo.setor?.nome ?? null, pendencia: texto, medico: nomes.join(', ') || null })
            copiar(t).then(() => setCopiado('Copiado, sem o nome do paciente.'), () => setCopiado('Não deu para copiar neste navegador.'))
          }}>
          <Copy /> Copiar para WhatsApp / plantão
        </Button>
        {copiado && <span role="status" className="self-center text-rotulo text-tinta-sussurro">{copiado}</span>}
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" disabled={!podeSalvar}>{dono === 'medico' ? 'Registrar e avisar' : 'Registrar pendência'}</Button>
        </span>
      </DialogFooter>
    </form>
  )
}
