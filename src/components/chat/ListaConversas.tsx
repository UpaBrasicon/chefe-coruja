'use client'

import { Loader2, MessageSquareText, ShieldCheck, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { ContatoChat, ConversaListada } from '@/hooks/useChat'

type Props = {
  conversas: ConversaListada[]
  contatos: ContatoChat[]
  unidadeId?: string
  onAbrirConversa: (id: string, nome: string, tipo: string) => void
  onIniciarContato: (perfilId: string, nome: string) => void
  onIniciarSuporte: () => void
}

function Avatar({ nome, foto, className }: { nome?: string | null; foto?: string | null; className?: string }) {
  if (foto) return <img src={foto} alt={nome ?? ''} className={`h-9 w-9 rounded-full object-cover ${className ?? ''}`} />
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ${className ?? ''}`}>
      <User className="size-4" />
    </span>
  )
}

export function ListaConversas({ conversas, contatos, onAbrirConversa, onIniciarContato, onIniciarSuporte }: Props) {
  // agrupa por tipo
  const diretas = (conversas ?? []).filter((c) => c.tipo === 'direta')
  const suporte = (conversas ?? []).find((c) => c.tipo === 'suporte')

  const plantaoAgora = (contatos ?? []).filter((c) => c.em_plantao && c.papel === 'plantonista')
  const gestores = (contatos ?? []).filter((c) => c.papel === 'gestor')

  // contatos que ainda não têm conversa listada
  const comConversa = new Set(diretas.map((c) => c.interlocutor_id))
  const novosPlantao = plantaoAgora.filter((c) => !comConversa.has(c.perfil_id))
  const novosGestores = gestores.filter((c) => !comConversa.has(c.perfil_id))

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {/* De plantão agora */}
      <section>
        <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquareText className="size-3" /> De plantão agora
        </h2>
        {(plantaoAgora ?? []).length === 0 && (novosPlantao ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum plantonista de plantão agora.</p>
        )}
        <div className="flex flex-col gap-1">
          {(plantaoAgora ?? []).map((c) => (
            <button
              key={c.perfil_id}
              type="button"
              onClick={() => onIniciarContato(c.perfil_id, c.nome)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
            >
              <Avatar nome={c.nome} foto={c.foto} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.nome}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {c.setor_nome ?? 'Setor'}
                  {c.em_plantao ? ' · de plantão' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Gestão */}
      <section>
        <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="size-3" /> Gestão
        </h2>
        {(gestores ?? []).length === 0 && (novosGestores ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum gestor disponível.</p>
        )}
        <div className="flex flex-col gap-1">
          {(gestores ?? []).map((c) => (
            <button
              key={c.perfil_id}
              type="button"
              onClick={() => onIniciarContato(c.perfil_id, c.nome)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
            >
              <Avatar nome={c.nome} foto={c.foto} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.nome}</span>
                <span className="block text-[11px] text-muted-foreground">Gestor da unidade</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Suporte */}
      <section>
        <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="size-3" /> Suporte
        </h2>
        {suporte ? (
          <button
            type="button"
            onClick={() => onAbrirConversa(suporte.conversa_id, 'Suporte', 'suporte')}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
          >
            <Avatar nome="Suporte" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">Suporte Chefe Coruja</span>
              <span className="block text-[11px] text-muted-foreground">
                {suporte.nao_lidas > 0 ? `${suporte.nao_lidas} não lida(s)` : suporte.ultima_mensagem ?? 'Equipe de suporte'}
              </span>
            </span>
            {suporte.nao_lidas > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {suporte.nao_lidas}
              </Badge>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onIniciarSuporte}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
          >
            <Avatar nome="Suporte" />
            <span className="text-sm font-medium">Falar com o Suporte</span>
          </button>
        )}
      </section>

      {/* Conversas diretas existentes */}
      {diretas.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversas
          </h2>
          <div className="flex flex-col gap-1">
            {diretas.map((c) => (
              <button
                key={c.conversa_id}
                type="button"
                onClick={() => onAbrirConversa(c.conversa_id, c.interlocutor_nome ?? 'Conversa', 'direta')}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
              >
                <Avatar nome={c.interlocutor_nome} foto={c.interlocutor_foto} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.interlocutor_nome ?? 'Conversa'}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {c.nao_lidas > 0 ? `${c.nao_lidas} não lida(s)` : c.ultima_mensagem ?? 'Sem mensagens'}
                  </span>
                </span>
                {c.nao_lidas > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {c.nao_lidas}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {novosPlantao.length === 0 && novosGestores.length === 0 && diretas.length === 0 && suporte && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Nenhuma conversa iniciada ainda.
        </p>
      )}
    </div>
  )
}
