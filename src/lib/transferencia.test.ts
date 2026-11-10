// node --experimental-strip-types --test src/lib/transferencia.test.ts
// Lacuna 7: regras do checklist e dos textos (iguais às do servidor) e a folha
// do documento de transferência em duas vias.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { montarFolha, type ContextoFolha } from './folhas.ts'
import {
  documentoEmitido, faltaNoItem, faltasDosTextos, itensDe, opcoesDoItem, pendentesDoChecklist, rotuloSinal, textoItemTransferencia,
  textosIniciais, type ItemChecklist,
} from './transferencia.ts'

test('checklist: médico e enfermagem têm itens próprios', () => {
  assert.deepEqual(itensDe('medico').map((i) => i.item), ['contato_destino', 'regulacao', 'autorizacao', 'estabilizado', 'transporte'])
  assert.deepEqual(itensDe('enfermagem').map((i) => i.item), ['acompanhante_equipe', 'isolamento_informado', 'incubadora'])
  assert.equal(opcoesDoItem('estabilizado'), null)
  assert.deepEqual(opcoesDoItem('acompanhante_equipe')?.map((o) => o.valor), ['medico', 'enfermagem', 'medico_e_enfermagem'])
})

test('checklist: feito pede o detalhe; "não se aplica" pede o motivo', () => {
  assert.match(faltaNoItem('contato_destino', null, '', '') ?? '', /Marque/)
  assert.match(faltaNoItem('contato_destino', 'feito', 'Jo', '') ?? '', /nome de quem aceitou/)
  assert.equal(faltaNoItem('contato_destino', 'feito', 'Dra. Ana', ''), null)
  assert.match(faltaNoItem('regulacao', 'feito', '  ', '') ?? '', /número ou o protocolo/)
  assert.match(faltaNoItem('regulacao', 'nao_se_aplica', '', 'vaga') ?? '', /mínimo de 10/)
  assert.equal(faltaNoItem('regulacao', 'nao_se_aplica', '', 'Central fora do ar, vaga zero'), null)
  assert.match(faltaNoItem('transporte', 'feito', 'carro', '') ?? '', /Escolha/)
  assert.equal(faltaNoItem('transporte', 'feito', 'ambulancia_avancada', ''), null)
  assert.equal(faltaNoItem('autorizacao', 'feito', 'responsavel', ''), null)
  assert.equal(faltaNoItem('estabilizado', 'feito', '', ''), null)
})

test('incubadora só no recém-nascido (até 27 dias)', () => {
  assert.match(faltaNoItem('incubadora', 'feito', '', '') ?? '', /recém-nascido/)
  assert.equal(faltaNoItem('incubadora', 'feito', '', '', true), null)
})

test('textos do médico: resumo, condutas e motivo', () => {
  assert.deepEqual(faltasDosTextos({ resumo_clinico: 'curto', condutas: 'x', motivo: '' }).length, 3)
  assert.deepEqual(faltasDosTextos({ resumo_clinico: 'Dor torácica há duas horas', condutas: 'AAS e heparina', motivo: 'Sem hemodinâmica' }), [])
})

test('a transferência só sai com documento em vigor', () => {
  const doc = (estado: string) => ({ documento: { id: 'd', numero: '1', versao: 1, estado, emitido_em: '', autor: null, autor_registro: null, conteudo: { formato: 'transferencia' } } })
  assert.equal(documentoEmitido(null), false)
  assert.equal(documentoEmitido({ documento: null }), false)
  assert.equal(documentoEmitido(doc('ativo')), true)
  assert.equal(documentoEmitido(doc('cancelado')), false)
  assert.deepEqual(textosIniciais({ documento: { ...doc('ativo').documento, conteudo: { formato: 'transferencia', textos: { resumo_clinico: 'a', condutas: 'b', motivo: 'c' } } } }),
    { resumo_clinico: 'a', condutas: 'b', motivo: 'c' })
})

test('pendências e texto de cada item', () => {
  const ck: ItemChecklist[] = [
    { item: 'contato_destino', quem: 'medico', situacao: 'feito', detalhe: 'Dra. Ana' },
    { item: 'regulacao', quem: 'medico', situacao: null },
    { item: 'incubadora', quem: 'enfermagem', situacao: 'nao_se_aplica', motivo: 'Não é recém-nascido (mais de 27 dias de vida).', automatico: true },
  ]
  assert.deepEqual(pendentesDoChecklist(ck), ['Número da regulação'])
  assert.equal(textoItemTransferencia(ck[0]), 'Feito: aceito por Dra. Ana')
  assert.equal(textoItemTransferencia(ck[1]), 'Pendente')
  assert.equal(textoItemTransferencia({ item: 'transporte', situacao: 'feito', detalhe: 'ambulancia_avancada' }), 'Feito: Ambulância de suporte avançado (tipo D)')
  assert.equal(rotuloSinal('frequencia-cardiaca'), 'FC')
  assert.equal(rotuloSinal('outro-sinal'), 'outro sinal')
})

const ctx: ContextoFolha = {
  unidade: { nome: 'UPA Teste', cnes: '1234567' }, paciente: { nome: 'Paciente <Teste>', nascimento: '1960-01-01' },
  alergias: { estado: 'tem', itens: [{ substancia: 'Dipirona', gravidade: 'grave' }] },
  autor: { nome: 'Médico Teste', registro: 'CRM 12345/GO' },
  emissao: { modo: 'emitido', numero: '2026-000200', versao: 1, protocolo: 'IMP-ABCDEF0123', em: '2026-11-10T15:10:00Z', codigo: 'ABC1-2345-6789' },
}
const conteudo = {
  formato: 'transferencia', fontes: ['Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1 (a, b, d, f, g, h, l) e 3.3 (e)'],
  aviso: 'O médico que transfere responde pelo paciente até ele ser recebido.',
  textos: { resumo_clinico: 'Dor torácica <há 2 h>', condutas: 'AAS 300 mg', motivo: 'Sem hemodinâmica' },
  dados: {
    origem: { atendimento: 'porta', unidade: 'UPA Teste', setor: 'Pronto-socorro', entrada_em: '2026-11-10T13:00:00Z' },
    diagnostico_entrada: { hipotese: 'Síndrome coronariana aguda', cid: 'I21.9' },
    alergias: { estado: 'tem', itens: [{ substancia: 'Dipirona', gravidade: 'grave', reacao: 'urticária' }] },
    sinais_vitais: [{ conceito: 'frequencia-cardiaca', valor: '132.0', unidade: 'bpm', aferido_em: '2026-11-10T14:00:00Z' }],
    prescricao: [{ descricao: 'Haloperidol 5 mg/mL', dose: '5 mg', via: 'IM', posologia: '8/8h', valida_ate: '2026-11-11T14:00:00Z', vencido: false, controlado: 'C1' }],
    controlados: [{ descricao: 'Haloperidol 5 mg/mL', lista: 'C1' }],
    exames: [{ exame: 'Troponina', situacao: 'resultado', resultado: 'Troponina I 2,3 ng/mL' }],
    dispositivos: [], isolamento: [{ tipo: 'contato' }], contencao: [],
    regulacao: { id: 'r', numero: 77, protocolo_externo: 'PROTO-7788', destino: 'Hospital Destino', transporte: 'ambulancia_avancada',
                 aceite: { por: 'Dra. Receptora', registro: 'CRM 4321/GO', em: '2026-11-10T14:30:00Z' } },
  },
  checklist_na_emissao: [{ item: 'estabilizado', quem: 'medico', situacao: 'feito' }],
  checklist_atual: [{ item: 'estabilizado', quem: 'medico', situacao: 'feito' }, { item: 'contato_destino', quem: 'medico', situacao: 'feito', detalhe: 'Dra. Receptora', por: 'Médico Teste' }],
}

test('folha: duas vias, intercorrências do transporte e assinatura de quem recebe', () => {
  const html = montarFolha('documento_transferencia', conteudo, ctx)
  assert.equal(html.match(/<section class="ficha">/g)?.length, 2)
  assert.match(html, /Via do destino/)
  assert.match(html, /Via do prontuário da origem/)
  assert.match(html, /Intercorrências do transporte/)
  assert.match(html, /Médico que recebe/)
  assert.match(html, /Médico que transfere/)
  assert.match(html, /CRM 12345\/GO/)
  assert.match(html, /Dor torácica &lt;há 2 h&gt;/)
  assert.match(html, /132\.0/)
  assert.doesNotMatch(html, /alterad|crític/i)
  assert.match(html, /válido até 11\/11\/2026/)
  assert.match(html, /lista C1/)
  assert.match(html, /PROTO-7788/)
  assert.match(html, /aceito por Dra\. Receptora/)
  assert.match(html, /situação na impressão/)
  assert.match(html, /Pendente/)
})

test('folha: documento de transferência sem o formato novo sai como texto', () => {
  const html = montarFolha('documento_transferencia', { texto: 'Transferido.' }, ctx)
  assert.match(html, /Transferido\./)
  assert.match(html, /Documento de transferência/)
})
