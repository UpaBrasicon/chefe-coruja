# Relatório de descoberta — teste de carga

Data: 22/11/2026. Base: leitura do código (`src/types/database.ts` e call sites do front). A leitura da **produção** via SQL foi **bloqueada pelo classificador de segurança**, então a verificação do estado da produção (contagem de `auth.users`, organizações) continua pendente e é do Ricardo (item B1 do checklist de autorizações).

## 1. Tela → RPC (ancorado no código, "o código manda")

RPCs conferidas com assinatura real em `src/types/database.ts`:

| Papel | RPC (args reais) | Tipo |
|---|---|---|
| Plantonista | `meu_plantao_agora()` · `minhas_notificacoes(p_unidade)` · `situacao_leitos(p_unidade)` · `painel_observacao(p_unidade)` · `tendencia_acuidade(p_paciente)` · `alergias_paciente(p_paciente,p_limite?)` · `prescricao_vigente(p_paciente,p_em?)` · `escala_da_unidade(p_de,p_ate,p_unidade)` · `contatos_chat()` | leitura |
| Plantonista | `registrar_prescricao_itens(p_paciente,p_observacoes?,p_itens?)` · `enviar_mensagem(p_conversa_id,p_corpo)` | escrita |
| Enfermagem | `enfermagem_leitos(p_unidade)` · `enfermagem_pacientes_do_setor(p_setor)` · `fila_checagem()` · `prescricao_vigente(...)` | leitura |
| Gestor | `painel_organizacao(p_dias)` · `ocupacao_setores(p_unidade)` · `situacao_leitos(p_unidade)` · `escala_mes_gestor(p_ano,p_mes,p_unidade)` · `presencas_do_dia_gestor(p_unidade)` | leitura |
| Recepção | `fila_da_porta(p_setor)` · `buscar_pacientes(p_termo,p_unidade)` | leitura |
| Recepção | `salvar_cadastro_paciente(p_dados,p_setor,p_outra_pessoa)` | escrita |
| Pico | `registrar_checkin(p_unidade,p_lat?,p_lng?,...)` · `registrar_checkout(p_registro,p_lat?,p_lng?)` | escrita |
| Catálogo | `GET /rest/v1/medicamento?select=...&nome=ilike.*termo*` | leitura |

## 2. Divergências vs. o prompt (corrigidas na suíte)

| Prompt | Realidade | O que fiz |
|---|---|---|
| `painel_gestor(p_unidade)` | **não existe** | usei `painel_organizacao(p_dias)` (escopo pelo JWT, sem p_unidade) |
| `panorama_gestor`, `mapa_leitos_gestor` | **não existem** | cobertos por `painel_organizacao` + `ocupacao_setores` + `situacao_leitos` |
| `acuidade_dos_pacientes(p_pacientes[])` | **não existe** (em lote) | `tendencia_acuidade(p_paciente)`, por paciente |
| `alergias_dos_pacientes(p_pacientes[])` | **não existe** (em lote) | `alergias_paciente(p_paciente)`, por paciente |
| `turno_atual` | não achei | `meu_plantao_agora()` cobre |
| Canal realtime "do chat_mensagens" | front usa `channel('chat-global')` | topic `realtime:chat-global` no scaffold |

## 3. Pendências (TODO) antes de rodar de verdade

1. **Estado da produção (B1):** bloqueado para mim — Ricardo confirma no dashboard que só há dados de teste.
2. **`criar_massa.mjs` (domínio):** usuários prontos; unidade/setores/leitos/pacientes/escala/chat dependem do schema (~230 tabelas) e dos RPCs de criação do app, ainda não lidos. Cada passo está marcado com a tabela/RPC-alvo.
3. **Payload `p_itens` da prescrição:** confirmar o jsonb igual ao do front (`PrescricaoEstruturada.tsx`) antes de ligar `-e ESCRITA=1` na carga.
4. **Join do Realtime:** capturar do front (devtools → WS) o `phx_join` real do supabase-js para `chat-global` e colar em `testes/realtime.js`.
5. **`limpar_massa.mjs`:** completar `APAGAVEIS[]` a partir do levantamento P8 (gatilhos de imutabilidade — leitura de schema). As imutáveis ficam.
6. **2FA (achado a registrar):** verificar se as RPCs aceitam o JWT de senha **sem a 2FA concluída**. Se aceitarem, é achado de segurança da Fase 0 (2FA só no front). Nenhuma policy de RLS usa `aal` (indício de que sim).
7. **Limites de taxa do Auth / CAPTCHA / plano / compute (👤):** dashboard, do Ricardo.

## 4. Ambiente da geração de carga

O k6 **não roda no meu ambiente** (rede restrita a registries+GitHub; IP de nuvem). Roda na máquina do Ricardo ou no VPS (P9).
