// Encaminhamento de usuários (modelo SMS003a, referência e contrarreferência),
// no desenho do protótipo (Documentos do Atendimento.dc.html, encBlocos):
// identificação só de leitura (cadastro, login e unidade), especialidade com
// lista, CID e procedimento com a busca do laudo de AIH, prioridade em
// pílulas, motivo, vitais da classificação de risco como registrados,
// tratamento e exames (com leitura de laudo anexado). A folha A4 sai com a
// contrarreferência destacável no pé (lib/folhas.ts, `encaminhamento`).
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'

import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { BarraDocumento } from '@/components/documento/BarraDocumento'
import { invalidarDocumentos } from '@/components/documento/documentos'
import { BuscaCid, BuscaLista, BuscaProcedimento } from '@/components/documentos/busca'
import { ESPECIALIDADES_ENC, PRIORIDADES_ENC } from '@/components/documentos/catalogos'
import { cnsValido, cpfValido, useIdentificacao } from '@/components/documentos/identificacao'
import type { AnexoLaudo } from '@/components/documentos/leituraLaudo'
import { SeletorPaciente, usePacienteDoDocumento } from '@/components/documentos/SeletorPaciente'
import { textoVitaisTriagem, useTriagemRecente } from '@/components/documentos/triagem'
import { AnexosLaudo, Bloco, BotaoAnexar, Campo, Cartao, Leitura, Pendencias, Pilulas, Rodape, Texto } from '@/components/documentos/ui'
import { useLeituraLaudo } from '@/components/documentos/useLeituraLaudo'
import { carregarEnvelope, useRascunho } from '../shared/rascunho'

type Prioridade = (typeof PRIORIDADES_ENC)[number]

/** O que se escreve no encaminhamento (encAtual do protótipo). */
type FormEnc = {
  especialidade: string
  /** especialidade escolhida da lista */
  espOk: boolean
  cid: string
  /** CID escolhido da lista */
  cidOk: boolean
  prioridade: Prioridade | ''
  destino: string
  numReg: string
  hipotese: string
  procDesc: string
  procCod: string
  motivo: string
  tratamento: string
  exames: string
  anexos: AnexoLaudo[]
}

const VAZIO: FormEnc = {
  especialidade: '', espOk: false, cid: '', cidOk: false, prioridade: '', destino: '', numReg: '', hipotese: '',
  procDesc: '', procCod: '', motivo: '', tratamento: '', exames: '', anexos: [],
}

const TEXTOS = ['especialidade', 'cid', 'prioridade', 'destino', 'numReg', 'hipotese', 'procDesc', 'motivo', 'tratamento', 'exames'] as const

function carregarEnc(chave: string): FormEnc {
  const c = carregarEnvelope<Partial<FormEnc>>(chave)
  return c ? { ...VAZIO, ...c.dados, anexos: Array.isArray(c.dados.anexos) ? c.dados.anexos : [] } : VAZIO
}

const s = (v: unknown) => (typeof v === 'string' ? v : '')

/** O conteúdo de um documento (cópia como novo) de volta no formulário. */
function doConteudo(conteudo: string): FormEnc {
  let j: Record<string, unknown> = {}
  try {
    j = (JSON.parse(conteudo) ?? {}) as Record<string, unknown>
  } catch {
    /* conteúdo que não é JSON: formulário em branco */
  }
  const e = (j.encaminhamento ?? {}) as Record<string, unknown>
  const p = (j.paciente ?? {}) as Record<string, unknown>
  const especialidade = s(e.especialidade)
  const cid = s(e.cid)
  const prio = s(e.prioridade)
  return {
    ...VAZIO,
    especialidade,
    espOk: ESPECIALIDADES_ENC.includes(especialidade),
    cid,
    cidOk: !!cid.trim(),
    prioridade: (PRIORIDADES_ENC as readonly string[]).includes(prio) ? (prio as Prioridade) : '',
    destino: s(e.destino),
    numReg: s(e.numReg),
    hipotese: s(e.hipotese) || s(p.diagnostico),
    procDesc: s(e.procDesc),
    procCod: s(e.procCod),
    motivo: s(e.motivo) || s(e.resumo),
    tratamento: s(e.tratamento),
    exames: s(e.exames),
  }
}

const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

export function Encaminhamento({ unidadeId, perfilId }: { unidadeId?: string; perfilId?: string }) {
  const qc = useQueryClient()
  const [pacienteId, escolherPaciente] = usePacienteDoDocumento('encaminhamento', unidadeId, perfilId)
  const ident = useIdentificacao(pacienteId)
  const { pac, cab, unidade } = ident
  const triagem = useTriagemRecente(pacienteId)
  const vitais = textoVitaisTriagem(triagem.data)

  // rascunho neste aparelho, por paciente (encChave do protótipo)
  const { dados: f, atualizar, salvoEm, limpar } = useRascunho<FormEnc>(
    `encaminhamento:${pacienteId ?? 'sem-paciente'}`, unidadeId, perfilId, carregarEnc,
  )

  const laudo = useLeituraLaudo({
    nomePaciente: cab.nome,
    anexos: f.anexos,
    texto: f.exames,
    aplicar: ({ anexos, texto }) => atualizar(texto === undefined ? { anexos } : { anexos, exames: texto }),
  })

  const conteudoDoc = JSON.stringify({
    ...ident.retrato,
    // campos antigos: quem lê documentos emitidos (alta, prontuário) continua lendo
    paciente: ident.pacienteAntigo({ diagnostico: f.hipotese.trim() }),
    encaminhamento: {
      especialidade: f.especialidade.trim(),
      prioridade: f.prioridade,
      cid: f.cid.trim(),
      hipotese: f.hipotese.trim(),
      destino: f.destino.trim(),
      numReg: f.numReg.trim(),
      procCod: f.procCod,
      procDesc: f.procDesc.trim(),
      motivo: f.motivo.trim(),
      resumo: f.motivo.trim(),
      tratamento: f.tratamento.trim(),
      exames: f.exames.trim(),
      vitais,
    },
  })
  const temAlgo = TEXTOS.some((k) => !!String(f[k] ?? '').trim())
  // sem nada escrito, o servidor não recebe rascunho (abrir e fechar não deixa rastro)
  const conteudoServidor = temAlgo ? conteudoDoc : ''
  const servidor = useRascunhoServidor(pacienteId, 'encaminhamento', conteudoServidor)

  // Falta para emitir (encPendencias do protótipo)
  const pendencias: string[] = []
  if (!pacienteId) pendencias.push('Escolher ou cadastrar o paciente')
  if (!f.especialidade.trim()) pendencias.push('Especialidade encaminhada')
  if (!f.cid.trim()) pendencias.push('CID-10')
  if (!f.motivo.trim()) pendencias.push('Motivo do encaminhamento')

  // Conferências que não bloqueiam (encConferir): encaminhamento não pode atrasar o paciente
  const conferir: string[] = []
  if (pac) {
    if (!pac.cns) conferir.push('Cartão SUS (CNS) não cadastrado. O modelo do Ministério da Saúde pede o CNS.')
    else if (!cnsValido(pac.cns)) conferir.push('CNS inválido (dígito verificador não confere). Corrigir no cadastro.')
    if (pac.cpf && !cpfValido(pac.cpf)) conferir.push('CPF inválido (dígito verificador não confere). Corrigir no cadastro.')
  }
  const cidCod = f.cid.trim().split(/\s/)[0]
  if (cidCod && !/^[A-Z]\d{2}(\.?\d)?$/i.test(cidCod)) conferir.push('CID-10 fora do formato (ex.: J18.9).')
  if (!f.prioridade) conferir.push('Prioridade não marcada (Emergência, Urgência ou Eletivo).')
  if ((f.prioridade === 'Emergência' || f.prioridade === 'Urgência') && !f.numReg.trim()) {
    conferir.push('Urgência ou emergência sem número de solicitação na regulação.')
  }
  if (f.procCod && !/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(f.procCod.trim())) conferir.push('Código SIGTAP fora do formato 00.00.00.000-0.')
  if (!f.tratamento.trim()) conferir.push('Tratamento realizado na origem não informado.')
  if (pacienteId && ident.alergiasCarregadas && !cab.temAlergia && !cab.semAlergia) conferir.push('Alergias não registradas.')

  async function emitir() {
    const conteudo = conteudoDoc
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: null, tipo: 'Encaminhamento',
      documento: { tipo: 'encaminhamento', conteudo }, rascunhoId: servidor.rascunhoId(),
    })
    if (!impressao) return
    invalidarDocumentos(qc)
    const janela = impressao.janela
    // a folha já veio pronta do servidor, ou é a provisória
    janela.focus()
    setTimeout(() => {
      janela.print()
      servidor.emitido(conteudoServidor)
      limpar() // LGPD: remove dados de paciente do navegador após emissão
    }, 300)
  }

  function limparTudo() {
    void servidor.descartar()
    limpar()
  }

  const set = <K extends keyof FormEnc>(k: K) => (v: FormEnc[K]) => atualizar({ [k]: v } as Partial<FormEnc>)
  const nasc = pac ? [dataBr(pac.nascimento), pac.idade].filter(Boolean).join(' · ') : ''
  const mensagem = !pacienteId
    ? 'Escolha ou cadastre o paciente para emitir.'
    : pendencias.length ? 'Confira as pendências antes de emitir.' : 'Tudo conferido. A folha sai com a contra-referência destacável no pé.'

  return (
    <div className="flex flex-col gap-3.5">
      <BarraDocumento
        pacienteId={pacienteId}
        tipo="encaminhamento"
        salvoEm={servidor.salvoEm}
        pendencias={pendencias}
        aoEmitir={() => void emitir()}
        aoNovo={limpar}
        aoCopiar={(conteudo) => atualizar(doConteudo(conteudo))}
      />

      <SeletorPaciente pacienteId={pacienteId} onEscolher={escolherPaciente} pac={pac} unidadeId={unidadeId} perfilId={perfilId} />

      <Cartao
        icone={<ArrowUpRight />}
        titulo={<>Encaminhamento de usuários <span className="ml-1.5 text-apoio font-normal text-tinta-sussurro">Referência e contra-referência</span></>}
        acoes={temAlgo && (
          <button type="button" onClick={limparTudo} className="px-2 py-1.5 text-apoio text-tinta-sussurro hover:text-critico">Limpar</button>
        )}
      >
        <Bloco
          titulo="Identificação do usuário"
          nota={pacienteId
            ? 'Vem do cadastro do paciente, igual ao laudo de internação. Para corrigir, edite o cadastro.'
            : 'Nome, nascimento, CNS, mãe e endereço saem do cadastro feito na porta.'}
        >
          <Leitura rotulo="Nome" valor={cab.nome} largura="cheio" />
          <Leitura rotulo="Data de nascimento" valor={nasc} />
          <Leitura rotulo="Sexo" valor={pac?.sexo} largura="curto" />
          <Leitura rotulo="CPF" valor={pac?.cpf} />
          <Leitura rotulo="Nº do Cartão SUS" valor={pac?.cns} />
          <Leitura rotulo="Nome da mãe" valor={pac?.mae} />
          <Leitura rotulo="Endereço" valor={pac?.endereco} largura="cheio" />
          <Leitura rotulo="Município" valor={pac?.municipio} />
          <Leitura rotulo="UF" valor={pac?.uf} largura="mini" />
          <Leitura rotulo="Telefone" valor={pac?.telefone} />
          <Leitura rotulo="Unidade solicitante" valor={unidade.nome} />
          <Leitura rotulo="CNES" valor={unidade.cnes} largura="curto" />
        </Bloco>

        <Bloco titulo="Dados do encaminhamento">
          <BuscaLista
            id="enc-especialidade" rotulo="Especialidade encaminhada" valor={f.especialidade} opcoes={ESPECIALIDADES_ENC}
            dica="Clique para ver as especialidades ou digite"
            onDigitar={(v) => atualizar({ especialidade: v, espOk: false })}
            onEscolher={(v) => atualizar({ especialidade: v, espOk: true })}
          />
          <BuscaCid
            id="enc-cid" rotulo="CID-10" valor={f.cid} confirmado={f.cidOk} largura="medio"
            onDigitar={(v) => atualizar({ cid: v, cidOk: false, procDesc: '', procCod: '' })}
            onEscolher={(codigo) => atualizar({ cid: codigo, cidOk: true, procDesc: '', procCod: '' })}
          />
          <Campo rotulo="Prioridade" largura="cheio">
            <Pilulas opcoes={PRIORIDADES_ENC} valor={f.prioridade} onChange={set('prioridade')} rotuloAria="Prioridade" />
          </Campo>
          <Texto id="enc-destino" rotulo="Unidade ou serviço de destino" valor={f.destino} onChange={set('destino')} dica="Em branco: a definir pela regulação" />
          <Texto id="enc-numreg" rotulo="Nº da solicitação na regulação" valor={f.numReg} onChange={set('numReg')} dica="Se já houver" />
          <Texto id="enc-hipotese" rotulo="Hipótese diagnóstica" valor={f.hipotese} onChange={set('hipotese')} dica="Por extenso" largura="cheio" />
          <BuscaProcedimento
            key={f.cidOk ? f.cid : ''}
            id="enc-proc" cid={f.cid} cidOk={f.cidOk} procDesc={f.procDesc} procCod={f.procCod} largura="medio"
            onDigitar={(v) => atualizar({ procDesc: v, procCod: '' })}
            onEscolher={(codigo, nome) => atualizar({ procDesc: nome, procCod: codigo })}
          />
        </Bloco>

        <Bloco titulo="Motivo do encaminhamento e exames">
          <Texto id="enc-motivo" rotulo="Motivo do encaminhamento (dados clínicos)" valor={f.motivo} onChange={set('motivo')} longo linhas={5} />
          <Leitura rotulo="Sinais vitais (da classificação de risco, como registrados)" valor={vitais} largura="cheio" />
          <Texto id="enc-tratamento" rotulo="Tratamento realizado na origem" valor={f.tratamento} onChange={set('tratamento')} longo linhas={3} />
          <Texto
            id="enc-exames" rotulo="Exames solicitados e resultados" valor={f.exames} onChange={set('exames')} longo linhas={5}
            extra={<BotaoAnexar htmlFor="enc-anexo" />} {...laudo.doCampo}
          >
            <AnexosLaudo
              id="enc-anexo" anexos={f.anexos} lendo={laudo.lendo} arrastando={laudo.arrastando}
              onArquivos={(fs) => void laudo.ler(fs)} onRemover={laudo.remover} onUsar={laudo.usar}
            />
          </Texto>
        </Bloco>

        <Pendencias itens={conferir} titulo="Conferir (não impede a emissão)" />
      </Cartao>

      <Rodape pendencias={pendencias} mensagem={mensagem} salvoEm={salvoEm} servidorSalvoEm={servidor.salvoEm}>
        {null}
      </Rodape>
    </div>
  )
}
