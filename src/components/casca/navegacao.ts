import {
  Activity,
  Bell,
  Bird,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Eye,
  FlaskConical,
  FolderSearch,
  Hospital,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  MonitorSmartphone,
  ScrollText,
  Shield,
  ShieldCheck,
  SquareCheckBig,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { BarChart3, BedDouble, ClipboardPlus, Gauge, Hourglass, Monitor, TriangleAlert } from 'lucide-react'
import { FileCheck, FileDown, FileText, FileX, TestTube, History, KeyRound, Receipt, Rocket, PackageCheck, PackageOpen, Wallet, Waypoints } from 'lucide-react'
import { ArrowLeftRight, FileWarning, GitMerge, LifeBuoy, Network, Pill, ShieldAlert, Siren, Syringe } from 'lucide-react'
import { Baby, CalendarCheck, CalendarDays, Ear, Flag, HeartPulse, House, MessageCircleQuestion, Package, Send, Sprout } from 'lucide-react'

import type { Papel, TipoUnidade } from '@/types/database'
import { ABA_NO_PLANTAO } from '../plantao/rotasMedico.ts'

/** Chave da nota numérica (contagem em âmbar ao lado do item). */
export type ChaveNota = 'avisos' | 'triagem' | 'farmacia' | 'pedidos' | 'tele' | 'revisao' | 'fila_medica' | 'plataformas' | 'chamados'

export type ItemNav = {
  to: string
  rotulo: string
  /** Rótulo curto para a barra inferior do celular. */
  curto?: string
  icone: LucideIcon
  /** Casa só a rota exata (NavLink `end`). */
  exato?: boolean
  /** A nota do item: pendências que moram naquela tela. */
  nota?: ChaveNota
  /** Grupo do item no menu (por enquanto só no gestor, parte 4.11). */
  grupo?: string
  /** Rotas de baixo que têm item próprio no menu: nelas este item não acende (um ativo só). */
  exceto?: string[]
}

/** O item não vale para esta rota porque ela tem item próprio no menu (campo `exceto`). */
export function foraDoItem(item: ItemNav, pathname: string): boolean {
  return !!item.exceto?.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Navegação por papel (P/index.html ~32220). Um papel por vez: quem tem mais
// de um na unidade troca pelo menu do usuário. Só entram destinos que existem
// no app; os que o protótipo tem e o app ainda não (Histórico, Protocolos e
// Farmácia do gestor; Pronto-Socorro, Notificações e Internação da enfermagem) chegam com as
// ondas do porte (produto/docs/PLANO-PORTE-FRONTEND.md).
const ITEM_PRONTUARIOS: ItemNav = { to: '/prontuarios', rotulo: 'Prontuários', icone: FolderSearch }
const ITEM_AVISOS: ItemNav = { to: '/notificacoes', rotulo: 'Avisos', icone: Bell, exato: true, nota: 'avisos' }
// Aba Escala (E3): a escala de quem não é plantonista, gestor nem administrador
const ITEM_ESCALA: ItemNav = { to: '/minha-escala', rotulo: 'Escala', icone: CalendarClock, exato: true }
// 5A, tarefa 3: agenda de consultas da UBS (o /agenda é a escala de plantões)
const ITEM_AGENDA_CONSULTAS: ItemNav = { to: '/agenda-consultas', rotulo: 'Agenda de consultas', curto: 'Consultas', icone: CalendarDays, exato: true }
// 5A, tarefa 5: envios à UPA e regulações da UBS, com o rastreio
const ITEM_ENCAMINHADOS: ItemNav = { to: '/encaminhados', rotulo: 'Encaminhados', icone: Send, exato: true }
// 5A, tarefa 7 (J5): hiperdia da UBS, só para médico, enfermagem e gestor
const ITEM_HIPERDIA: ItemNav = { to: '/hiperdia', rotulo: 'Hiperdia', icone: HeartPulse, exato: true }
// 5A, tarefa 7 (K5): pré-natal da UBS, para os mesmos papéis do hiperdia
const ITEM_PRE_NATAL: ItemNav = { to: '/pre-natal', rotulo: 'Pré-natal', icone: Baby, exato: true }
// 5A, tarefa 7 (K6): puericultura da UBS, para os mesmos papéis
const ITEM_PUERICULTURA: ItemNav = { to: '/puericultura', rotulo: 'Puericultura', icone: Sprout, exato: true }
// U7, PR 4 (percurso da UBS): sinais vitais do técnico e do enfermeiro na UBS
const ITEM_SINAIS_VITAIS: ItemNav = { to: '/sinais-vitais', rotulo: 'Sinais vitais', curto: 'Vitais', icone: HeartPulse, exato: true }
// U15, vacina, PR 3 (VC3 = A): lotes de vacina da UBS, do gestor e do enfermeiro
const ITEM_LOTES_VACINA: ItemNav = { to: '/vacina/lotes', rotulo: 'Lotes de vacina', curto: 'Lotes', icone: Syringe, exato: true }
// U15, vacina, PR 4 (VC2 = A): sala de vacina do técnico e do enfermeiro
const ITEM_SALA_VACINA: ItemNav = { to: '/vacina', rotulo: 'Sala de vacina', curto: 'Vacina', icone: Syringe, exato: true }

const POR_PAPEL: Record<Papel, ItemNav[]> = {
  plantonista: [
    // a Farmácia tem item próprio: nela a Central não acende junto (revisão da Farmácia do médico, RT 24/11/2026)
    { to: '/plantonista', rotulo: 'Central do Médico', curto: 'Central', icone: Stethoscope, exceto: ['/plantonista/farmacia'] },
    // RT, 24/11/2026: o Plantão tem as abas Meu turno, Minha agenda e Prontuários; a
    // Internação, item próprio, tem Internação, Observação e Passômetro (o leito aberto
    // também acende a Internação, não o Plantão). A Evolução clínica saiu.
    { to: '/plantao', rotulo: 'Plantão', icone: Activity, exceto: ['/plantao/internacao'] },
    { to: '/plantao/internacao', rotulo: 'Internação', icone: Hospital },
    { to: '/atendimento', rotulo: 'Atendimento', icone: DoorOpen, exato: true },
    { to: '/contingencia', rotulo: 'Contingência', icone: FileWarning, exato: true },
    ITEM_AGENDA_CONSULTAS,
    ITEM_ENCAMINHADOS,
    ITEM_HIPERDIA,
    ITEM_PRE_NATAL,
    ITEM_PUERICULTURA,
    { to: '/teleinterconsulta', rotulo: 'Telemedicina', curto: 'Tele', icone: MonitorSmartphone, exato: true, nota: 'tele' },
    { to: '/pareceres', rotulo: 'Pareceres', icone: MessageSquare, exato: true },
    { to: '/notificacao-compulsoria', rotulo: 'Notificação compulsória', curto: 'Notificação', icone: Shield, exato: true },
    { to: '/plantonista/farmacia', rotulo: 'Farmácia', icone: FlaskConical },
    // só na UBS (SO_NA_UBS_NO_PAPEL): fora dela, Minha agenda e Prontuários são abas do Plantão
    { to: '/agenda', rotulo: 'Minha agenda', curto: 'Agenda', icone: CalendarClock, exato: true },
    ITEM_AVISOS,
    ITEM_PRONTUARIOS,
  ],
  gestor: [
    // Parte 4.11 do padrão do frontend (RT "2a 3a"): menu agrupado por área.
    { to: '/gestao', rotulo: 'Painel', icone: LayoutDashboard, exato: true },
    ITEM_AGENDA_CONSULTAS,
    ITEM_ENCAMINHADOS,
    ITEM_HIPERDIA,
    ITEM_PRE_NATAL,
    ITEM_PUERICULTURA,
    // ── Porta
    { to: '/gestao/porta', rotulo: 'Porta', icone: DoorOpen, exato: true, grupo: 'Porta' },
    { to: '/gestao/intercorrencias', rotulo: 'Intercorrências', curto: 'Intercorr.', icone: Siren, exato: true, grupo: 'Porta' },
    { to: '/cadastros-duplicados', rotulo: 'Cadastros duplicados', curto: 'Duplicados', icone: GitMerge, exato: true, grupo: 'Porta' },
    // ── Leitos
    { to: '/internacao', rotulo: 'Internação', icone: Hospital, exato: true, grupo: 'Leitos' },
    { to: '/observacao', rotulo: 'Observação', icone: Eye, exato: true, grupo: 'Leitos' },
    { to: '/nir', rotulo: 'Pendências do NIR', curto: 'NIR', icone: ClipboardList, exato: true, grupo: 'Leitos' },
    // ── Farmácia
    { to: '/gestao/farmacia', rotulo: 'Farmácia', icone: FlaskConical, exato: true, grupo: 'Farmácia' },
    { to: '/dispensacao', rotulo: 'Dispensação', icone: PackageOpen, exato: true, grupo: 'Farmácia' },
    { to: '/alta-vigilancia', rotulo: 'Alta vigilância', curto: 'Alta vig.', icone: ShieldAlert, exato: true, grupo: 'Farmácia' },
    { to: '/interacoes', rotulo: 'Interações críticas', curto: 'Interações', icone: Pill, exato: true, grupo: 'Farmácia' },
    { to: '/unidade-consumo', rotulo: 'Unidade de consumo', curto: 'Unid. consumo', icone: PackageCheck, exato: true, grupo: 'Farmácia' },
    // ── Exames
    { to: '/gestao/exames', rotulo: 'Exames da unidade', curto: 'Exames', icone: TestTube, exato: true, grupo: 'Exames' },
    // ── Faturamento
    { to: '/faturamento/contas', rotulo: 'Contas do atendimento', curto: 'Contas', icone: Wallet, exato: true, grupo: 'Faturamento' },
    { to: '/faturamento', rotulo: 'BPA', curto: 'BPA', icone: Receipt, exato: true, grupo: 'Faturamento' },
    { to: '/aih', rotulo: 'AIH', icone: FileText, exato: true, grupo: 'Faturamento' },
    { to: '/apac', rotulo: 'APAC', icone: FileCheck, exato: true, grupo: 'Faturamento' },
    { to: '/faturamento/glosas', rotulo: 'Glosas', icone: FileX, exato: true, grupo: 'Faturamento' },
    // Fase 5C, tarefa 3: envio ao ERP (contas e plantões do mês)
    { to: '/faturamento/erp', rotulo: 'Envio ao ERP', curto: 'ERP', icone: ArrowLeftRight, exato: true, grupo: 'Faturamento' },
    { to: '/faturamento/materiais', rotulo: 'Materiais', icone: Package, exato: true, grupo: 'Faturamento' },
    // ── Unidade
    { to: '/unidade', rotulo: 'Unidade', icone: Building2, exato: true, grupo: 'Unidade' },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true, grupo: 'Unidade' },
    { to: '/indicadores', rotulo: 'Indicadores', icone: LineChart, exato: true, grupo: 'Unidade' },
    { to: '/gaviao', rotulo: 'Olho de Gavião', curto: 'Gavião', icone: Bird, exato: true, grupo: 'Unidade' },
    { to: '/auditoria', rotulo: 'Auditoria', icone: ScrollText, exato: true, nota: 'pedidos', grupo: 'Unidade' },
    { to: '/gestao/protocolos', rotulo: 'Protocolos', icone: ClipboardPlus, exato: true, grupo: 'Unidade' },
    { ...ITEM_LOTES_VACINA, grupo: 'Unidade' },
    { to: '/revisao-clinica', rotulo: 'Revisão clínica', curto: 'Revisão', icone: SquareCheckBig, exato: true, grupo: 'Unidade' },
    { to: '/tecnovigilancia', rotulo: 'Tecnovigilância', icone: Flag, exato: true, grupo: 'Unidade' },
    { to: '/gestao/chamados', rotulo: 'Chamados técnicos', curto: 'Chamados', icone: LifeBuoy, exato: true, grupo: 'Unidade' },
  ],
  // Enfermagem (P/index.html 32225–32230): o técnico não tem Triagem nem
  // Notificações; a tela inicial dele segue a escala (InicioEnfermagem).
  enfermeiro: [
    // 5A, tarefa 2, parte 2.4: na UBS a triagem é a escuta inicial do CAB 28
    { to: '/escuta', rotulo: 'Escuta inicial', curto: 'Escuta', icone: Ear, exato: true, nota: 'triagem' },
    // U6, PR 2 (percurso da UBS): as fichas da UBS que vão para a enfermagem
    { to: '/consultorio-enfermagem', rotulo: 'Consultório de enfermagem', curto: 'Consultório', icone: DoorOpen, exato: true },
    ITEM_SINAIS_VITAIS,
    ITEM_SALA_VACINA,
    { to: '/triagem', rotulo: 'Triagem', icone: Activity, exato: true, nota: 'triagem' },
    ITEM_AGENDA_CONSULTAS,
    ITEM_ENCAMINHADOS,
    ITEM_HIPERDIA,
    ITEM_PRE_NATAL,
    ITEM_PUERICULTURA,
    ITEM_LOTES_VACINA,
    { to: '/enfermagem/pronto-socorro', rotulo: 'Pronto-Socorro', curto: 'PS', icone: Stethoscope, exato: true },
    { to: '/notificacao-compulsoria', rotulo: 'Notificação compulsória', curto: 'Notificação', icone: Shield, exato: true },
    { to: '/enfermagem/internacao', rotulo: 'Internação', icone: Users, exato: true },
    { to: '/checagem', rotulo: 'Checagem', icone: ClipboardCheck, exato: true },
    // Fase 5B, etapa 3.2: retirada sem farmacêutico (farmácia fechada)
    { to: '/dispensacao', rotulo: 'Retirada sem farmacêutico', curto: 'Retirada', icone: PackageOpen, exato: true },
    { to: '/alta-vigilancia', rotulo: 'Alta vigilância', curto: 'Alta vig.', icone: ShieldAlert, exato: true },
    { to: '/contingencia', rotulo: 'Contingência', icone: FileWarning, exato: true },
    ITEM_AVISOS,
    ITEM_PRONTUARIOS,
    ITEM_ESCALA,
  ],
  tecnico_enfermagem: [
    ITEM_SINAIS_VITAIS,
    ITEM_SALA_VACINA,
    { to: '/enfermagem/pronto-socorro', rotulo: 'Pronto-Socorro', curto: 'PS', icone: Stethoscope, exato: true },
    { to: '/enfermagem/internacao', rotulo: 'Internação', icone: Users, exato: true },
    { to: '/checagem', rotulo: 'Checagem', icone: ClipboardCheck, exato: true },
    // Fase 5B, etapa 3.2: retirada sem farmacêutico (farmácia fechada)
    { to: '/dispensacao', rotulo: 'Retirada sem farmacêutico', curto: 'Retirada', icone: PackageOpen, exato: true },
    ITEM_AGENDA_CONSULTAS,
    ITEM_HIPERDIA,
    ITEM_PRE_NATAL,
    ITEM_PUERICULTURA,
    ITEM_AVISOS,
    ITEM_PRONTUARIOS,
    ITEM_ESCALA,
  ],
  // Recepção (P/index.html 32220–32224), com a contagem das duas filas.
  // RE2 (revisão do perfil Recepção, RT 24/11/2026): em grupos — Entrada,
  // Filas e Equipe. A Agenda de consultas (só na UBS) fica na Entrada.
  recepcao: [
    // percurso da UBS, U4: a tela "Hoje" (só na UBS) abre a recepção
    { to: '/recepcao/hoje', rotulo: 'Hoje', curto: 'Hoje', icone: CalendarCheck, exato: true },
    { to: '/recepcao', rotulo: 'Nova ficha', curto: 'Ficha', icone: ClipboardPlus, exato: true, grupo: 'Entrada' },
    { to: '/cadastros-duplicados', rotulo: 'Cadastros duplicados', curto: 'Duplicados', icone: GitMerge, exato: true, grupo: 'Entrada' },
    { ...ITEM_AGENDA_CONSULTAS, grupo: 'Entrada' },
    { to: '/recepcao/fila-triagem', rotulo: 'Fila da triagem', curto: 'Triagem', icone: Hourglass, exato: true, nota: 'triagem', grupo: 'Filas' },
    { to: '/recepcao/fila-medica', rotulo: 'Fila médica', curto: 'Médica', icone: Stethoscope, exato: true, nota: 'fila_medica', grupo: 'Filas' },
    { to: '/recepcao/painel', rotulo: 'Painel de chamada', curto: 'Painel', icone: Monitor, exato: true, grupo: 'Filas' },
    // Encaminhados sai do menu da recepção na UBS (R8) e só existe nela: fica fora dos grupos
    ITEM_ENCAMINHADOS,
    { ...ITEM_ESCALA, grupo: 'Equipe' },
  ],
  // Fase 3, tarefa 1: médico regulador — decide a AIH (aprova com número e
  // competência, ou rejeita com motivo)
  regulador: [
    { to: '/aih', rotulo: 'AIH', icone: FileText, exato: true },
    { to: '/apac', rotulo: 'APAC', icone: FileCheck, exato: true },
    ITEM_ESCALA,
  ],
  // Fase 3, tarefa 3: faturamento (sem escala) — conferência e fechamento do
  // BPA, lançamento de procedimentos e códigos SIGTAP da unidade
  faturamento: [
    { to: '/faturamento', rotulo: 'BPA', icone: Receipt, exato: true },
    { to: '/faturamento/contas', rotulo: 'Contas do atendimento', curto: 'Contas', icone: Wallet, exato: true },
    { to: '/faturamento/glosas', rotulo: 'Glosas', icone: FileX, exato: true },
    { to: '/faturamento/erp', rotulo: 'Envio ao ERP', curto: 'ERP', icone: ArrowLeftRight, exato: true },
    // o cadastro de materiais passou à farmácia; o faturamento só lança na conta
    // (ajustes da revisão, item 4, RT em 24/11/2026)
    { to: '/apac', rotulo: 'APAC', icone: FileCheck, exato: true },
    ITEM_ESCALA,
  ],
  // FA2 (revisão do perfil Farmacêutico, RT 24/11/2026): o menu em grupos,
  // Trabalho, Segurança, Estoque e Equipe.
  farmaceutico: [
    { to: '/farmacia', rotulo: 'Central do Farmacêutico', curto: 'Farmácia', icone: FlaskConical, exato: true, nota: 'farmacia', grupo: 'Trabalho' },
    { to: '/dispensacao', rotulo: 'Dispensação', icone: PackageOpen, exato: true, grupo: 'Trabalho' },
    { to: '/alta-vigilancia', rotulo: 'Alta vigilância', curto: 'Alta vig.', icone: ShieldAlert, exato: true, grupo: 'Segurança' },
    { to: '/interacoes', rotulo: 'Interações críticas', curto: 'Interações', icone: Pill, exato: true, grupo: 'Segurança' },
    // Fase 5B, etapa 3.1: unidade de consumo (vale para todas as unidades)
    { to: '/unidade-consumo', rotulo: 'Unidade de consumo', curto: 'Unid. consumo', icone: PackageCheck, exato: true, grupo: 'Estoque' },
    // ajustes da revisão, item 4 (RT, 24/11/2026): a farmácia cadastra os materiais
    // (migration 20270421000073)
    { to: '/faturamento/materiais', rotulo: 'Materiais', icone: Package, exato: true, grupo: 'Estoque' },
    { ...ITEM_ESCALA, grupo: 'Equipe' },
    // Sem Prontuários (RT, 27/10/2026): o que o farmacêutico precisa do
    // paciente chega pela validação e pela dispensação.
  ],
  // Revisão do perfil Telemedicina (TM2, RT 24/11/2026): Chamados (fila, salas e
  // assinaturas em abas), Escala (com a Cobertura dos setores), Histórico e
  // Prontuários. As Credenciais foram para o menu do usuário.
  telemedicina: [
    { to: '/teleinterconsulta', rotulo: 'Chamados', icone: Hourglass, exato: true, nota: 'tele' },
    // E3 da aba Escala (RT, 27/10/2026): a "Minha agenda" vira a Escala comum, com o extrato numa aba
    ITEM_ESCALA,
    { to: '/telemedicina/historico', rotulo: 'Histórico', icone: History, exato: true },
    ITEM_PRONTUARIOS,
  ],
  // Administrador (P/index.html 32242–32246): Rede, Plataformas, Pendências e
  // Servidores; Escala e Olho de Gavião continuam do app.
  // Fase 4, tarefa 12: papéis de rede (Secretaria), escalados na unidade Secretaria
  secretaria: [{ to: '/rede', rotulo: 'Rede', icone: Network, exato: true }, ITEM_AVISOS, ITEM_ESCALA],
  regulacao_regional: [{ to: '/rede', rotulo: 'Rede', icone: Network, exato: true }, ITEM_AVISOS, ITEM_ESCALA],
  faturamento_rede: [{ to: '/rede', rotulo: 'Rede', icone: Network, exato: true }, ITEM_ESCALA],
  // Perfil NIR (RT, 24/11/2026): "aba de Internação, em que vê só o resumo e o
  // que está acontecendo na regulação e consegue anexar exames, e aba de
  // Escala, e só". Os avisos do NIR aparecem no topo da Internação.
  nir: [
    { to: '/nir/internacao', rotulo: 'Internação', icone: Hospital, exato: true },
    ITEM_ESCALA,
  ],
  // Perfil Secretaria (RT, 24/11/2026): a rede da secretaria, a configuração de
  // cada unidade dela (a unidade se escolhe no topo, como nos outros perfis) e as
  // vagas da escala. Sem tela de paciente.
  gestor_secretaria: [
    { to: '/secretaria', rotulo: 'Rede', icone: Network, exato: true },
    { to: '/unidade', rotulo: 'Unidades', icone: Building2, exato: true },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    // as unidades da secretaria lado a lado (migration 20270421000024)
    { to: '/secretaria/indicadores', rotulo: 'Indicadores', icone: BarChart3, exato: true },
  ],
  admin: [
    { to: '/painel', rotulo: 'Rede', icone: Building2, exato: true },
    { to: '/plataformas', rotulo: 'Plataformas', icone: LayoutDashboard, exato: true, nota: 'plataformas' },
    { to: '/pendencias-tecnicas', rotulo: 'Chamados técnicos', curto: 'Chamados', icone: ClipboardList, exato: true, nota: 'chamados' },
    { to: '/servidores', rotulo: 'Servidores', icone: Gauge, exato: true },
    // RT, 24/11/2026: o administrador não monta escala; a aba vira a agenda do
    // dia a dia e das reuniões (link colado do Meet, Zoom ou Teams)
    { to: '/agenda-admin', rotulo: 'Agenda', icone: CalendarDays, exato: true },
    { to: '/gaviao', rotulo: 'Olho de Gavião', curto: 'Gavião', icone: ShieldCheck, exato: true },
  ],
}

const ITEM_REVISAO_CLINICA: ItemNav = { to: '/revisao-clinica', rotulo: 'Revisão clínica', curto: 'Revisão', icone: SquareCheckBig, exato: true, nota: 'revisao' }
// LG12 numa aba própria (RT, 19/11/2026): o responsável técnico médico tem a fila
const ITEM_TECNOVIGILANCIA: ItemNav = { to: '/tecnovigilancia', rotulo: 'Tecnovigilância', icone: Flag, exato: true }

// "Erros e alertas" é do administrador geral (RequireSuperAdmin em App.tsx):
// o administrador da organização que não é super admin não vê o item
const ITEM_ERROS_E_ALERTAS: ItemNav = { to: '/erros-e-alertas', rotulo: 'Erros e alertas', icone: TriangleAlert, exato: true }
// Fase 1, item 14 (PH1 a PH3 = A, 23/11/2026): uso do app, agregado e sem pessoa
const ITEM_USO_DO_APP: ItemNav = { to: '/uso-do-app', rotulo: 'Uso do app', icone: BarChart3, exato: true }
// Fase 3, tarefa 7: chaves da API para integradores (o super admin cria; o gestor vê e revoga)
const ITEM_INTEGRACOES: ItemNav = { to: '/integracoes', rotulo: 'Integrações (API)', curto: 'API', icone: KeyRound, exato: true }
// Fase 3, tarefa 9: exportação estruturada (gestor e super admin)
const ITEM_EXPORTAR: ItemNav = { to: '/exportar', rotulo: 'Exportar dados', curto: 'Exportar', icone: FileDown, exato: true }
// Fase 3, tarefa 10: implantação da unidade (implantador e gestor)
const ITEM_IMPLANTACAO: ItemNav = { to: '/implantacao', rotulo: 'Implantação', icone: Rocket, exato: true }
// Fase 4, tarefa 1: regulação da rede (origem, central e super admin)
const ITEM_REGULACAO: ItemNav = { to: '/regulacao', rotulo: 'Regulação', icone: Waypoints, exato: true }
// Fase 4, tarefa 12: módulo de papéis de rede (o super admin liga por organização)
const ITEM_MODULO_REDE: ItemNav = { to: '/rede', rotulo: 'Rede da Secretaria', curto: 'Secretaria', icone: Network, exato: true }

// 5A, tarefa 1 (D3 do RT em 02/11/2026): numa UBS não há porta, leito,
// internação nem AIH; os itens dessas telas somem do menu.
const FORA_DA_UBS = new Set([
  '/plantonista', '/plantao', '/plantao/internacao', '/plantao/internacao/pacientes', '/passometro', '/contingencia',
  '/gestao/porta', '/gestao/intercorrencias', '/internacao', '/observacao', '/nir', '/nir/internacao', '/aih', '/apac',
  '/triagem', '/enfermagem', '/enfermagem/pronto-socorro', '/enfermagem/internacao',
  '/recepcao/painel',
])
// Percurso da UBS (RT, 17/11/2026, U5): o que sai do menu de um papel só na UBS.
// Recepção sem Encaminhados (R8); enfermeiro sem Alta vigilância, que fica com o
// farmacêutico (E10); médico sem Pareceres (D7) e sem Notificação compulsória,
// que fica com o enfermeiro (D8).
const FORA_DA_UBS_NO_PAPEL: Partial<Record<Papel, Set<string>>> = {
  recepcao: new Set(['/encaminhados']),
  enfermeiro: new Set(['/alta-vigilancia']),
  plantonista: new Set(['/pareceres', '/notificacao-compulsoria']),
  // U13, PR 3: o faturamento de porta e internação (contas, BPA, glosas e
  // materiais) sai do gestor da UBS; a produção da UBS vai ao SISAB (U15). Fica o
  // Envio ao ERP, que leva os plantões do mês.
  gestor: new Set(['/faturamento/contas', '/faturamento', '/faturamento/glosas', '/faturamento/materiais']),
  // os materiais são da conta da porta e da internação: fora da UBS também para a farmácia
  farmaceutico: new Set(['/faturamento/materiais']),
}
// e o que muda de nome nela: na UBS a "triagem" é a escuta da enfermagem (R9)
const NOME_NA_UBS: Record<string, Pick<ItemNav, 'rotulo' | 'curto'>> = {
  '/recepcao/fila-triagem': { rotulo: 'Fila da enfermagem', curto: 'Enfermagem' },
}
// Grupos do gestor: na UBS o grupo "Porta" só tem os cadastros duplicados e o
// "Leitos" só a regulação (U5, achado GE7).
const GRUPO_NA_UBS: Record<string, string> = { Porta: 'Cadastro', Leitos: 'Rede' }
// e o que só existe nela (5A, tarefa 2, parte 2.4: a escuta inicial)
// e o que, num papel, só fica no menu da UBS: fora dela, Minha agenda e
// Prontuários do médico são abas do Plantão (RT, 24/11/2026)
const SO_NA_UBS_NO_PAPEL: Partial<Record<Papel, Set<string>>> = {
  plantonista: new Set(['/agenda', '/prontuarios']),
}
const SO_NA_UBS = new Set(['/recepcao/hoje', '/escuta', '/consultorio-enfermagem', '/sinais-vitais', '/agenda-consultas', '/encaminhados', '/hiperdia', '/pre-natal', '/puericultura', '/vacina/lotes', '/vacina'])

/** A tela não cabe numa unidade deste tipo (e não entra no menu). */
export function foraDoTipo(to: string, tipoUnidade: TipoUnidade | null | undefined): boolean {
  return tipoUnidade === 'ubs' ? FORA_DA_UBS.has(to) : SO_NA_UBS.has(to)
}

/**
 * Itens do papel em foco. O responsável técnico (nomeação da rede, não papel
 * da unidade) ganha a Revisão Clínica em qualquer perfil; o super admin ganha
 * "Erros e alertas" no perfil de administrador. O tipo da unidade tira o que
 * não cabe nela (UBS).
 */
export function itensDeNavegacao(papel: Papel | null, responsavelTecnico = false, superAdmin = false,
  tipoUnidade: TipoUnidade | null = null): ItemNav[] {
  const itens = itensDoPapel(papel, responsavelTecnico, superAdmin).filter((i) => !foraDoTipo(i.to, tipoUnidade))
  if (tipoUnidade !== 'ubs') {
    const soNaUbs = SO_NA_UBS_NO_PAPEL[papel ?? 'plantonista'] ?? null
    return soNaUbs ? itens.filter((i) => !soNaUbs.has(i.to)) : itens
  }
  const fora = (papel && FORA_DA_UBS_NO_PAPEL[papel]) || null
  if (papel === 'plantonista') itens.push(ITEM_REGULACAO)
  return itens
    .filter((i) => !fora?.has(i.to))
    .map((i) => ({ ...i, ...NOME_NA_UBS[i.to], ...(i.grupo && GRUPO_NA_UBS[i.grupo] ? { grupo: GRUPO_NA_UBS[i.grupo] } : {}) }))
}

function itensDoPapel(papel: Papel | null, responsavelTecnico: boolean, superAdmin: boolean): ItemNav[] {
  const itens = [...POR_PAPEL[papel ?? 'plantonista']]
  if (papel === 'admin' && superAdmin) {
    const i = itens.findIndex((x) => x.to === '/servidores')
    itens.splice(i >= 0 ? i + 1 : itens.length, 0, ITEM_ERROS_E_ALERTAS, ITEM_USO_DO_APP, ITEM_INTEGRACOES, ITEM_EXPORTAR, ITEM_IMPLANTACAO, ITEM_REGULACAO, ITEM_MODULO_REDE)
  } else if (papel === 'admin') {
    // RT, 24/11/2026: o administrador da organização regulamenta as centrais da rede
    itens.push(ITEM_REGULACAO)
  }
  if (papel === 'gestor') {
    itens.push({ ...ITEM_REGULACAO, grupo: 'Leitos' }, ...[ITEM_INTEGRACOES, ITEM_EXPORTAR, ITEM_IMPLANTACAO].map((i) => ({ ...i, grupo: 'Unidade' })))
  }
  // R2 (RT, 24/11/2026): a Regulação do médico mora dentro de Atendimento, na
  // aba "Em regulação"; o item volta só na UBS (itensDeNavegacao), onde o
  // Atendimento é o consultório e a regulação sai das consultas.
  if (papel === 'regulador') itens.push(ITEM_REGULACAO)
  if (responsavelTecnico) {
    // o gestor já tem o item; o responsável técnico o ganha com a nota da fila
    const i = itens.findIndex((x) => x.to === ITEM_REVISAO_CLINICA.to)
    if (i >= 0) itens[i] = { ...ITEM_REVISAO_CLINICA, grupo: itens[i].grupo }
    else itens.push(ITEM_REVISAO_CLINICA)
    if (!itens.some((x) => x.to === ITEM_TECNOVIGILANCIA.to)) {
      const j = itens.findIndex((x) => x.to === ITEM_REVISAO_CLINICA.to)
      itens.splice(j + 1, 0, { ...ITEM_TECNOVIGILANCIA, grupo: itens[j].grupo })
    }
  }
  return papel === 'gestor' ? ordenarPorGrupo(itens) : itens
}

const ORDEM_GRUPOS = [undefined, 'Porta', 'Leitos', 'Farmácia', 'Exames', 'Faturamento', 'Unidade']
/** Ordem estável pelos grupos: quem entrou depois (Regulação, Integrações…) cai no fim do seu grupo. */
function ordenarPorGrupo(itens: ItemNav[]): ItemNav[] {
  const pos = (i: ItemNav) => { const p = ORDEM_GRUPOS.indexOf(i.grupo); return p < 0 ? ORDEM_GRUPOS.length : p }
  return itens.map((item, k) => ({ item, k })).sort((a, b) => pos(a.item) - pos(b.item) || a.k - b.k).map((x) => x.item)
}

/** Itens em blocos consecutivos do mesmo grupo (grupo null = sem título). */
export function agruparNavegacao(itens: ItemNav[]): { grupo: string | null; itens: ItemNav[] }[] {
  const blocos: { grupo: string | null; itens: ItemNav[] }[] = []
  for (const item of itens) {
    const g = item.grupo ?? null
    const ult = blocos[blocos.length - 1]
    if (ult && ult.grupo === g) ult.itens.push(item)
    else blocos.push({ grupo: g, itens: [item] })
  }
  return blocos
}

/** Ícone de cada grupo no trilho das áreas do gestor (revisão visual 3.9, opção B). */
export const ICONE_GRUPO: Record<string, LucideIcon> = {
  Porta: DoorOpen,
  Leitos: BedDouble,
  // grupos do farmacêutico (FA2)
  Trabalho: FlaskConical,
  'Segurança': ShieldAlert,
  Estoque: PackageCheck,
  Cadastro: GitMerge,
  Rede: Waypoints,
  // grupos da recepção (RE2)
  Entrada: ClipboardPlus,
  Filas: Hourglass,
  'Farmácia': FlaskConical,
  Exames: TestTube,
  Faturamento: Receipt,
  Unidade: Building2,
}

/**
 * Barra inferior do celular (correções do portão, tarefa 8): no máximo cinco
 * posições. Com mais itens, quatro fixos e o "Mais", que abre a lista do resto.
 * Os fixos seguem a ordem do menu, salvo o papel que tem os seus (decisão do
 * RT: no enfermeiro, Triagem e Pronto-Socorro fazem a mesma função, e
 * Internação e Checagem também — fica um de cada, mais Notificações e Alta
 * vigilância).
 */
export const MAX_BARRA_CELULAR = 5
const FIXOS_CELULAR: Partial<Record<Papel, string[]>> = {
  enfermeiro: ['/escuta', '/triagem', '/enfermagem/internacao', '/notificacao-compulsoria', '/alta-vigilancia'],
}
export function dividirBarraCelular(papel: Papel | null, itens: ItemNav[]): { fixos: ItemNav[]; mais: ItemNav[] } {
  if (itens.length <= MAX_BARRA_CELULAR) return { fixos: itens, mais: [] }
  const preferidos = ((papel && FIXOS_CELULAR[papel]) || [])
    .map((to) => itens.find((i) => i.to === to))
    .filter((i): i is ItemNav => !!i)
  const fixos = [...preferidos, ...itens.filter((i) => !preferidos.includes(i))].slice(0, MAX_BARRA_CELULAR - 1)
  return { fixos, mais: itens.filter((i) => !fixos.includes(i)) }
}

/** "Perguntar à IA" da barra do médico: a busca da Central completa, com o campo já em foco. */
export const ROTA_PERGUNTAR_IA = '/plantonista?todas=1&ia=1'

/**
 * Barra de baixo do médico abaixo de 1024px (item 6, CM1 = A, RT em
 * 23/11/2026): Início, Leitos, Perguntar à IA (no meio, em destaque),
 * Prontuários e Menu. Substitui as quatro abas do topo; o resto vai para o
 * Menu, e a Agenda é aba do Plantão (RT, 24/11/2026). Numa UBS saem as telas
 * do pronto atendimento e a Agenda volta para a barra, para não ficar só
 * Prontuários.
 */
export const BARRA_MEDICO_CELULAR: ItemNav[] = [
  { to: '/plantonista', rotulo: 'Início', icone: House },
  { to: '/plantao/internacao/pacientes', rotulo: 'Leitos', icone: Users },
  { to: ROTA_PERGUNTAR_IA, rotulo: 'Perguntar à IA', icone: MessageCircleQuestion },
  { to: '/prontuarios', rotulo: 'Prontuários', icone: BookOpen },
  { to: '/agenda', rotulo: 'Agenda', icone: CalendarClock },
]

/**
 * Os itens da barra do médico que cabem no tipo da unidade (no máximo quatro; o
 * quinto lugar é o Menu). Fora da UBS, Prontuários leva à aba do Plantão (RT,
 * 24/11/2026) e a Agenda, que não cabe, fica na aba Minha agenda do Plantão.
 */
export function barraMedicoCelular(tipoUnidade: TipoUnidade | null = null): ItemNav[] {
  const cabem = BARRA_MEDICO_CELULAR.filter((i) => !foraDoTipo(i.to.split('?')[0], tipoUnidade))
  const barra = cabem.length > MAX_BARRA_CELULAR - 1 ? cabem.filter((i) => i.to !== '/agenda') : cabem
  return tipoUnidade === 'ubs' ? barra : barra.map((i) => (ABA_NO_PLANTAO[i.to] ? { ...i, to: ABA_NO_PLANTAO[i.to] } : i))
}

/** O Menu da barra do médico: as telas do menu que não estão na barra (a Agenda mora no Plantão, ou na barra na UBS). */
export function menuMedicoCelular(itens: ItemNav[], tipoUnidade: TipoUnidade | null = null): ItemNav[] {
  const naBarra = new Set(barraMedicoCelular(tipoUnidade).map((i) => i.to.split('?')[0]))
  return itens.filter((i) => !naBarra.has(i.to))
}

/** Página inicial do papel: o logotipo leva a ela. */
export function inicioDoPapel(papel: Papel | null, tipoUnidade: TipoUnidade | null = null): string {
  return itensDeNavegacao(papel, false, false, tipoUnidade)[0]?.to ?? '/'
}

