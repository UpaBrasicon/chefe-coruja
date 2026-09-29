import { FUSO_BRASILIA } from '@/hooks/useChat'

// Formatos de hora do chat, sempre no fuso de Brasília (o plantão é local,
// não importa o relógio do aparelho).

const fmtHoraBr = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASILIA, hour: '2-digit', minute: '2-digit' })
const fmtDiaBr = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BRASILIA, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtDataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASILIA, day: '2-digit', month: '2-digit' })

/** "HH:MM" em Brasília. */
export function horaBr(d: Date | string) {
  return fmtHoraBr.format(typeof d === 'string' ? new Date(d) : d)
}

/** "07:12", "ontem · 22:30" ou "27/09 · 16:20". */
export function quandoBr(iso: string | null | undefined, agora = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const dia = fmtDiaBr.format(d)
  if (dia === fmtDiaBr.format(agora)) return horaBr(d)
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  if (dia === fmtDiaBr.format(ontem)) return `ontem · ${horaBr(d)}`
  return `${fmtDataCurta.format(d)} · ${horaBr(d)}`
}

/** Só a data/hora curta para a lista: hora de hoje, "ontem" ou "27/09". */
export function quandoLista(iso: string | null | undefined, agora = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const dia = fmtDiaBr.format(d)
  if (dia === fmtDiaBr.format(agora)) return horaBr(d)
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  if (dia === fmtDiaBr.format(ontem)) return 'ontem'
  return fmtDataCurta.format(d)
}

const ROTULO_PAPEL: Record<string, string> = {
  plantonista: 'Plantonista',
  gestor: 'Gestão da unidade',
  farmaceutico: 'Farmácia',
  enfermeiro: 'Enfermagem',
  tecnico_enfermagem: 'Técnico de enfermagem',
  recepcao: 'Recepção',
  telemedicina: 'Telemedicina',
  admin: 'Administração',
}

export function rotuloPapel(papel: string | null | undefined) {
  return (papel && ROTULO_PAPEL[papel]) || 'Equipe'
}

/** Sub da linha de um contato: papel e, se estiver de plantão, o setor. */
export function subDoContato(c: { papel: string; setor_nome: string | null; em_plantao: boolean }) {
  const partes = [rotuloPapel(c.papel)]
  if (c.setor_nome) partes.push(c.setor_nome)
  if (c.em_plantao) partes.push('de plantão')
  return partes.join(' · ')
}
