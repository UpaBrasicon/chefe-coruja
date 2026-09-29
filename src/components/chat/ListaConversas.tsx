import { LifeBuoy, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ContatoChat, ConversaListada } from '@/hooks/useChat'
import { quandoLista, rotuloPapel, subDoContato } from '@/components/chat/formato'

// Lista da gaveta de Mensagens (P/index.html, chat.naLista): uma linha por
// conversa — nome, quando, de quem se trata e a prévia — com a contagem de não
// lidas em cápsula teal. Abaixo, quem dá para chamar agora e ainda não tem
// conversa: de plantão, gestão e farmácia. Ao pé, a regra do turno limpo.

type Props = {
  conversas: ConversaListada[]
  contatos: ContatoChat[]
  /** Perfil do usuário, para não listar a si mesmo entre os de plantão. */
  meuId?: string | null
  /** Enquanto abre uma conversa nova, as linhas ficam desabilitadas. */
  ocupado?: boolean
  onAbrirConversa: (id: string, nome: string, tipo: string, sub: string) => void
  onIniciarContato: (perfilId: string, nome: string, sub: string) => void
  onIniciarSuporte: () => void
}

const NOME_SUPORTE = 'Suporte Chefe Coruja'
const SUB_SUPORTE = 'Equipe de suporte'

function Linha({
  nome,
  sub,
  quando,
  previa,
  naoLidas = 0,
  icone,
  disabled,
  onClick,
}: {
  nome: string
  sub?: string
  quando?: string
  previa?: string
  naoLidas?: number
  icone?: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-start gap-[11px] border-b border-trilha bg-transparent px-[22px] py-3.5 text-left hover:bg-campo focus-visible:bg-campo focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
    >
      {icone && <span className="mt-0.5 flex size-4 shrink-0 text-acao [&>svg]:size-4">{icone}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-corpo font-medium text-tinta">{nome}</span>
          {quando && <span className="ml-auto text-rotulo whitespace-nowrap text-tinta-sussurro">{quando}</span>}
        </span>
        {sub && <span className="truncate text-apoio text-tinta-sussurro">{sub}</span>}
        {previa && <span className="truncate text-apoio text-tinta-apoio">{previa}</span>}
      </span>
      {naoLidas > 0 && (
        <span className="mt-0.5 grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-capsula bg-acao px-[5px] text-rotulo leading-none font-semibold text-white">
          {naoLidas > 99 ? '99+' : naoLidas}
          <span className="sr-only"> não lida{naoLidas === 1 ? '' : 's'}</span>
        </span>
      )}
    </button>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="rotulo border-b border-trilha px-[22px] pt-4 pb-2 text-tinta-sussurro">{titulo}</h3>
      {children}
    </section>
  )
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="border-b border-trilha px-[22px] py-3 text-apoio text-tinta-sussurro">{children}</p>
}

export function ListaConversas({
  conversas,
  contatos,
  meuId,
  ocupado,
  onAbrirConversa,
  onIniciarContato,
  onIniciarSuporte,
}: Props) {
  const suporte = conversas.find((c) => c.tipo === 'suporte')
  const contatoPorId = new Map(contatos.map((c) => [c.perfil_id, c]))

  // contatos que ainda não têm conversa listada (o RPC devolve a existente
  // mesmo assim, mas a lista não repete quem já está em cima)
  const comConversa = new Set(conversas.map((c) => c.interlocutor_id).filter(Boolean))
  const livres = contatos.filter((c) => c.perfil_id !== meuId && !comConversa.has(c.perfil_id))
  // de plantão agora: todo escalado (plantonista, enfermagem, recepção,
  // telemedicina), cada um com o próprio papel no sub da linha
  const dePlantao = livres.filter((c) => c.em_plantao)
  const gestores = livres.filter((c) => !c.em_plantao && c.papel === 'gestor')
  const farmacia = livres.filter((c) => !c.em_plantao && c.papel === 'farmaceutico')

  function subDaConversa(c: ConversaListada) {
    if (c.tipo === 'suporte') return SUB_SUPORTE
    if (c.tipo === 'gestao') return c.unidade_nome ?? 'Gestão da unidade'
    const contato = c.interlocutor_id ? contatoPorId.get(c.interlocutor_id) : undefined
    if (contato) return subDoContato(contato)
    return rotuloPapel(c.interlocutor_papel)
  }

  function nomeDaConversa(c: ConversaListada) {
    if (c.tipo === 'suporte') return NOME_SUPORTE
    if (c.tipo === 'gestao') return 'Gestão da unidade'
    return c.interlocutor_nome ?? 'Conversa'
  }

  return (
    <div className="flex flex-col">
      {conversas.map((c) => {
        const nome = nomeDaConversa(c)
        const sub = subDaConversa(c)
        return (
          <Linha
            key={c.conversa_id}
            nome={nome}
            sub={sub}
            quando={quandoLista(c.ultima_data)}
            previa={c.ultima_mensagem ?? 'Sem mensagens'}
            naoLidas={c.nao_lidas}
            icone={c.tipo === 'gestao' ? <Users aria-hidden /> : c.tipo === 'suporte' ? <LifeBuoy aria-hidden /> : undefined}
            disabled={ocupado}
            onClick={() => onAbrirConversa(c.conversa_id, nome, c.tipo, sub)}
          />
        )
      })}

      {!suporte && (
        <Linha
          nome={NOME_SUPORTE}
          sub={SUB_SUPORTE}
          previa="Falar com o suporte"
          icone={<LifeBuoy aria-hidden />}
          disabled={ocupado}
          onClick={onIniciarSuporte}
        />
      )}

      <Secao titulo="De plantão agora">
        {dePlantao.length === 0 ? (
          <Vazio>{comConversa.size > 0 ? 'Quem está de plantão já está na lista acima.' : 'Ninguém mais de plantão agora.'}</Vazio>
        ) : (
          dePlantao.map((c) => {
            const sub = subDoContato(c)
            return (
              <Linha key={c.perfil_id} nome={c.nome} sub={sub} disabled={ocupado} onClick={() => onIniciarContato(c.perfil_id, c.nome, sub)} />
            )
          })
        )}
      </Secao>

      {gestores.length > 0 && (
        <Secao titulo="Gestão">
          {gestores.map((c) => {
            const sub = subDoContato(c)
            return (
              <Linha key={c.perfil_id} nome={c.nome} sub={sub} disabled={ocupado} onClick={() => onIniciarContato(c.perfil_id, c.nome, sub)} />
            )
          })}
        </Secao>
      )}

      {farmacia.length > 0 && (
        <Secao titulo="Farmácia">
          {farmacia.map((c) => {
            const sub = subDoContato(c)
            return (
              <Linha key={c.perfil_id} nome={c.nome} sub={sub} disabled={ocupado} onClick={() => onIniciarContato(c.perfil_id, c.nome, sub)} />
            )
          })}
        </Secao>
      )}

      <p className="px-[22px] py-4 text-apoio leading-[1.5] text-pretty text-tinta-sussurro">
        Cada plantão começa com a conversa limpa. O turno anterior fica consultável dentro de cada conversa.
      </p>
    </div>
  )
}
