// Primeiros passos (Fase 1, item 13; OB1–OB4 = A do RT em 23/11/2026,
// docs/frontend/ONBOARDING-DIAGNOSTICO.md). Um cartão na tela inicial de cada
// papel, com tarefas e regras tiradas dos roteiros de treinamento
// (docs/implantacao/treinamento/*.md). Cada tarefa leva a uma tela do menu do
// papel; a que não existe no menu da unidade (UPA × UBS) não aparece.

export type Passo = { id: string; texto: string; to: string }
export type Guia = { titulo: string; passos: Passo[]; regras: string[] }

const REGRA_AUTOR = 'Cada registro leva o nome de quem está logado. Não use o login de outra pessoa.'

export const GUIAS: Record<string, Guia> = {
  recepcao: {
    titulo: 'Recepção',
    passos: [
      { id: 'hoje', texto: 'Veja o dia: consultas marcadas, quem chegou e as filas', to: '/recepcao/hoje' },
      { id: 'ficha', texto: 'Procure o paciente antes de cadastrar e abra a ficha', to: '/recepcao' },
      { id: 'triagem', texto: 'Acompanhe a fila da triagem (ou da enfermagem)', to: '/recepcao/fila-triagem' },
      { id: 'medica', texto: 'Acompanhe a fila médica', to: '/recepcao/fila-medica' },
      { id: 'painel', texto: 'Abra o painel de chamada', to: '/recepcao/painel' },
      { id: 'duplicados', texto: 'Veja os cadastros que podem estar duplicados', to: '/cadastros-duplicados' },
    ],
    regras: [REGRA_AUTOR, 'A recepção não classifica risco: a classificação é da enfermagem.'],
  },
  enfermeiro: {
    titulo: 'Enfermagem',
    passos: [
      { id: 'triagem', texto: 'Classifique o risco de quem espera', to: '/triagem' },
      { id: 'escuta', texto: 'Faça a escuta inicial (UBS)', to: '/escuta' },
      { id: 'ps', texto: 'Acompanhe o Pronto-Socorro: procedimentos e anotação', to: '/enfermagem/pronto-socorro' },
      { id: 'checagem', texto: 'Cheque a medicação prescrita', to: '/checagem' },
      { id: 'internacao', texto: 'Registre a evolução de enfermagem do internado', to: '/enfermagem/internacao' },
      { id: 'vitais', texto: 'Registre sinais vitais (UBS)', to: '/sinais-vitais' },
    ],
    regras: [REGRA_AUTOR, 'Sinais vitais saem crus, sem marca de alterado: a análise é da enfermagem.'],
  },
  tecnico_enfermagem: {
    titulo: 'Técnico de enfermagem',
    passos: [
      { id: 'ps', texto: 'Acompanhe o Pronto-Socorro: procedimentos e anotação', to: '/enfermagem/pronto-socorro' },
      { id: 'checagem', texto: 'Cheque a medicação prescrita', to: '/checagem' },
      { id: 'internacao', texto: 'Faça a anotação de enfermagem do internado', to: '/enfermagem/internacao' },
      { id: 'vitais', texto: 'Registre sinais vitais (UBS)', to: '/sinais-vitais' },
      { id: 'vacina', texto: 'Abra a sala de vacina (UBS)', to: '/vacina' },
    ],
    regras: [REGRA_AUTOR],
  },
  plantonista: {
    titulo: 'Médico',
    passos: [
      { id: 'plantao', texto: 'Veja o seu turno, a agenda e os prontuários no Plantão', to: '/plantao' },
      { id: 'internacao', texto: 'Acompanhe internação, observação e passômetro', to: '/plantao/internacao' },
      { id: 'atendimento', texto: 'Atenda um paciente classificado da fila', to: '/atendimento' },
      { id: 'central', texto: 'Conheça as ferramentas da Central do Médico', to: '/plantonista' },
      { id: 'agenda', texto: 'Veja a agenda de consultas (UBS)', to: '/agenda-consultas' },
      { id: 'tele', texto: 'Saiba pedir uma teleinterconsulta', to: '/teleinterconsulta' },
      { id: 'notificacao', texto: 'Saiba abrir uma notificação compulsória', to: '/notificacao-compulsoria' },
    ],
    regras: [REGRA_AUTOR, 'O sistema não sugere a cor de risco: a classificação é da enfermagem.', 'Dose não é convertida de adulto para criança.'],
  },
  farmaceutico: {
    titulo: 'Farmácia',
    passos: [
      { id: 'central', texto: 'Acompanhe as prescrições do dia na Central do Farmacêutico', to: '/farmacia' },
      { id: 'dispensacao', texto: 'Faça uma dispensação', to: '/dispensacao' },
      { id: 'alta', texto: 'Revise a lista de alta vigilância da unidade', to: '/alta-vigilancia' },
      { id: 'interacoes', texto: 'Veja as interações críticas', to: '/interacoes' },
    ],
    regras: [REGRA_AUTOR, 'Dose e limite vêm de fonte declarada; sem fonte pediátrica, não se converte dose de adulto para criança.'],
  },
  faturamento: {
    titulo: 'Faturamento',
    passos: [
      { id: 'contas', texto: 'Confira as contas do atendimento', to: '/faturamento/contas' },
      { id: 'bpa', texto: 'Abra a competência do BPA', to: '/faturamento' },
      { id: 'glosas', texto: 'Acompanhe as glosas', to: '/faturamento/glosas' },
      { id: 'apac', texto: 'Veja as APAC', to: '/apac' },
    ],
    regras: [REGRA_AUTOR, 'A versão da tabela SIGTAP fica registrada em cada crítica.'],
  },
  gestor: {
    titulo: 'Gestão',
    passos: [
      { id: 'unidade', texto: 'Confira a unidade: CNES, setores, leitos e pessoas', to: '/unidade' },
      { id: 'escala', texto: 'Monte ou confira a escala', to: '/escala' },
      { id: 'painel', texto: 'Acompanhe o painel', to: '/gestao' },
      { id: 'duplicados', texto: 'Unifique cadastros duplicados', to: '/cadastros-duplicados' },
      { id: 'indicadores', texto: 'Veja os indicadores', to: '/indicadores' },
      { id: 'auditoria', texto: 'Conheça a auditoria', to: '/auditoria' },
    ],
    regras: ['O gestor não altera registro clínico: a correção é por retificação, feita pelo autor.', 'Toda exportação e todo acesso a prontuário ficam na auditoria.'],
  },
}

/** O guia do papel, só com as tarefas que existem no menu desta unidade. */
export function guiaDoPapel(papel: string | null | undefined, rotasDoMenu: string[]): Guia | null {
  const g = papel ? GUIAS[papel] : undefined
  if (!g) return null
  const rotas = new Set(rotasDoMenu)
  const passos = g.passos.filter((p) => rotas.has(p.to))
  return passos.length ? { ...g, passos } : null
}

/** `visto`: a pessoa já viu o cartão aberto uma vez; dali em diante ele abre recolhido numa linha (EN3). */
export type Progresso = { feitos: string[]; escondido: boolean; visto?: boolean }
export const PROGRESSO_VAZIO: Progresso = { feitos: [], escondido: false }

/** Chave no aparelho, separada por pessoa e papel (OB4 = A). */
export const chaveProgresso = (perfilId: string, papel: string) => `cc-primeiros-passos:${perfilId}:${papel}`

export function lerProgresso(texto: string | null): Progresso {
  if (!texto) return PROGRESSO_VAZIO
  try {
    const p = JSON.parse(texto) as Partial<Progresso>
    const feitos = Array.isArray(p.feitos) ? p.feitos.filter((x): x is string => typeof x === 'string') : []
    return p.visto === true ? { feitos, escondido: p.escondido === true, visto: true } : { feitos, escondido: p.escondido === true }
  } catch {
    return PROGRESSO_VAZIO
  }
}

/** O cartão aparece até a pessoa esconder ou fazer todos os passos (OB3 = A). */
export function mostrarCartao(guia: Guia | null, p: Progresso): boolean {
  if (!guia || p.escondido) return false
  return guia.passos.some((x) => !p.feitos.includes(x.id))
}
