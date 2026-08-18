# Arquitetura — Chat lateral em tempo real (Fase 4)

> Autor: Arquiteto de Software · Data: 2026-08-17
> Objetivo: painel de chat lateral (drawer à direita) onde o plantonista conversa
> com outros plantonistas **de plantão**, com o **gestor** da unidade e com o
> **Suporte**. Gestor vê/responde tudo da sua unidade; suporte = super_admins.

---

## PASSO 0 — Inventário e decisões

### 1. Mensageria existente (`src/pages/Mensagens.tsx` + tabela `mensagens_chat`)

O que existe hoje:

| Item | Estado |
|---|---|
| Tabela `mensagens_chat` | `unidade_id, remetente_id, destinatario_id (nullable), conteudo, lida_em, criado_por` — **chat de "corredor" da unidade** (mensagens visíveis a TODOS da unidade) |
| Rota `/mensagens` | Página standalone que lista mensagens da unidade e envia; fallback para link `wa.me` quando o gestor configurou `canal_comunicacao='whatsapp'` |
| Realtime | **Não usa** — polling a cada 15s |
| Não lidas | Não existe contador real |

**Decisão: SUBSTITUIR.** O modelo `mensagens_chat` (broadcast para todos da
unidade) não atende aos requisitos de conversa 1:1/gestão/suporte com contador
de não lidas. A nova modelagem usa `conversas` + `conversa_participantes` +
`chat_mensagens` (privadas por participação). A rota `/mensagens` passará a abrir
o **drawer** (o acesso ao WhatsApp configurado permanece disponível no drawer via
contato de gestão).

### 2. Web Push (`useWebPush.ts`) e notificações (`useNotificacoesTurno.ts`)

- `useWebPush` registra o SW e a subscription em `push_subscriptions`
  (RPC `salvar_push_subscription`). **O envio real via VAPID ainda não existe**
  (migration 00025 deixa para backend/edge function).
- `useNotificacoesTurno` gera notificações **in-app** (`notificacoes_plantonista`)
  e o banner/sino as exibe.

**Decisão:** o chat reutiliza essa infraestrutura:
- **In-app**: nova mensagem cria uma `notificacoes_plantonista` para o
  destinatário (via trigger) — aparece no sino/banner existentes.
- **Web push**: reutiliza `push_subscriptions`; o envio VAPID real será feito na
  mesma edge function futura que cobrirá as notificações (mesma via, sem função
  nova agora). O `sw.js` já exibe `{ title, body, url }`.

### 3. Quem está "de plantão agora" (escala)

- `useEscalaSetores` (documentos) lê `escala_plantoes` (legada).
- O **acesso real** e a escala gerencial usam `escala_plantao` (dedicada, 00014),
  com `private.na_escala_agora` / `setores_na_escala_agora` (relógio do servidor).

**Decisão:** a lista "De plantão agora" do chat consulta **`escala_plantao`**
(perfis com plantão ativo hoje+turno na unidade), consistente com o gate de
acesso. `useEscalaSetores` continua como está (fora de escopo).

### 4. Padrões de RLS e RPC copiados

- RLS: estilo `20260815000029` (políticas `DROP IF EXISTS` + `CREATE POLICY`
  com `private.papel_na_unidade` / `private.eh_super_admin`). **Admin não tem
  acesso ao chat** (filosofia do censo: mensagens podem conter contexto clínico).
- RPC: estilo `20260815000035` — `SECURITY DEFINER SET search_path = ...` com
  `private.registrar_auditoria` (append-only em `log_auditoria`).

---

## Modelo de dados

```
conversas (id, unidade_id NULL, tipo 'direta'|'suporte'|'gestao', criado_em)
  · unidade_id NULL = conversa de suporte (pertence à organização, não à unidade)

conversa_participantes (conversa_id, perfil_id, entrou_em, ultima_leitura_em)
  · PK (conversa_id, perfil_id); ultima_leitura_em = base do contador de não lidas

chat_mensagens (id, conversa_id, autor_id, corpo CHECK <= 4000, criado_em,
                editado_em NULL, excluida bool default false)
  · soft delete: excluida=true apaga o corpo, linha permanece para auditoria
```

## RLS (fail closed)

- SELECT/INSERT em conversas/mensagens: participante da conversa E vínculo ativo
  na unidade da conversa. Conversa de suporte: participante OU super_admin.
- `admin` NÃO lê nada do chat.
- UPDATE em `chat_mensagens`: só o autor, janela de 15 min (política), apenas
  editar corpo ou marcar excluida.
- Funções novas: SECURITY DEFINER com SET search_path.

## RPCs

- `abrir_conversa_direta(p_destinatario)` — 1:1 idempotente na unidade ativa.
- `abrir_conversa_suporte()` — conversa do usuário com o suporte.
- `marcar_lida(p_conversa)` — atualiza `ultima_leitura_em`.
- `listar_conversas()` — conversas do usuário + última msg + não lidas + interlocutor.
- `contatos_chat()` — plantonistas de plantão agora + gestores (para a lista).

## Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensagens` (e
  `conversa_participantes`).
- Front: canal por conversa aberta (`chat:<id>`, postgres_changes INSERT) →
  `setQueryData` sem refetch; canal global leve para contadores.

---

## Checklist de aceite (teste manual)

1. **Dois usuários em conversa 1:1**: A envia → B recebe em tempo real sem
   refresh (realtime).
2. **Não lidas**: B vê contador no badge; zera ao abrir a thread
   (`marcar_lida`).
3. **Isolamento**: plantonista A NÃO lê conversa de B com C (testar via SQL:
   SELECT com `set role` de cada papel retorna vazio).
4. **Admin**: não lê nada do chat (todas as tabelas retornam vazio).
5. **RLS de INSERT**: inserir em `chat_mensagens` de conversa da qual não
   participa → bloqueado.
6. **Soft delete**: autor apaga dentro de 15 min → corpo vira "(mensagem excluída)",
   linha permanece.
7. **Suporte**: plantonista abre conversa de suporte; super_admin vê todas.

## Verificações executadas (2026-08-17)

| # | Teste | Resultado |
|---|---|---|
| 1 | `abrir_conversa_direta` (gestor↔plantonista) + `enviar_mensagem` nos dois sentidos | ✅ ok |
| 2 | `listar_conversas` retorna conversa com `nao_lidas=1`; `marcar_lida` zera para 0 | ✅ ok |
| 3 | `contatos_chat`: plantonista de plantão (escala dedicada) + gestor listados | ✅ ok |
| 4 | `abrir_conversa_suporte` + envio | ✅ ok |
| 5 | RLS admin: `conversas` e `chat_mensagens` retornam **count=0** (fail closed) | ✅ ok |
| 6 | RLS INSERT de admin (não participante) → bloqueado | ✅ ok |
| 7 | **Realtime**: cliente B assina canal `chat:<id>`; A envia 2 msgs → B recebe as 2 via postgres_changes, sem refresh | ✅ ok |
| 8 | Publicação `supabase_realtime` contém `chat_mensagens` e `conversa_participantes` | ✅ ok |
| 9 | `npm run typecheck` / `npm run lint` (0 erros) / `npm run build` (exit 0) | ✅ ok |

> Nota: o web push VAPID real continua para a edge function futura (mesma via de
> `notificacoes_turno`/`push_subscriptions`). A notificação **in-app** de nova
> mensagem já é criada por `enviar_mensagem` em `notificacoes_plantonista`
> (aparece no sino/banner).

## Fora de escopo (não feito)

Anexos/imagens, grupos por setor, indicador de digitação, busca em mensagens,
exclusão permanente.
