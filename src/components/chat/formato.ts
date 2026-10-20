import { dataIso, diaMes, hora } from '@/lib/formato'

// Formatos de hora do chat, sempre no fuso de Brasília (o plantão é local,
// não importa o relógio do aparelho).

/** "HH:MM" em Brasília. */
export function horaBr(d: Date | string) {
  return hora(d)
}

/** "07:12", "ontem · 22:30" ou "27/09 · 16:20". */
export function quandoBr(iso: string | null | undefined, agora = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const dia = dataIso(d)
  if (dia === dataIso(agora)) return horaBr(d)
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  if (dia === dataIso(ontem)) return `ontem · ${horaBr(d)}`
  return `${diaMes(d)} · ${horaBr(d)}`
}

/** Só a data/hora curta para a lista: hora de hoje, "ontem" ou "27/09". */
export function quandoLista(iso: string | null | undefined, agora = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const dia = dataIso(d)
  if (dia === dataIso(agora)) return horaBr(d)
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  if (dia === dataIso(ontem)) return 'ontem'
  return diaMes(d)
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
