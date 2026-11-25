// node --experimental-strip-types --test src/lib/folhaPrescricaoTela.test.ts
// Folha de prescrição do leito (modelo do RT, 24/11/2026, PM1 a PM5) e o Resumo
// do leito sem o "Resumo do caso": leitura do código, como os outros testes de tela.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { montarFolha, type ContextoFolha } from './folhas.ts'

const ler = (p: string) => readFileSync(p, 'utf8')
const estruturada = ler('src/components/prescricao/PrescricaoEstruturada.tsx')
const cabecalho = ler('src/components/prescricao/CabecalhoFolha.tsx')
const painel = ler('src/components/prescricao/PainelPacienteFolha.tsx')
const alergiaRapida = ler('src/components/paciente/AlergiaRapida.tsx')
const documentos = ler('src/components/internacao/caderno/Documentos.tsx')
const leito = ler('src/components/internacao/LeitoAberto.tsx')

test('PM1: folha numerada — 01 dieta, itens a partir de 02, "PS" da porta e a linha nova', () => {
  assert.match(estruturada, /<LinhaDieta dieta=\{dieta\} \/>/)
  assert.match(estruturada, />01<\/span>/)
  assert.match(estruturada, /lista\.map\(\(i, k\) => linha\(i, numeroLinha\(k \+ 2\), 'leito'\)\)/)
  assert.match(estruturada, /porta\.map\(\(i\) => linha\(i, 'PS', 'porta'\)\)/)
  assert.match(estruturada, /folha=\{\{ indice: indiceNovaLinha\(lista\.length, false\) \}\}/)
  // a dieta segue o rascunho do leito (não há dieta no banco)
  assert.match(documentos, /mudar: \(v\) => doc\.atualizar\(\{ dieta: v \}\)/)
  assert.doesNotMatch(documentos, /function PesoDieta/)
})

test('linha PS: ações sempre à vista; "Agora" sem botão de Manter no leito (renovar_prescricao recusa)', () => {
  assert.match(estruturada, /const podeManter = daPorta && !!i\.valida_ate && i\.tipo !== 'contencao'/)
  assert.match(estruturada, /\{daPorta && !podeManter && \(\s*<span[^>]*>\{semManterNoLeito\(i\.tipo\)\}/)
  assert.match(estruturada, /cn\('flex items-center gap-1', !daPorta && ACOES_AO_PASSAR\)/)
  // o servidor recusa o "Agora" na renovação: a tela não oferece o botão
  const sql = ler('supabase/migrations/20270327000001_prescricao_vencida.sql')
  assert.match(sql, /IF it\.valida_ate IS NULL THEN RAISE EXCEPTION '%: item "Agora" \(dose única\) não vence\.'/)
})

test('PM1: as mesmas RPCs e travas de antes', () => {
  for (const rpc of ['prescricao_vigente', 'prescricao_porta_ativa', 'interacoes_justificadas', 'alteracoes_de_itens', 'horarios_dos_itens',
    'buscar_medicamento', 'falta_do_medicamento', 'diluicao_vigente', 'sinalizar_falta', 'prescrever', 'suspender_item', 'registrar_idade_estimada']) {
    assert.match(estruturada, new RegExp(`rpc\\('${rpc}'`), rpc)
  }
  assert.match(estruturada, /import \{ useTravas \} from '@\/components\/paciente\/useTravas'/)
  assert.match(estruturada, /interacoesDoErro\(error\)/)
  assert.match(estruturada, /justificativa_divergencia: justificativa/)
  assert.match(estruturada, /<NovoItemContencao /)
})

test('PM2: cabeçalho com validade, peso e alergias; a trava de alergia segue a do banco', () => {
  assert.match(cabecalho, /Validade 24 h · a enfermagem não executa prescrição fora da validade \(Res\. Cofen 689\/2022, art\. 4º\)/)
  assert.match(cabecalho, /textoItensVigentes\(nVigentes\)/)
  assert.match(cabecalho, /<CampoPeso /)
  assert.match(cabecalho, /<AlergiaRapida /)
  assert.match(cabecalho, /<GavetaAlergias /)
  assert.match(alergiaRapida, /rpc\('registrar_nega_alergia'/)
  assert.match(alergiaRapida, /rpc\('registrar_alergia'/)
  // nada de travar o item pela busca de texto da substância
  for (const f of [estruturada, cabecalho, alergiaRapida]) {
    assert.doesNotMatch(f, /substancia[^\n]*\.includes\(|\.includes\([^\n]*substancia/)
  }
})

test('PM3: a faixa dos vencidos abre a revisão item a item, nunca renova tudo num clique', () => {
  assert.match(estruturada, /Revisar e renovar/)
  assert.match(estruturada, /<RenovarPrescricao embutido /)
  // a renovação direta é só de um item (renovarItem), nunca de uma lista
  assert.doesNotMatch(estruturada, /rpc\('renovar_prescricao'/)
  assert.doesNotMatch(estruturada, /Renovar os/)
})

test('PM4: abas, Ctrl+Enter, edição na linha "ED"; sem Desfazer nem Reativar (não há RPC)', () => {
  assert.match(estruturada, /medicamento: 'Medicamento', cuidado: 'Cuidado', contencao: 'Contenção mecânica'/)
  assert.match(estruturada, /<TabsTrigger key=\{t\} value=\{t\}>/)
  assert.match(estruturada, /ehAtalhoPrescrever\(e\)/)
  assert.match(estruturada, /data-atalho="prescrever"/)
  assert.match(ler('src/components/prescricao/ItemContencao.tsx'), /data-atalho="prescrever"/)
  assert.match(estruturada, /Alterando prescrição: /)
  assert.match(estruturada, /Cancelar edição/)
  assert.match(estruturada, /alterarItemPrescricao\(item\.id, motivo, f\)/)
  assert.match(estruturada, /Itens suspensos \/ histórico/)
  assert.doesNotMatch(estruturada, /reativar|Desfazer/i)
})

// A folha impressa é a oficial (abrirImpressao, registrada no prontuário; o
// servidor monta pela edge function `folha`): A4, cabeçalho do paciente e a
// assinatura e carimbo do médico (autor = login). Aqui ela passa a levar a dieta.
test('PM5: painel do paciente e folha impressa com a dieta e a assinatura do médico', () => {
  for (const r of ['Leito', 'Situação', 'Internado em', 'Na unidade desde', 'Classificação', 'Diagnóstico']) {
    assert.match(painel, new RegExp(`rotulo="${r}"`), r)
  }
  // a cor é só mostrada (da enfermagem): sem onClick
  assert.match(painel, /<SeloClassificacao cor=\{c\.cor\} \/>/)
  assert.match(estruturada, /dieta: dieta\.valor/)
  const ctx: ContextoFolha = {
    unidade: { nome: 'UPA Teste' }, paciente: { nome: 'Paciente Teste', nascimento: '1980-01-01' },
    autor: { nome: 'Médico Teste', registro: 'CRM 9' }, emissao: { modo: 'rascunho' },
  }
  const html = montarFolha('prescricao', { paciente: { nome: 'Paciente Teste', dieta: 'Dieta branda' }, itens: [], obs: '' }, ctx)
  assert.match(html, /<strong>Médico Teste<\/strong><br>CRM 9<br>Assinatura e carimbo/)
  assert.match(html, /@page\{size:A4/)
  assert.match(html, /Dieta<\/span> Dieta branda/)
})

test('Resumo do leito: sem o "Resumo do caso", sem a linha dos agravos e sem o "Histórico na unidade"', () => {
  const caderno = leito.slice(leito.indexOf('function ResumoCaderno'), leito.indexOf('function AltaEDocumentos'))
  assert.ok(caderno.length > 0)
  assert.doesNotMatch(leito, /<ResumoClinico /)
  assert.doesNotMatch(leito, /<AgravosNotificacao /)
  assert.doesNotMatch(caderno, /Histórico na unidade"/)
  assert.doesNotMatch(caderno, /<TrilhaEpisodio /)
  // o "Abrir notificação" do diagnóstico vai à Notificação compulsória
  assert.match(leito, /const irNotificacao = \(\) => navigate\('\/notificacao-compulsoria'\)/)
  // os componentes continuam onde são usados
  assert.match(ler('src/components/internacao/caderno/PassosAlta.tsx'), /<AgravosNotificacao /)
})
