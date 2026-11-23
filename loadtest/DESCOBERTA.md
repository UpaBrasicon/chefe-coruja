# Relatório de descoberta — teste de carga

Data: 22/11/2026. Base: leitura do código (`src/types/database.ts` e call sites do front). A leitura da **produção** via SQL foi **bloqueada pelo classificador de segurança**, então a verificação do estado da produção (contagem de `auth.users`, organizações) continua pendente e é do Ricardo (item B1 do checklist de autorizações).

## 1. Tela → RPC (ancorado no código, "o código manda")

RPCs conferidas com assinatura real em `src/types/database.ts`:

| Papel | RPC (args reais) | Tipo |
|---|---|---|
| Plantonista | `meu_plantao_agora()` · `minhas_notificacoes(p_unidade)` · `situacao_leitos(p_unidade)` · `painel_observacao(p_unidade)` · `tendencia_acuidade(p_paciente)` · `alergias_paciente(p_paciente,p_limite?)` · `prescricao_vigente(p_paciente,p_em?)` · `escala_da_unidade(p_de,p_ate,p_unidade)` · `contatos_chat()` | leitura |
| Plantonista | `prescrever(p_paciente,p_item)` · `enviar_mensagem(p_conversa_id,p_corpo)` | escrita |
| Enfermagem | `enfermagem_leitos(p_unidade)` · `enfermagem_pacientes_do_setor(p_setor)` · `fila_checagem()` · `prescricao_vigente(...)` | leitura |
| Gestor | `painel_organizacao(p_dias)` · `ocupacao_setores(p_unidade)` · `situacao_leitos(p_unidade)` · `escala_mes_gestor(p_ano,p_mes,p_unidade)` · `presencas_do_dia_gestor(p_unidade)` | leitura |
| Recepção | `fila_da_porta(p_setor)` · `buscar_pacientes(p_termo,p_unidade)` | leitura |
| Recepção | `registrar_ficha(p_setor,p_queixa,p_dados?,p_prioridades?,p_outra_pessoa?)` | escrita |
| Pico | `registrar_checkin(p_unidade,p_lat?,p_lng?,...)` · `registrar_checkout(p_registro,p_lat?,p_lng?)` | escrita |
| Catálogo | `buscar_medicamento(p_unidade,p_termo)` | leitura |

## 2. Divergências vs. o prompt (corrigidas na suíte)

| Prompt | Realidade | O que fiz |
|---|---|---|
| `painel_gestor(p_unidade)` | existe (conferido em 23/11/2026) | o cenário usa `painel_gestor`; `painel_organizacao` só devolve linhas para admin |
| `panorama_gestor`, `mapa_leitos_gestor` | **não existem** | cobertos por `painel_organizacao` + `ocupacao_setores` + `situacao_leitos` |
| `acuidade_dos_pacientes(p_pacientes[])` | **não existe** (em lote) | `tendencia_acuidade(p_paciente)`, por paciente |
| `alergias_dos_pacientes(p_pacientes[])` | **não existe** (em lote) | `alergias_paciente(p_paciente)`, por paciente |
| `turno_atual` | não achei | `meu_plantao_agora()` cobre |
| Canal realtime "do chat_mensagens" | front usa `channel('chat-global')` | topic `realtime:chat-global` no scaffold |

## 3. Pendências (TODO) antes de rodar de verdade

1. **Estado da produção (B1):** bloqueado para mim — Ricardo confirma no dashboard que só há dados de teste.
2. **`criar_massa.mjs`: escrito em 23/11/2026, ainda não executado.** Cria organização, unidade UPA com coordenadas, 4 setores, 40 leitos, vínculos, escala de ontem a amanhã com check-in dos plantões já começados, 80 pacientes, 30 internações em observação e 3 conversas. Cada pessoa fica num setor fixo, e os cenários sorteiam só pacientes desse setor, porque as RPCs do plantonista e da enfermagem recusam os outros. Para com erro se a marca `ambiente_teste` estiver desligada (só a homologação a tem).
3. **Escritas: conferido em 23/11/2026.** `registrar_prescricao_itens` é legado e só a service_role executa. A tela usa `prescrever(p_paciente, p_item)`, e o cenário manda um item de cuidado. A recepção usa `registrar_ficha` (paciente e episódio), não `salvar_cadastro_paciente`, e a chave `sem_documento` não existia. A busca de medicamento é a RPC `buscar_medicamento`, porque a tabela não tem coluna `nome`. Prescrição, paciente e episódio são só inserção: toda escrita de carga fica para sempre.
4. **Realtime: conferido em 23/11/2026.** O supabase-js 2.106.2 usa vsn 2.0.0 com mensagens em array. O join copia a config do `channel('chat-global')` de `src/hooks/useChat.ts`.
5. **`limpar_massa.mjs`: refeito em 23/11/2026.** Apaga só chat, notificações, presença, escala e vínculos. Unidade, setores, leitos e organização ficam com `ativo=false`, e os usuários `carga-*` ficam banidos, porque as tabelas clínicas e a auditoria apontam para eles sem ON DELETE.
6. **2FA: conferido em 23/11/2026, não é achado.** O servidor exige o segundo fator. O portão `portao_requisicao` (`pgrst.db_pre_request`, migration `20270414000058`) recusa com 403 "SEGUNDO_FATOR" toda RPC e toda escrita de sessão sem 2FA. As policies RESTRICTIVE `<tabela>_segundo_fator` (66 tabelas) devolvem vazio. Cerca de 200 RPCs chamam `private.exigir_segundo_fator()`. A chave `configuracao_plataforma.exigir_segundo_fator` está **ligada na produção** e **desligada na homologação**. Com ela desligada, o login só por senha do `pre_login.mjs` funciona, mas a carga fica otimista, porque `segundo_fator_ok()` não faz as consultas que faz na produção. Ligar a chave na homologação para a carga é decisão do RT; nesse caso, o `pre_login` confirma cada sessão por dispositivo confiável (`verificar_dispositivo_2fa`).
7. **Limites de taxa do Auth / CAPTCHA / plano / compute (👤):** dashboard, do Ricardo.

## 4. Ambiente da geração de carga

Decisão do RT em 23/11/2026: o k6 roda no **VPS**, pelo Docker (`infra/teste-carga.md`). A sessão na nuvem não alcança o Supabase da homologação nem baixa o k6.
