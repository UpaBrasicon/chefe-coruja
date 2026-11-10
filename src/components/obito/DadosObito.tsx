// Os dados do óbito, iguais na porta, na observação e na internação (lacuna 5,
// O1 e O3). A tela só adianta: o servidor confere tudo de novo
// (private.obito_validado). O registro é do prontuário; a D.O. é o formulário
// do Ministério da Saúde e não sai do sistema.
import { CircleAlert } from 'lucide-react'

import { Chip } from '@/components/monitor/Pagina'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { dataHoraInput } from '@/lib/formato'
import { AVISO_PRONTUARIO, avisosObito, encaminhamentoDe, TIPOS_MORTE, unidadeEmiteDo, type ValorObito } from '@/lib/obito'

export function DadosObito({ id, valor, onChange, agora }: {
  /** prefixo dos ids dos campos (a tela pode ter mais de um formulário) */
  id: string
  valor: ValorObito
  onChange: (v: ValorObito) => void
  agora: number
}) {
  const v = valor
  const muda = (x: Partial<ValorObito>) => onChange({ ...v, ...x })
  const tipo = TIPOS_MORTE.find((t) => t.valor === v.tipo)
  const enc = encaminhamentoDe(v)
  const emite = unidadeEmiteDo(v)
  const avisos = avisosObito(v)
  const max = dataHoraInput(agora)

  return (
    <section aria-label="Dados do óbito" className="flex flex-col gap-3 rounded-cartao border border-fio bg-campo px-4 py-3.5">
      <span className="rotulo text-tinta-sussurro">Dados do óbito</span>
      <div className="flex flex-col gap-1.5 sm:max-w-64">
        <Label htmlFor={`${id}-hora`}>Hora do óbito</Label>
        <Input id={`${id}-hora`} type="datetime-local" value={v.hora} max={max} onChange={(e) => muda({ hora: e.target.value })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={`${id}-tipo`} className="text-controle font-medium text-tinta">Tipo de morte</span>
        <div role="radiogroup" aria-labelledby={`${id}-tipo`} className="flex flex-wrap gap-2">
          {TIPOS_MORTE.map((t) => (
            <Chip key={t.valor} radio variante="opcao" ativo={v.tipo === t.valor} onClick={() => muda({ tipo: t.valor, encaminhamento: '' })}>{t.rotulo}</Chip>
          ))}
        </div>
        {tipo && (
          <p className="max-w-prose text-apoio text-tinta-apoio">
            {tipo.orientacao} <span className="text-tinta-sussurro">Fonte: {tipo.fonte}.</span>
          </p>
        )}
      </div>

      {v.tipo === 'natural_sem_assistencia_ou_a_esclarecer' && (
        <div className="flex flex-col gap-1.5">
          <span id={`${id}-enc`} className="text-controle font-medium text-tinta">Quem emite a D.O.</span>
          <div role="radiogroup" aria-labelledby={`${id}-enc`} className="flex flex-wrap gap-2">
            <Chip radio variante="opcao" ativo={v.encaminhamento === 'svo'} onClick={() => muda({ encaminhamento: 'svo' })}>O SVO (o corpo vai ao SVO)</Chip>
            <Chip radio variante="opcao" ativo={v.encaminhamento === 'causa_desconhecida'} onClick={() => muda({ encaminhamento: 'causa_desconhecida' })}>
              A unidade, sem SVO na cidade
            </Chip>
          </div>
        </div>
      )}

      {emite && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-do`}>Nº da Declaração de Óbito</Label>
            <Input id={`${id}-do`} inputMode="numeric" maxLength={11} value={v.numeroDo} placeholder="9 dígitos" onChange={(e) => muda({ numeroDo: e.target.value })} />
            <span className="text-rotulo text-tinta-sussurro">O número impresso no formulário do Ministério da Saúde (manual MS 2022: 9 dígitos).</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id={`${id}-cond`} className="text-controle font-medium text-tinta">Você atesta como</span>
            <div role="radiogroup" aria-labelledby={`${id}-cond`} className="flex flex-wrap gap-2">
              <Chip radio variante="opcao" ativo={v.condicao === 'assistente'} onClick={() => muda({ condicao: 'assistente' })}>Assistente</Chip>
              <Chip radio variante="opcao" ativo={v.condicao === 'substituto'} onClick={() => muda({ condicao: 'substituto' })}>Substituto (plantonista)</Chip>
            </div>
            <span className="text-rotulo text-tinta-sussurro">Atesta quem verificou o óbito (Código de Ética Médica, art. 83). O atestante é o seu login.</span>
          </div>
        </div>
      )}

      {v.tipo && (
        <div className="flex flex-col gap-2">
          <span className="text-controle font-medium text-tinta">Causas da morte, como na D.O.</span>
          {enc === 'causa_desconhecida' ? (
            <p className="text-apoio text-tinta-apoio">Parte I: "Causa da morte desconhecida" (manual MS 2022).</p>
          ) : (
            <div className="grid gap-2">
              {([['causaA', 'a', 'Doença ou lesão que causou a morte'], ['causaB', 'b', 'Devido a (opcional)'], ['causaC', 'c', 'Devido a (opcional)'], ['causaD', 'd', 'Causa básica (opcional)']] as const).map(([k, l, ph]) => (
                <div key={k} className="flex items-center gap-2">
                  <Label htmlFor={`${id}-${k}`} className="w-16 shrink-0">Parte I, {l}</Label>
                  <Input id={`${id}-${k}`} value={v[k]} maxLength={500} placeholder={ph} onChange={(e) => muda({ [k]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-p2`}>Parte II (outras condições que contribuíram, opcional)</Label>
            <Textarea id={`${id}-p2`} rows={2} maxLength={1000} value={v.parte2} onChange={(e) => muda({ parte2: e.target.value })} />
          </div>
          <span className="text-rotulo text-tinta-sussurro">Um diagnóstico por linha, em texto. Quem codifica pela CID são os codificadores da Secretaria de Saúde (manual MS 2022).</span>
          {avisos.length > 0 && (
            <ul role="status" className="flex flex-col gap-1 text-apoio text-atencao">
              {avisos.map((a) => (
                <li key={a} className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{a} (MS/CFM, A Declaração de Óbito, 2009)</span></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {v.tipo === 'violenta_ou_suspeita' && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-controle text-tinta">
            <input type="checkbox" checked={v.policiaComunicada} onChange={(e) => muda({ policiaComunicada: e.target.checked, policiaEm: e.target.checked ? v.policiaEm || max : '' })} />
            A polícia já foi comunicada
          </label>
          {v.policiaComunicada ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-pol-em`}>Quando</Label>
                <Input id={`${id}-pol-em`} type="datetime-local" value={v.policiaEm} max={max} onChange={(e) => muda({ policiaEm: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-pol-oc`}>Nº da ocorrência (opcional)</Label>
                <Input id={`${id}-pol-oc`} maxLength={60} value={v.ocorrencia} onChange={(e) => muda({ ocorrencia: e.target.value })} />
              </div>
            </div>
          ) : (
            <span className="text-rotulo text-tinta-sussurro">Sem a comunicação, o óbito fica com a pendência até alguém registrar.</span>
          )}
        </div>
      )}

      <p className="text-rotulo text-tinta-sussurro">{AVISO_PRONTUARIO} O app guarda o número, as causas e o destino das vias; não imprime a D.O.</p>
    </section>
  )
}
