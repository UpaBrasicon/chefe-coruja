import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Baby, ChevronRight, HeartPulse } from 'lucide-react'

import { Abas, TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { FERRAMENTAS_DA_PARADA, SITUACOES_PARADA, type GrupoParada, type SituacaoParada } from '@/content/guiaParadaCrianca'
import { choquesDoPeso, dosesDoPeso, numeroDaDose, type DoseDaFitaCalculada } from '@/clinico/pediatria/dosesDaFita'
import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { FAIXAS_RCP, parametrosRcp } from '@/clinico/pediatria/rcp'
import { alterarPaciente, definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { corEscolhida, leituraDaFita, pedePesoNaCor, pesoDaDoseDoPaciente } from '@/lib/fitaDoPeso'
import { NOTAS_DISPOSITIVOS, ROTULOS_DISPOSITIVO, dispositivosDaCor } from '@/clinico/pediatria/dispositivosDaFita'
import type { CorBroselow } from '@/clinico/pediatria/fitaBroselow'
import { cn } from '@/lib/utils'
import { CampoGrande, CorDaFita, DetalheDaFita } from './CamposDoGuia'

// Guia de parada e reanimação da criança (construído com o RT; protótipo de
// 18/11/2026, G1–G5 = A). Peso e cor no alto, na mesma Central do Guia rápido;
// abas por situação; cada dose sai do módulo ped-doses-fita (fonte conferida
// no PubMed × peso). Com peso digitado vale o peso; só com a cor, o meio da faixa.

const faixa = (a: number, b: number) => (Math.abs(a - b) < 1e-9 ? numeroDaDose(a) : `${numeroDaDose(a)} a ${numeroDaDose(b)}`)

function CartaoDose({ item }: { item: DoseDaFitaCalculada }) {
  const { dose: d, calculo: c } = item
  const un = d.unidade
  return (
    <li className="flex flex-col gap-1 rounded-cartao border border-fio-forte bg-superficie px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-corpo font-semibold text-tinta">{d.nome}</span>
        <span className="shrink-0 text-rotulo text-tinta-sussurro">{d.porKg ? `${faixa(d.faixa[0], d.faixa[1])} ${un}/kg` : 'dose fixa'}</span>
      </div>
      <span className="text-numeral-compacto leading-tight font-bold tabular-nums text-tinta">
        {faixa(c.faixa[0], c.faixa[1])} <span className="text-secao font-semibold text-tinta-apoio">{un}</span>
      </span>
      {c.volumeMl && (
        <span className="text-corpo font-semibold tabular-nums text-acao">
          {faixa(c.volumeMl[0], c.volumeMl[1])} mL <span className="font-normal text-tinta-apoio">de {d.apresentacao}</span>
        </span>
      )}
      {!c.volumeMl && <EscolhaDaAmpola chave={`fita:${d.id}`} dose={c.faixa} unidade={un} grande />}
      <span className="text-apoio text-tinta-apoio">{d.via}</span>
      {(d.maximo !== undefined || c.aplica === 'indefinido') && (
        <div className="flex flex-wrap gap-1.5">
          {d.maximo !== undefined && (
            <span className={cn('rounded-controle px-2 py-0.5 text-rotulo font-semibold',
              c.noMaximo ? 'bg-alerta-atencao text-atencao' : 'bg-trilha text-tinta-apoio')}>
              {c.noMaximo ? 'no máximo' : 'máx.'} {numeroDaDose(d.maximo)} {un}
            </span>
          )}
          {c.aplica === 'indefinido' && d.condicao && (
            <span className="rounded-controle bg-trilha px-2 py-0.5 text-rotulo text-tinta-apoio">{d.condicao.texto}</span>
          )}
        </div>
      )}
      {d.nota && <span className="text-apoio text-tinta-apoio">{d.nota}</span>}
      <details className="text-rotulo text-tinta-sussurro">
        <summary className="cursor-pointer">Fonte: {d.pagina}</summary>
        <q className="mt-1 block font-mono text-tinta">{d.trecho}</q>
      </details>
    </li>
  )
}

function Choques({ tipo, kg }: { tipo: 'desfibrilacao' | 'cardioversao'; kg: number }) {
  const c = choquesDoPeso(kg)
  if (!c) return null
  const J = (x: number) => numeroDaDose(Math.round(x * 10) / 10)
  const quadro = (rotulo: string, valor: string, porKg: string) => (
    <div className="flex flex-col gap-0.5 rounded-cartao bg-alerta-critico px-4 py-3">
      <span className="text-rotulo font-semibold tracking-wide text-critico uppercase">{rotulo}</span>
      <span className="text-numeral-compacto leading-tight font-bold tabular-nums text-tinta">{valor} J</span>
      <span className="text-apoio text-tinta-apoio">{porKg}</span>
    </div>
  )
  return tipo === 'desfibrilacao' ? (
    <div className="grid grid-cols-2 gap-2.5">
      {quadro('1º choque', J(c.desfibrilacaoPrimeiro), '2 J/kg')}
      {quadro('Seguintes', J(c.desfibrilacaoSeguinte), '4 J/kg')}
      <p className="col-span-2 text-apoio text-tinta-apoio">
        Pode subir até {J(c.desfibrilacaoTeto)} J (10 J/kg), sem passar da dose de adulto do aparelho. Fonte: AHA 2025, Figura 2.
      </p>
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2.5">
      {quadro('Inicial', `${J(c.cardioversaoInicial[0])} a ${J(c.cardioversaoInicial[1])}`, '0,5 a 1 J/kg')}
      {quadro('Se não reverter', J(c.cardioversaoSeguinte), '2 J/kg')}
      <p className="col-span-2 text-apoio text-tinta-apoio">Fonte: AHA 2025, seção 19.</p>
    </div>
  )
}

function Rcp() {
  return (
    <div className="flex flex-col gap-4">
      {(['lactente', 'crianca'] as const).map((f) => {
        const p = parametrosRcp(f)
        const linhas: [string, string][] = [
          ['Frequência', p.frequencia], ['Profundidade', p.profundidade], ['Relação', p.relacao],
          ['Via aérea avançada', p.viaAereaAvancada], ['Pulso', p.pulso], ['Técnica', p.tecnica],
        ]
        return (
          <section key={f} className="flex flex-col gap-2">
            <TituloSecao className="mb-0">{FAIXAS_RCP[f]}</TituloSecao>
            <dl className="rounded-cartao border border-fio-forte bg-superficie px-4">
              {linhas.map(([a, b]) => (
                <div key={a} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-fio py-2.5 last:border-b-0">
                  <dt className="text-apoio text-tinta-sussurro">{a}</dt>
                  <dd className="text-controle text-tinta">{b}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
      <p className="text-rotulo text-tinta-sussurro">Livro do ICr, cap. 1 (p. 26, 30–31), igual à ferramenta RCP pediátrica.</p>
    </div>
  )
}

function TabelaDispositivos({ cor }: { cor: CorBroselow }) {
  const d = dispositivosDaCor(cor.id)
  if (!d) return null
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded-capsula border border-tinta/40" style={{ background: cor.amostra }} />
          Cor {cor.nome.toLowerCase()} ({cor.pesoKg[0]}–{cor.pesoKg[1]} kg)
        </span>
      </TituloSecao>
      <dl className="rounded-cartao border border-fio-forte bg-superficie px-4">
        {ROTULOS_DISPOSITIVO.map(([k, rotulo]) => (
          <div key={k} className="flex flex-col gap-0.5 border-b border-fio py-2.5 last:border-b-0">
            <dt className="text-apoio text-tinta-sussurro">{rotulo}</dt>
            <dd className="text-corpo font-semibold text-tinta">{d[k].valor}</dd>
            <dd className="text-rotulo text-tinta-sussurro">{d[k].fonte}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Dispositivos() {
  const p = usePacienteCentral()
  const { cor, leitura } = leituraDaFita(p)
  const cores = cor ? [cor] : leitura.tipo === 'entre' ? [leitura.abaixo, leitura.acima] : []
  if (cores.length === 0) {
    return <p className="text-controle text-tinta-apoio">Escolha a cor da fita ou digite um peso de 3 a 36 kg para ver os dispositivos.</p>
  }
  return (
    <div className="flex flex-col gap-5">
      {leitura.tipo === 'entre' && <p className="text-controle text-tinta-apoio">O peso fica entre duas cores: as duas aparecem.</p>}
      {cores.map((c) => <TabelaDispositivos key={c.id} cor={c} />)}
      <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio text-tinta-apoio">
        {NOTAS_DISPOSITIVOS.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <p className="text-rotulo text-tinta-sussurro">Fonte aberta primeiro, depois o livro do ICr; o e-book Fita PED só confere (decisões DP1–DP6, ficha ped-dispositivos-fita).</p>
    </div>
  )
}

function Grupo({ grupo, kg }: { grupo: GrupoParada; kg: number }) {
  if ('choque' in grupo) {
    return (
      <section className="flex flex-col gap-2">
        <TituloSecao className="mb-0">{grupo.titulo}</TituloSecao>
        <Choques tipo={grupo.choque} kg={kg} />
      </section>
    )
  }
  const todas = dosesDoPeso(kg)
  const itens = grupo.doses.map((id) => todas.find((x) => x.dose.id === id)).filter((x): x is DoseDaFitaCalculada => !!x)
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0">{grupo.titulo}</TituloSecao>
      <ul className="flex flex-col gap-2.5">
        {itens.map((x) => <CartaoDose key={x.dose.id} item={x} />)}
      </ul>
    </section>
  )
}

export function GuiaParadaCrianca() {
  const p = usePacienteCentral()
  const idPeso = useId()
  const [aba, setAba] = useState<SituacaoParada>('pcr')
  const peso = pesoDaDoseDoPaciente(p)
  const situacao = SITUACOES_PARADA.find((s) => s.id === aba) ?? SITUACOES_PARADA[0]
  return (
    <div className="flex flex-col gap-4">
      <Link to="/plantonista" className="flex min-h-11 items-center gap-2 self-start text-controle font-semibold text-acao no-underline">
        <ArrowLeft className="size-5" aria-hidden /> Início
      </Link>
      <TituloPagina titulo="Parada e reanimação" descricao="Criança até 13 anos, 11 meses e 29 dias" className="mb-0" />
      {/* G3 (RT, 18/11/2026): o cronômetro abre por aqui na criança */}
      <Link to="/plantonista?guia=cronometro"
        className="flex min-h-18 items-center justify-center gap-3 rounded-cartao bg-critico px-4 py-3 text-secao font-extrabold tracking-wide text-sobre-acao no-underline hover:bg-critico/90 hover:text-sobre-acao">
        <HeartPulse className="size-7" aria-hidden /> INICIAR PARADA (cronômetro)
      </Link>
      {p.modo !== 'pediatrico' ? (
        <div className="flex flex-col gap-3 rounded-cartao border border-fio-forte bg-superficie p-4">
          <p className="text-corpo text-tinta">Esta tela é da criança. Mudar para criança apaga o peso e a idade do adulto.</p>
          <Button type="button" onClick={() => definirModo('pediatrico')} className="self-start">
            <Baby className="size-5" aria-hidden /> Mudar para criança
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <CampoGrande id={idPeso} rotulo="Peso" unidade="kg" modo="decimal" valor={p.peso} aoMudar={(v) => alterarPaciente({ peso: v })} />
            <CorDaFita />
            <DetalheDaFita />
          </div>
          <p className="text-controle text-tinta-apoio">
            {peso.origem === 'peso' && <>Dose pelo <b className="text-tinta">peso digitado: {numeroDaDose(peso.kg)} kg</b>.</>}
            {peso.origem === 'cor' && <>Dose pela <b className="text-tinta">cor {peso.cor.nome.toLowerCase()}: {numeroDaDose(peso.kg)} kg</b> (meio da faixa). Pese quando der: com o peso, a dose sai do peso.</>}
            {peso.origem === 'nenhum' && (pedePesoNaCor(corEscolhida(p.origem))
              ? 'Na cor cinza, escolha 3, 4 ou 5 kg acima para ver as doses.'
              : 'Digite o peso ou escolha a cor da fita para ver as doses.')}
          </p>
          <Abas rotulo="Situação" valor={aba} onChange={setAba} abas={SITUACOES_PARADA.map((s) => [s.id, s.nome] as const)} className="mb-0" />
          {aba === 'rcp' ? <Rcp /> : aba === 'dispositivos' ? <Dispositivos /> : peso.origem === 'nenhum' ? null : (
            <div className="flex flex-col gap-5">
              {situacao.grupos.map((g) => <Grupo key={g.titulo} grupo={g} kg={peso.kg} />)}
              <p className="text-rotulo text-tinta-sussurro">A decisão é do médico. Doses conferidas no PubMed (ficha ped-doses-fita); nenhum número vem do e-book.</p>
            </div>
          )}
        </>
      )}
      <ul className="flex flex-col gap-2.5">
        {FERRAMENTAS_DA_PARADA.map((f) => (
          <li key={f.rota}>
            <Link to={f.rota}
              className="flex min-h-14 items-center gap-3 rounded-cartao border border-fio-forte bg-superficie px-4 py-3 text-corpo font-semibold text-tinta no-underline hover:border-acao">
              <span className="flex-1">{f.nome}</span>
              <ChevronRight className="size-5 text-tinta-apoio" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
