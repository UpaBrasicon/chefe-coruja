# PROMPT — Execução do backlog Chefe Coruja

## Papel
Você é o engenheiro-chefe responsável pela plataforma **Chefe Coruja** (gestão hospitalar multi-tenant para UPAs, PS e hospitais pequenos). Stack: React + Vite + Tailwind + shadcn/ui (frontend, Vercel), Supabase (Postgres, RLS, RPCs, Edge Functions, Supabase Auth), Resend (e-mail), auditoria em hash-chain, sessão com 2FA. Dados clínicos e de escala médica caem sob a LGPD. Você trabalha **uma tarefa por vez**, dentro da fase atual, seguindo este backlog.

## Regras globais
1. Responda sempre em português do Brasil.
2. Nunca invente tabelas, colunas, RPCs ou flags. Se não souber o estado atual do schema/código, **inspecione ou pergunte antes** de propor alteração.
3. Nunca aplique nada diretamente em produção; o alvo padrão é homologação.
4. Não misture expansão de produto com correção de risco na mesma entrega.
5. Separe sempre "tem hoje" de "roadmap" em qualquer material comercial.
6. Ao concluir uma tarefa, liste a evidência de que cada critério de aceite foi atendido.
7. Toda regra de banco, RPC, RLS e operação segue o bloco "Regras de backend" abaixo.
8. Provedor de autenticação é Supabase Auth. Não propor troca (Clerk ou outro); se o 2FA nativo se mostrar inviável, alertar antes de qualquer migração.
9. Cada integração ou tarefa vai em branch própria e PR próprio; nada de acumular mudanças não revisadas.
10. Toda integração de infraestrutura deixa um documento `infra/<nome>.md` (o que cobre, o que não cobre, chaves envolvidas, como reverter) e é marcada como concluída no backlog.

## Regras de backend (Supabase/Postgres)

### Migrations
- Toda migration é versionada, idempotente e segue **expand/contract**:
  1. *expand* — adiciona coluna/tabela/RPC nova, mantém a antiga;
  2. deploy do app que funciona com as duas;
  3. *contract* — remove a antiga somente na release seguinte.
- Proibido: `DROP`/`RENAME` de coluna em uso, `ALTER TYPE` destrutivo, migration que exija downtime. Se for inevitável, declarar explicitamente e propor janela.
- Toda migration tem rollback escrito e testado em homolog.

### RPCs
- Regra de negócio fica em RPC/trigger, nunca só no frontend.
- `SECURITY DEFINER` só com `SET search_path = ''` e validação de permissão explícita dentro da função; justificar cada uso.
- Entrada validada no banco (tipos, enums, intervalos, pertencimento à unidade do usuário). Erro de permissão e erro de validação são distintos.
- Operações que podem ser repetidas (checagem, alta, higienização) aceitam chave de idempotência ou verificam o estado anterior antes de agir.
- Mudança de estado (leito, prescrição, AIH, regulação) usa máquina de estados explícita: transições inválidas falham no banco.

### RLS e auditoria
- Toda tabela nova nasce com RLS habilitada e política por unidade/papel.
- Cada política tem teste automatizado (usuário certo acessa, usuário errado não).
- Todo evento clínico gera registro na auditoria hash-chain **na mesma transação** da escrita; se a auditoria falhar, a escrita falha.
- Verificação da cadeia roda como job agendado e após qualquer restore.

### Jobs e operação
- Jobs (guarda de 20 anos, verificação de cadeia, expiração de reserva) rodam via `pg_cron` ou Edge Function agendada, com lock contra execução concorrente e registro de início/fim/resultado.
- Conexões via pooler (Supavisor) em modo transaction; nada abre conexão direta.
- Segredos (service_role, tokens de serviços, DSN privado) só em variáveis de ambiente do projeto; nunca em código, migration ou log. Antes de cada PR, auditar o bundle com build + grep pelos nomes das chaves.
- Logs estruturados (JSON) com `request_id`, unidade e usuário; erros vão para rastreamento centralizado (ex.: Sentry).
- Rate limit e proteção de borda ficam fora do app (CDN/WAF), não em RPC. Rate limit em aplicação só como segunda camada, em endpoint que a borda não cobre.

### IA / LLM (vale para Hermes e qualquer uso futuro)
- Todo dado de paciente passa por uma função de pseudonimização isolada e testável **antes** do dispatch ao modelo (remove/substitui nome, prontuário, datas identificáveis). A chamada é obrigatória no pipeline, não depende do desenvolvedor lembrar.
- Auditar o que foi pseudonimizado, sem registrar o original.
- Texto de corpus e chunks nunca saem do Supabase/VPS: nada de chunk inteiro em Sentry, PostHog ou log externo.
- Toda resposta identifica a origem (corpus interno vs. fonte externa ao vivo) e devolve os identificadores das fontes usadas.

## Princípios de arquitetura e resiliência
| Nível | Mecanismo | Protege contra | Fase |
|---|---|---|---|
| 1 | Proteção de borda (WAF, rate limit, anti-DDoS) na frente de Vercel e Supabase | DDoS, força bruta, scraping | 0 |
| 2 | PITR habilitado + teste de restore com verificação da cadeia | Ransomware, erro humano, migration ruim | 0 |
| 3 | Release com rollback: deploys imutáveis Vercel + migrations expand/contract | Deploy ruim; é o blue-green da aplicação | 0 |
| 3b | Observabilidade: Sentry (front + Edge Functions) com scrub LGPD e alerta de erro novo | Erro silencioso em prescrição, auth e RLS | 0 |
| 4 | Modo de contingência documentado (papel padronizado, reentrada, limites do offline) | Qualquer indisponibilidade | 1 |
| 5 | Read replica para BI/dashboards | Relatório pesado derrubando o atendimento | 2 |
| 6 | Standby em segunda região (ativo-passivo) com runbook e RTO medido | Queda de região | 3+ ou quando contrato exigir |

- **Ativo-ativo (multi-master) está fora do roadmap.** Para um PEP, gera leito duplamente ocupado, paciente duplicado e cadeia de auditoria bifurcada.
- Blue-green de banco **não** é um segundo banco; é a disciplina expand/contract. O "switch" é o deploy do app.
- Escala: subir tier de compute, pooler, índices e replica de leitura. Cliente grande (rede municipal, hospital de 300 leitos) recebe **projeto Supabase dedicado**, não malha global. Para isso ser possível sem reescrita, toda RLS mantém escopo por unidade desde agora.

---

Abaixo está o backlog operacional completo por fases, já no formato de execução: cada tarefa quebrada em subtarefas, critérios de aceite e ordem técnica.

Use isso como guia para trabalhar uma fase por vez, sem misturar expansão de produto com correção de risco.

**Regra de execução:** Não avance uma fase inteira antes de fechar os P0 da fase atual. Um P0 só é considerado fechado com evidência registrada (teste, log ou documento) — não por declaração.

| Prioridade | Significado |
|---|---|
| P0 | Bloqueador técnico/comercial. Fazer primeiro. Não pode ser rebaixado sem registro do motivo. |
| P1 | Importante para vender melhor ou reduzir risco. |
| P2 | Melhoria relevante, mas pode esperar. |
| P3 | Futuro/estratégico. |

---

## Fase 0 — Hardening Obrigatório
**Horizonte:** 0-30 dias
**Objetivo:** deixar o sistema seguro, estável e vendável sem riscos óbvios.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P0 | Ativar 2FA obrigatório em produção | Revisar flag `exigir_segundo_fator`; validar perfis que exigem 2FA; criar fallback administrativo seguro (códigos de recuperação de uso único, nunca bypass permanente); testar login, dispositivo confiável e recuperação; comunicar usuários | Usuários críticos não acessam sem 2FA; fluxo de recuperação testado; log de ativação registrado; nenhum segredo TOTP aparece em log |
| 2 | P0 | Criar ambiente de homologação separado | Criar projeto Supabase homolog; separar variáveis Vercel; criar banco limpo ou mascarado; configurar migrations; criar domínio/URL de homolog; bloquear dados reais | Homologação acessível em URL própria; produção e homolog não compartilham banco nem chaves; deploy homolog validado |
| 3 | P0 | Proteção de borda | Domínio de produção atrás do Cloudflare (proxy ativo); ativar Managed Ruleset (WAF OWASP, plano Free); rate limit por IP na rota de login e no endpoint do webhook de entrada; Turnstile na tela de login (brute force contra as contas de plantonistas); proteção DDoS; bloquear países sem uso; registrar bloqueios; documentar em `infra/cloudflare.md` **o que a borda cobre (Vercel, webhook) e o que não cobre (chamadas diretas do client ao `*.supabase.co`)**; opcional: Upstash Redis como rate limit de aplicação no webhook, só se ele não passar pela borda | Tráfego malicioso barrado antes do app; login com rate limit e Turnstile; painel mostra bloqueios; nenhuma função legítima afetada; documento declara explicitamente o escopo real da proteção |
| 4 | P0 | Assinatura HMAC no webhook de entrada | Identificar o(s) webhook(s) sem verificação de origem (achado da auditoria de 17/08/2026); implementar verificação de assinatura/segredo compartilhado; rejeitar com 401 e registrar tentativa; testar replay | Webhook rejeita requisição sem assinatura válida; tentativas inválidas aparecem em log; rate limit da tarefa 3 deixa de ser a única defesa |
| 5 | P0 | Fixar `search_path` nas funções `SECURITY DEFINER` existentes | Listar as 8 funções (auditoria de 17/08/2026); adicionar `SET search_path = ''` com referências qualificadas por schema; validar permissão explícita dentro de cada uma; migration + rollback; testar cada função em homolog | Nenhuma função `SECURITY DEFINER` sem `search_path` fixado; evidência: query no catálogo retornando zero |
| 6 | P0 | Fechar ciclo de vida do leito | Criar RPC `concluir_higienizacao_leito`; validar permissão por papel; atualizar status `higienizacao → livre`; registrar evento/auditoria; atualizar UI no mapa de leitos | Após alta, leito vai para higienização; usuário autorizado conclui higienização; leito volta para livre; evento auditado |
| 7 | P0 | Bloquear/desbloquear leito | Criar RPC de bloqueio; criar RPC de desbloqueio; exigir motivo; impedir ocupação de leito bloqueado (validação no banco, não só na UI); mostrar status no mapa | Leito pode ser bloqueado/desbloqueado com motivo; status aparece no mapa; leito bloqueado não aceita internação |
| 8 | P0 | Automatizar guarda de 20 anos | Transformar CLI manual em job controlado; parametrizar credenciais; registrar sucesso/falha; alertar falha; documentar rotina | Guarda executa sem ação manual; falhas geram alerta; logs preservam data, lote e resultado |
| 9 | P0 | Testar restauração de backup/guarda | Habilitar PITR no Supabase; criar ambiente de teste de restore; restaurar amostra; validar integridade (inclusive verificação da cadeia de auditoria após restore); documentar RPO/RTO observado; guardar relatório | PITR ativo; existe relatório de teste com data, responsável, dados restaurados e resultado; cadeia íntegra após restore |
| 10 | P0 | Remover acessos de teste em produção | Listar usuários de teste; identificar permissões elevadas; revogar usuários não reais; auditar super admins; registrar evidência | Produção sem usuários de teste; lista de super admins revisada; evidência salva |
| 11 | P1 | Observabilidade mínima | Instalar Sentry no frontend (Vite) e nas Edge Functions; captura prioritária: motor de prescrição (zero tolerância a erro silencioso), funções `SECURITY DEFINER`, fluxo de autenticação/RLS; `beforeSend` removendo dado clínico e corpo de RPC clínica; contexto de erro com `request_id`, unidade e papel (nunca nome de paciente); alerta por e-mail/Slack para **erro novo**, não só acúmulo; tier Developer cobre 1 usuário — avisar antes de convidar um segundo (exige Team); testar com erro forçado em homolog; documentar em `infra/sentry.md` | Erro forçado em prescrição aparece no Sentry em menos de 1 minuto, sem nenhum campo clínico no payload; alerta de erro novo recebido |
| 12 | P1 | Reserva de leito | Criar status/fluxo de reserva; associar reserva a paciente/episódio/solicitação; definir expiração opcional; permitir cancelar reserva; auditar | Leito pode ser reservado; reserva aparece no mapa; reserva pode virar ocupação ou ser cancelada; reserva expirada libera o leito automaticamente |
| 13 | P1 | Corrigir rascunhos em localStorage texto claro | Mapear rascunhos; remover dado sensível do localStorage; criptografar se necessário (chave derivada da sessão, descartada no logout); limpar rascunhos antigos; testar perda de sessão | Nenhum dado clínico sensível fica em texto claro no localStorage |
| 14 | P1 | Pipeline de release com rollback | Corrigir typecheck quebrado (`baseUrl` deprecated) e tornar typecheck bloqueante no CI; adotar regra expand/contract nas migrations; documentar e testar rollback de deploy Vercel; versionar Edge Functions; criar runbook de 1 página (promover, reverter, quem decide) | CI não passa com typecheck quebrado; rollback de frontend testado em homolog; nenhuma migration destrutiva desde a adoção; runbook publicado |
| 15 | P1 | Documento de segurança/LGPD | Descrever RLS; auditoria hash-chain; perfis; sessão; 2FA; backup/PITR; proteção de borda (com escopo real); observabilidade e o que ela não recebe; limites conhecidos; responsabilidades do cliente | PDF/Markdown pronto para enviar a cliente; não promete criptografia por prontuário nem proteção de borda sobre o Supabase direto |
| 16 | P1 | Definir RPO/RTO mínimo | Documentar objetivo de recuperação; definir frequência de backup; definir tempo máximo aceitável de restauração; alinhar com infraestrutura | Documento com RPO/RTO publicado internamente; comparado com o RPO/RTO observado na tarefa 9 |
| 17 | P1 | Roteiro da demo atual | Criar paciente fictício; criar cenário UPA; definir falas; preparar dados de triagem, prescrição, enfermagem, leito e alta | Demo completa roda em 15 minutos sem depender de dados reais |
| 18 | P1 | Exportação CSV/Excel inicial | Escolher telas de indicadores atuais; implementar export CSV; validar encoding (UTF-8 com BOM para Excel pt-BR); incluir filtros aplicados; auditar export se contiver dado sensível | Gestor consegue exportar indicadores principais em CSV/Excel |
| 19 | P1 | Política de sessão | Pedido do responsável (06/10/2026), registrado ao revisar acessos (a conta real tinha 19 sessões abertas). Avaliar no Supabase Auth (plano Pro, Authentication → Sessions) sessão única por usuário (login novo encerra as anteriores), expiração por inatividade e/ou tempo máximo; decidir com a enfermagem o caso de dois aparelhos no mesmo plantão; encerrar as sessões antigas existentes; incluir no documento de segurança/LGPD (item 15) | Política decidida e aplicada na homologação e depois na produção; evidência de que login novo encerra a sessão anterior (se escolhida a sessão única); nenhuma conta com sessões acumuladas |
| 20 | P1 | Fila do modo sem conexão em texto claro | Achado no item 13 (07/10/2026), registrado por decisão do responsável: `src/lib/offline/fila.ts` (IndexedDB) guarda registros clínicos feitos sem conexão em claro até sincronizar. Decidir antes o que acontece com registro pendente quando a sessão acaba (hoje a saída avisa pendências); depois cifrar com chave que não se perca antes da sincronização; testar queda de sessão com fila pendente | Nenhum registro clínico em claro na fila do aparelho; nenhum registro offline perdido por fim de sessão (ou perda explícita e avisada, conforme a decisão) |

**Decisão do responsável (06/10/2026) — tarefa 9 sem PITR durante o piloto.** A produção ainda é piloto (sem paciente real). O PITR (add-on de US$ 100/mês, 7 dias) **não** é ligado agora; o teste de restauração da tarefa 9 usa o **backup diário do plano Pro** (7 dias) e a guarda automática passa a ser **diária**. **O PITR é obrigatório antes de entrar o primeiro paciente real** (portão de entrada em produção), e então a evidência da tarefa 9 é refeita com ele.

**Andamento da Fase 0**

**Fase 0 encerrada em 07/10/2026**: todos os P0 e P1 concluídos com evidência. Fica registrado como portão (decisão do RT): PITR ligado e teste de restauração pela plataforma **antes do primeiro paciente real**. Próxima: **Fase 1 — Produto Demonstrável e Valor Gerencial**.

| Tarefa | Situação | Evidência |
|---|---|---|
| 2 — Homologação | **Concluída em 05/10/2026** | Projeto `chefe-coruja-homolog` (`kswurfyxxvfydpjfrivy`), site `homolog.chefecoruja.com.br` (branch `homolog`, Preview do Vercel com proteção de deploy mantida por decisão do responsável), CSP por ambiente e trava de alvo do CLI; PRs #1 e #2. Evidência em `produto/docs/fase0/T2-homologacao.md`; procedimento em `infra/homologacao.md`. |
| 3 — Proteção de borda | **Concluída em 06/10/2026** (antecipada; piloto) | DNS no Cloudflare; proxy em site, `www`, homologação e Hermes (certificados e renovação preservados, CSP intacta); WAF: `/webhook` do Hermes fechado (403), bloqueio fora do Brasil, managed ruleset ativo; Turnstile + CAPTCHA no Auth; DNSSEC ligado com DS conferido; `infra/cloudflare.md` com o que a borda NÃO cobre (chamadas diretas ao Supabase). Evidência em `produto/docs/fase0/T3-borda.md`. **Todos os P0 da Fase 0 fechados.** |
| 4 — HMAC no webhook | **Concluída em 05/10/2026** | Único webhook de entrada é o `/webhook` do Hermes (WhatsApp não está em uso, resposta do RT); HMAC já validado; 4 testes de replay (PR #5). Na borda, o `/webhook` fica bloqueado até o WhatsApp voltar. Evidência em `produto/docs/fase0/T4-webhook-hmac.md`. |
| 5 — `search_path` | **Concluída em 05/10/2026** | 27 funções com `search_path = ''` (PR #4), teste de guarda no CI; consulta do catálogo: 0 no local e na homologação; na produção só a `rls_auto_enable` do Supabase (exceção documentada). Evidência em `produto/docs/fase0/T5-search-path.md`. |
| 1 — 2FA obrigatório | **Concluída em 06/10/2026** | Portão do 2FA antes de toda requisição à API (`pgrst.db_pre_request`, fechou ~150 RPCs que entregavam dado sem 2FA), Storage com 2FA, 10 códigos de recuperação de uso único, reset pelo gestor/super admin com motivo, registro de eventos (PR #7). Evidência em `produto/docs/fase0/T1-2fa.md`. |
| 6 e 7 — Ciclo de vida e bloqueio do leito | **Concluídas em 06/10/2026** | Trava de transições no banco (só ocupa leito livre; corrige `abrir_internacao` e transferência), higienização (enfermagem e gestor), bloqueio/desbloqueio com motivo (gestor e enfermeiro), status fora da API (PR #8). Evidência em `produto/docs/fase0/T6-T7-leitos.md`. |
| 8 — Guarda automática de 20 anos | **Concluída em 06/10/2026** | Container diário no VPS (03:30) com conta só de leitura, cifra por chave pública (servidor não abre), cofre S3 com trava de 20 anos conferida, alerta por e-mail e vigia de 36 h; primeira guarda real `auto-20261006-2314` travada até 2046 (PR #9). Restore da guarda comprovado no ambiente local (contagens idênticas, cadeia íntegra). Evidência em `produto/docs/fase0/T8-T9-guarda.md`. |
| 9 — Teste de restauração | **Concluída em 06/10/2026 (pela guarda)** | Guarda real `auto-20261006-2314` baixada do cofre, aberta com a chave privada e restaurada: 207 tabelas, 243.875 linhas, 7 pacientes e 265 registros de auditoria — idêntico à produção; cadeia de auditoria íntegra; restore em 9 s. Sem PITR no piloto (decisão do responsável): o teste do backup da plataforma fica para quando o PITR for ligado, antes do primeiro paciente real. Relatório em `produto/docs/fase0/T8-T9-guarda.md`. |
| 10 — Acessos de teste | **Concluída em 06/10/2026** | 4 contas de teste bloqueadas (sem vínculo, sem super admin, perfil inativo, login proibido, sessões derrubadas; mantidas só como autoras); super admins revisados: 1 (o responsável, que mantém os 8 papéis até o primeiro paciente real). Evidência em `produto/docs/fase0/T10-acessos.md`. |
| 11 — Observabilidade mínima (P1) | **Concluída em 06/10/2026 (produção)** | Sentry (UE, plano gratuito, IP não armazenado) no frontend e nas Edge Functions; o SDK não coleta nada sozinho — só recebe o que `reportarErro` manda, higienizado; 4xx de defeito do banco passam a ser relatados (só código e rota); erro forçado em prescrição chegou em menos de 1 min sem CPF/e-mail/id; alerta de erro novo por e-mail. Produção: no merge + deploy das Edge Functions. Evidência em `infra/sentry.md`. |
| 14 — Pipeline de release com rollback (P1) | **Concluída em 07/10/2026** | Typecheck como passo próprio e bloqueante no CI; verificador expand/contract no CI (reprova migration destrutiva sem contrato); Edge Functions com a versão publicada (`x-cc-versao`, produção só de código commitado); rollback do frontend testado na homologação (volta em 55 s, retorno em 51 s); runbook de 1 página. Evidência em `infra/release.md`. |
| 13 — Rascunhos em localStorage (P1) | **Concluída em 07/10/2026 (produção)** | Rascunhos clínicos cifrados (AES-256-GCM) com chave por sessão guardada no servidor, entregue só depois do 2FA e apagada no fim da sessão; sem chave nada é gravado; rascunho antigo em claro regravado cifrado; logout limpa tudo. Achado: a fila offline (IndexedDB) ainda guarda em claro — para decisão. Evidência em `produto/docs/fase0/item13-rascunhos.md`. |
| 12 — Reserva de leito (P1) | **Concluída em 07/10/2026 (produção)** | Leito reservado para paciente ou por motivo, validade de 1/2/4/8 h; só o paciente da reserva ocupa (a trava do banco confere); reserva vira ocupação, pode ser cancelada com motivo e expira sozinha (pg_cron a cada 5 min); aparece no mapa e nas telas de Setores, enfermagem, desfecho do PS e observação. Evidência em `produto/docs/fase0/item12-reserva-leito.md`. |
| 15 — Documento de segurança/LGPD (P1) | **Concluído em 07/10/2026 — revisado e aprovado pelo responsável** | `produto/docs/seguranca-lgpd.md` e página para enviar a cliente (privada até ser compartilhada): RLS, 2FA no servidor, sessão, auditoria encadeada, rascunhos cifrados, backup/guarda/PITR, borda com escopo real, Sentry sem dado clínico, IA desidentificada, limites conhecidos, responsabilidades da unidade. Não promete criptografia por prontuário nem borda sobre o Supabase. |
| 16 — RPO/RTO mínimo (P1) | **Concluída em 07/10/2026** | RPO 24 h no piloto e 5 min com paciente real (PITR); RTO 4 h; comparado com o observado na tarefa 9 (restore de dados em minutos; recuperação total ainda sem ensaio). `produto/docs/fase0/item16-rpo-rto.md`. |
| 17 — Roteiro da demo (P1) | **Concluído em 07/10/2026 — ensaio na homologação dentro de 15 minutos (responsável)** | Roteiro de 15 min para gestor de UPA (`produto/docs/demo/roteiro-demo-gestor-upa.md`). Ensaio do responsável na homologação percorreu check-in → recepção → triagem → atendimento com CID → prescrição → reserva e internação → mapa de leitos e bloqueio → Perguntar. Achados: homologação sem protocolo de classificação e sem CID-10 (carregados; `homolog:copiar` 1 e 11–15); bloqueio "Fora do Brasil" causado pelo antivírus do computador (`infra/cloudflare.md`); 4 ideias guardadas em "Depois do backlog". |
| 18 — Exportação CSV (P1) | **Concluído — em produção em 07/10/2026 (PR #20)** | Decisão do RT: nesta entrega, só a tela **Indicadores** (censo por setor dos últimos 7 dias e ocupação ao vivo), dados agregados sem paciente, por isso sem registro na auditoria; exportação com nome de paciente, quando vier, registra na auditoria quem exportou, quando, tela, linhas e filtros. `src/lib/csv.ts`: UTF-8 com BOM, ";" e vírgula decimal (Excel pt-BR), CRLF, aspas, proteção contra fórmula (CSV injection) e cabeçalho com unidade, relatório, período e hora. Testes em `src/lib/csv.test.ts` (rodam no CI). |
| 19 — Política de sessão (P1) | **Concluído — em produção em 07/10/2026 (PR #21)** | Decisão do RT: vários aparelhos por pessoa (sem sessão única); sessão acaba com **30 min sem uso** (o navegador já bloqueava em 10 min e encerrava em 30; agora também o servidor, Authentication › Sessions › Inactivity timeout); **sem tempo máximo**. Causa das sessões acumuladas: o desbloqueio da tela abria sessão nova sem fechar a anterior — `encerrar_sessao_anterior()` (migration 20261028000001) passa a chave dos rascunhos para a sessão nova e apaga a anterior. Teste `fase0_encerrar_sessao_anterior.sql`. Documento de segurança/LGPD atualizado. Evidência na produção: 20 sessões acumuladas encerradas (sobrou 0); login = 1 sessão; no desbloqueio a sessão de 18:54 sumiu e a nova (18:59) herdou a chave dos rascunhos. Inatividade de 30 min configurada no painel. |
| 20 — Fila do modo sem conexão (P1) | **Concluído em 07/10/2026 — o achado estava errado** | Ao abrir o item, o código mostrou que a fila (`src/lib/offline/fila.ts`) **já é cifrada** desde a Fase 1 (ADR 0009): AES-256-GCM por registro, chave por pessoa gerada no aparelho e não exportável, independente da sessão. Logo, nada em claro no aparelho e nada perdido no fim da sessão (a saída avisa pendências; a fila sincroniza no próximo login da mesma pessoa). Evidência: `src/lib/offline/fila.test.ts` (no disco só há cifra; o registro volta inteiro; outra pessoa não lista; só sai com confirmação do servidor), agora no CI. Decisão do RT: fechar com evidência; a lacuna do computador compartilhado foi para "Depois do backlog". |

**Ordem técnica da Fase 0**
1. Separar homologação.
2. Configurar proteção de borda.
3. Correções rápidas de auditoria: HMAC no webhook e `search_path` nas 8 funções (em homolog, depois produção).
4. Ativar 2FA em homolog e depois produção.
5. Corrigir leitos (ciclo de vida e bloqueio) em homolog.
6. Habilitar PITR e automatizar backup/restore.
7. Revisar acessos.
8. P1 só após os P0 fechados: observabilidade, pipeline de release, localStorage, reserva.
9. Criar documentos e demo.

---

## Fase 1 — Produto Demonstrável e Valor Gerencial
**Horizonte:** 30-60 dias
**Objetivo:** transformar o sistema existente em algo mais fácil de vender e entender.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P0 | Demo matadora PS/UPA | Criar fluxo recepção → triagem → fila → médico → prescrição → enfermagem → observação/leito → alta; preparar dados fictícios; criar script de fala; treinar apresentação | Demo reproduz fluxo completo sem erro e sem expor dado real |
| 2 | P0 | Dashboard PS/UPA | Definir KPIs; criar consulta/RPC; criar tela; separar por etapa; destacar gargalos; incluir atualização automática | Tela mostra aguardando triagem, aguardando médico, em atendimento, medicação, observação e alta |
| 3 | P0 | Indicador recepção → triagem | Confirmar timestamps; criar regra de cálculo; exibir média, mediana e fora do alvo; filtrar por unidade/período | Gestor vê tempo médio recepção→triagem por período e unidade |
| 4 | P0 | Indicador triagem → médico | Usar classificação e início de atendimento; calcular por cor; alertar atrasos por tempo-alvo (tempos-alvo configuráveis por unidade, com default Manchester) | Gestor vê espera por cor e identifica pacientes fora do tempo |
| 5 | P0 | Pacientes por classificação de risco | Agregar por cor; filtrar por período/unidade/setor; exportar CSV | Gráfico/tabela por cor disponível e exportável |
| 6 | P0 | Evasão/abandono | Consolidar eventos de retirada; agrupar motivos; calcular taxa; listar pacientes/eventos autorizados | Taxa de evasão aparece no dashboard com motivos |
| 7 | P1 | Filtros livres de BI | Implementar filtro por período; unidade; setor; profissional; cor; etapa; preservar filtros na URL | Dashboards principais aceitam filtros dinâmicos |
| 8 | P1 | Histórico encerrado inline no PEP | Definir regra de permissão; mostrar resumo de atendimentos encerrados; registrar log de acesso; permitir abrir detalhes com justificativa se necessário | Médico autorizado vê histórico resumido sem pedido manual separado; todo acesso ao detalhe fica rastreável por usuário e motivo |
| 9 | P1 | Unificação de pacientes duplicados | Criar tela de candidatos duplicados; escolher cadastro mestre; migrar episódios/documentos; manter trilha de auditoria; bloquear merge perigoso | Dois cadastros podem ser mesclados com auditoria e sem perda de histórico; merge é reversível ou, no mínimo, o cadastro absorvido fica preservado como inativo |
| 10 | P1 | One-page comercial | Definir proposta de valor; listar módulos prontos; listar diferenciais; listar "roadmap" separado; criar PDF | Material de 1 página pronto para reunião |
| 11 | P1 | Matriz competitiva visual | Criar tabela Chefe Coruja x MV/Tasy/TOTVS/SisHOSP; separar "tem hoje" e "roadmap"; evitar promessas falsas | Matriz pronta para uso interno/comercial |
| 12 | P1 | Modo de contingência documentado | Definir fluxo da unidade com sistema indisponível (formulários em papel padronizados por etapa); regra de reentrada posterior com marcação de "registro retroativo"; descrever o que o modo offline atual cobre e o que não cobre; tempo máximo tolerado antes de acionar contingência | Documento de contingência pronto para o cliente; formulários disponíveis; reentrada retroativa auditada |
| 13 | P2 | Onboarding in-app mínimo | Criar tour ou dicas nas telas críticas; incluir recepção, triagem, prescrição e leitos | Usuário novo entende o fluxo básico sem treinamento externo pesado |
| 14 | P2 | Analytics de produto e feature flags (PostHog) | Eventos mínimos: login, troca de aba na Central Clínica, uso de cada calculadora/escore, abertura do censo, chat lateral quando lançado; feature flag para rollout do dashboard do gestor (tarefa 2) por subconjunto de unidades antes do geral; session replay **desligado ou mascarado** em toda tela com dado de paciente; nenhum identificador de paciente em propriedade de evento; documentar em `infra/posthog.md` | Dashboard do gestor pode ser ligado por unidade; eventos aparecem sem dado clínico; replay inexistente em telas clínicas (verificado) |
| 15 | P1 | Tela "Aguardando liberação" libera sozinha | Achado na tarefa 2 da Fase 0 (05/10/2026): `src/pages/AguardandoLiberacao.tsx` não volta a consultar os vínculos nem redireciona; consultar a cada ~30 s e ir para `/` quando houver vínculo; teste do fluxo | Profissional em espera entra sozinho quando o vínculo é criado, sem sair e entrar; o texto da tela passa a ser verdadeiro |
| 16 | P2 | Criação de conta pela administração | Achado na tarefa 2 da Fase 0: a regra "conta nova só com convite" (`20261003000009`) barra também o Add user do painel e a API admin com `app_metadata.origem = 'admin'` (o Auth grava antes do metadado); trocar a checagem por gatilho de restrição `DEFERRABLE INITIALLY DEFERRED` (validar antes se o Auth aplica o metadado na mesma transação); migration expand + rollback; testes de signUp sem código (recusado) e criação admin (aceita) | Admin cria conta pela API/painel; signUp público sem código continua recusado; evidência por teste de banco |

**Andamento da Fase 1**

| Tarefa | Situação | Evidência / observação |
|---|---|---|
| 1 — Demo PS/UPA (P0) | **Concluída em 07/10/2026 — ensaio na homologação em 14 minutos, fluxo completo, só dado fictício (responsável)** | Roteiro estendido até a alta (`produto/docs/demo/roteiro-demo-gestor-upa.md`): recepção → triagem → fila → médico → prescrição → observação → checagem da enfermagem → alta médica com CID → leito em higienização liberado pela enfermagem → painel do gestor; variante de internação com reserva e bloqueio de leito. `demo-preparar.sql` passa a escalar também na Observação. Sem código novo: o fluxo já existe no sistema. |
| 2 — Dashboard PS/UPA (P0) | **Concluída — em produção em 07/10/2026 (PR #25)** | Decisões do RT: tela própria **Porta** (`/gestao/porta`, menu do gestor); 6 etapas (aguardando triagem, aguardando médico, em atendimento, medicação pendente, em observação, altas hoje) com a espera mais antiga; aguardando médico por cor com quantos passaram do tempo-alvo do protocolo da unidade; observação acima de 6 h; gargalo destacado; lista com **nome, setor e leito/poltrona** (acesso registrado na auditoria, no máximo a cada 15 min). Atualiza a cada 15 segundos e ao voltar para a aba. RPC `porta_agora` (migration 20261029000001), teste `fase1_porta_agora.sql`; regras da tela em `src/lib/portaAgora.ts` (+ teste). |
| 3 — Indicador recepção → triagem (P0) | **Concluída — em produção em 07/10/2026 (PR #26)** | Decisões do RT: base = da chegada (ficha na recepção) à **primeira classificação** (reclassificação não conta), com a espera até ser **chamado** ao lado; alvo padrão **10 min**, configurável em Unidade › Configurações (`alvo_triagem_min`); tela **Indicadores**, períodos hoje / 7 / 30 dias / intervalo, exportação CSV. Mostra mediana, média, fora do alvo (n e %), 90º percentil, sem classificação e tabela por dia. RPCs `indicador_espera_triagem` e `salvar_alvo_triagem` (migration 20261029000002), teste `fase1_indicador_espera_triagem.sql`; regras em `src/lib/esperaTriagem.ts` (+ teste). Só agregados: sem auditoria de acesso. |
| 4 — Indicador triagem → médico (P0) | **Concluída — em produção em 07/10/2026 (PR #27)** | Decisões do RT: espera da **1ª classificação** ao médico abrir o atendimento; cor e alvo = **última classificação antes do médico** (quem piorou e esperou aparece como atraso); alvos por cor **ajustáveis pela unidade** em Unidade › Configurações (sem ajuste, o protocolo; sem protocolo, Manchester) — valem também na tela Porta, que passa a contar desde a 1ª classificação; tela **Indicadores** ao lado da tarefa 3, mesmos períodos e CSV; **lista dos atrasados com nome**, acesso na auditoria. Quem não viu o médico (evasão, cancelamento) conta como atraso quando passou do alvo. RPCs `indicador_espera_medico`, `salvar_alvos_medico` e `private.tempos_alvo_unidade` (migration 20261029000003), teste `fase1_indicador_espera_medico.sql`. Correção do teste do RT: atraso em **minutos inteiros** (vermelho em 0 min não é atraso; 20261029000004), também na tela Porta. |
| 5 — Pacientes por classificação de risco (P0) | **Concluída — em produção em 07/10/2026 (PR #28)** | Decisões do RT: cada paciente na **cor final** (última classificação), com os **reclassificados** à parte (quantos subiram e baixaram de gravidade); filtros de período, **setor de entrada**, **adulto/pediátrico** e **turno** pela hora de chegada (manhã 07–13, tarde 13–19, noite 19–07); **barras por cor** (com "sem classificação") e **tabela por dia**, com CSV; tela **Indicadores**. RPC `pacientes_por_cor` (migration 20261029000005), teste `fase1_pacientes_por_cor.sql`. Só agregados: sem auditoria de acesso. |
| 6 — Evasão/abandono (P0) | **Concluída — em produção em 07/10/2026 (PR #29)** | Decisões do RT: evasão agrupada pelo **momento** (antes da triagem, esperando o médico, durante o atendimento, na observação), pela cor e pelo turno, e por um **motivo de lista curta** pedido a partir de agora ao registrar a evasão (demora, melhorou, foi a outro serviço, sem informação, outro) nas três telas — retirada da fila, desfecho do médico e desfecho da observação; a justificativa escrita continua; evasão antiga sem motivo conta como "sem informação". **Alta a pedido em taxa separada**. Lista dos casos **com nome**, acesso na auditoria. Cartão em **Indicadores** e resumo "hoje" na tela **Porta**. RPCs `indicador_evasao` e `registrar_motivo_evasao`, `porta_agora` com o resumo (migration 20261029000006), teste `fase1_evasao.sql`; `src/lib/evasao.ts` (+ teste). |
| **P0 da Fase 1** | **Todos concluídos em 07/10/2026** | Tarefas 1 a 6 em produção. Seguem os P1 na ordem técnica: 7 filtros de BI, 8 histórico inline, 9 merge de pacientes, 10–12 materiais e contingência, 15 tela de liberação. |
| 7 — Filtros livres de BI (P1) | **Concluída — em produção em 08/10/2026 (PR #30)** | Decisões do RT: **uma barra de filtros no topo** da tela Indicadores vale para os quatro cartões da porta (espera da triagem, espera do médico, pacientes por cor, evasão): período, setor de entrada, cor final, turno da chegada, adulto/pediátrico e **médico que atendeu**; a unidade é a ativa (comparar unidades fica para a Fase 4). Filtros **no endereço da página** (botão "Copiar link"); o CSV leva os filtros. "Etapa" não entrou: cada indicador do período já é de uma etapa, e o "agora" por etapa é a tela Porta. Recorte único `private.episodios_filtrados` e `opcoes_filtros_bi` (migration 20261030000001), teste `fase1_filtros_bi.sql`; `src/lib/filtrosBi.ts` (+ teste). |
| 8 — Histórico encerrado inline no PEP (P1) | **Concluída — em produção em 08/10/2026 (PR #31)** | Decisões do RT: quem **cuida do paciente agora** (médico com o paciente no setor do seu plantão, ou da teleinterconsulta vigente) vê, **sem pedido ao gestor**, o **resumo** dos atendimentos encerrados **nesta unidade, sem limite de tempo**: data, setor, cor, CID, desfecho final e médico — sem texto clínico. O **detalhe** abre com **motivo escrito** (mín. 10 letras), só leitura, por 12 h; quem, quando e o motivo ficam no registro de acesso e aparecem na Auditoria do gestor. Quem não cuida continua com o pedido ao gestor. Botão "Histórico" na janela de atendimento da porta, cartão no Resumo do leito (Pacientes Internados) e em "Dados e atendimentos". RPCs `historico_encerrado`, `abrir_historico_encerrado`, `private.cuida_do_paciente_agora`; coluna `motivo` no registro de acesso (migration 20261030000002), teste `fase1_historico_encerrado.sql`; `src/lib/historico.ts` (+ teste). Correção do teste do RT: médico com vários papéis (ex.: também gestor) continua sendo "quem cuida" (20261030000003). |
| 9 — Unificação de pacientes duplicados (P1) | **Concluída — em produção em 08/10/2026 (PR #32)** (teste do RT: candidatos e pedido; aprovação coberta pelo teste do banco) | Decisões do RT: **vincular, sem mover registros** — o cadastro absorvido fica inativo apontando para o principal (`pacientes.unificado_em`); nenhum registro clínico muda de paciente; histórico, acesso por motivo/pedido e leitura do prontuário juntam os cadastros; **desfazer** devolve tudo (inclusive CPF/CNS que tinham passado ao principal). **Recepção (ou gestor) pede com motivo, gestor aprova** — ninguém aprova o próprio pedido. Candidatos: mesmo nome + nascimento, mesma mãe + nascimento, mesmo CPF/CNS e (teste do RT) **mesmo nome com nascimento diferente ou em branco**, marcado "conferir" (20261030000005). **Bloqueios**: dois atendimentos abertos; alergia ou evento adverso ativo só no absorvido (segurança da prescrição — registrar no principal antes). Tela **Cadastros duplicados** (recepção e gestor). Migration 20261030000004, teste `fase1_unificar_pacientes.sql`; `src/lib/unificacao.ts` (+ teste). |
| 10 — One-page comercial (P1) | **Concluída em 08/10/2026 — aprovada pelo responsável** | Página A4 para UPA, PS e hospital pequeno (decisão do RT: público geral): proposta de valor, 8 módulos **em produção**, diferenciais e "Em construção" separado, sem data. Preço e contato em **modelo** para preencher (decisão do RT). `produto/docs/comercial/chefe-coruja-one-page.pdf` (fonte `one-page.tpl.html`; o HTML final embute o logo). Baseado no inventário do sistema (03/10) atualizado com o que as Fases 0 e 1 entregaram. |
| 11 — Matriz competitiva visual (P1) | **Concluída em 08/10/2026** | Decisão do RT: **uso interno, com nomes e fontes**; critérios clínico da porta, gestão e BI, segurança e LGPD, SUS/faturamento/integrações. Chefe Coruja × MV, Tasy (agora Bionexo), TOTVS RM Saúde, SisHOSP CORE; coluna do Chefe Coruja separa "tem", "em construção" e "não tem"; concorrentes só com fonte pública ("não encontrado" ≠ "não tem"). Página de leitura (onde ganha, onde perde — certificação SBIS é o principal ponto fraco —, cuidados) e página de fontes. `produto/docs/comercial/matriz-competitiva-interna.pdf` e `pesquisa-concorrentes.md` (evidência célula a célula). |
| 12 — Modo de contingência documentado (P1) | **Concluída — migration na produção em 08/10/2026; telas entram com o merge** | Decisões do RT: acionar com **15 min** sem conseguir registrar o que o modo sem internet não cobre; **coordenador do plantão** aciona/encerra e avisa o gestor; reentrada = **anexar as folhas + digitar o essencial** (classificação, prescrição vigente, desfecho) com a marca "reentrada de contingência"; 5 formulários (recepção + classificação, atendimento + prescrição, observação/internação, desfecho, quadro de leitos). Plano (o que o modo sem internet cobre e não cobre, setor a setor, reentrada, prazo até o fim do plantão seguinte, checklist, RTO/RPO) e formulários em `produto/docs/contingencia/` (PDF). No sistema: menu **Contingência** (registrar o período, só inserção) e botão **Marcar reentrada de contingência** no atendimento da porta e no resumo do leito (migration 20261030000006, teste `fase1_contingencia.sql`; `src/lib/contingencia.ts` + teste). |

**Checklist da Fase 1 cumprido em 08/10/2026** (demo, dashboard PS/UPA, contingência e materiais comerciais). Ficam para depois, sem bloquear a Fase 2: 13 e 14 (P2), 15 (P1) e 16 (P2). **Decisão do RT (08/10/2026) para a Fase 2:** perguntas clínicas feitas de uma vez no início; tarefas construídas em sequência e publicadas na homologação; **um PR por tarefa**; teste e merges no fim, com "ok produção" para as migrations.

**Ordem técnica da Fase 1**
1. Criar base fictícia e demo.
2. Criar RPCs/consultas dos KPIs.
3. Criar dashboard PS/UPA.
4. Adicionar filtros e exportações.
5. Implementar histórico inline.
6. Implementar merge de pacientes.
7. Criar materiais comerciais e documento de contingência.
8. PostHog quando o dashboard do gestor estiver pronto para rollout.

---

## Fase 2 — Segurança Clínica e Maturidade Operacional
**Horizonte:** 60-90 dias
**Objetivo:** reduzir risco clínico e melhorar prescrição/enfermagem.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P0 | Dupla checagem para alto risco | Definir lista de medicamentos alto risco (base: lista ISMP Brasil); marcar no cadastro; exigir segundo profissional; registrar data/hora/usuário; impedir conclusão sem segunda checagem quando obrigatório | Medicamento alto risco só é administrado após dupla checagem; o segundo checador não pode ser o mesmo usuário do primeiro |
| 2 | P0 | Aprazamento assistido | Mapear frequências comuns; sugerir horários; permitir ajuste manual; registrar quem alterou; respeitar início e intervalo | Enfermagem recebe sugestão de horários e pode ajustar com auditoria |
| 3 | P1 | Base inicial de interações medicamentosas | Escolher fonte/base (verificar licença de uso comercial antes de integrar); criar tabela de pares críticos; integrar na prescrição; classificar gravidade; permitir justificativa | Prescrição alerta interações críticas antes de emitir |
| 4 | P1 | Intercorrência estruturada | Criar tipos de intercorrência; gravidade; conduta; profissional; vínculo ao episódio/internação; relatório | Intercorrências deixam de ser apenas texto solto |
| 5 | P1 | Expandir escalas assistenciais | Priorizar Fugulin; depois Glasgow/Morse expandido/risco de queda; criar tabela versionada; gerar histórico | Escala Fugulin disponível e vinculada à internação |
| 6 | P1 | Alteração versionada de item de prescrição | Permitir alterar dose/via/frequência com motivo; manter versão anterior; registrar auditoria; refletir na checagem | Prescrição pode ser alterada sem apagar histórico |
| 7 | P1 | Teste do offline atual | Criar cenário de queda; registrar sinais vitais offline; sincronizar; testar conflito; testar criptografia local; documentar limites | Relatório de teste offline com sucesso/falhas e escopo suportado; limites refletidos no documento de contingência |
| 8 | P1 | Expandir auditoria clínica | Mapear eventos sem auditoria; incluir prescrição, checagem, evolução, leito, documentos; criar verificação de cadeia | Eventos clínicos críticos auditados e verificáveis |
| 9 | P2 | Painel da farmácia para críticos/faltas | Consolidar faltas sinalizadas; priorizar alto risco; exibir por unidade/setor; permitir retorno da farmácia | Farmácia vê pendências críticas em painel próprio |
| 10 | P2 | Read replica para BI | Criar replica de leitura no Supabase; apontar dashboards, exportações e relatórios para a replica; medir lag; manter operações clínicas no primário | Consultas de BI não concorrem com o atendimento; lag monitorado |

**Decisões do RT para a Fase 2 (08/10/2026)**
- Dupla checagem: medicamentos da **lista ISMP Brasil** (alta vigilância) marcados no cadastro; o farmacêutico marca/desmarca outros com motivo. **Segundo checador: enfermeiro ou farmacêutico**, nunca o mesmo usuário.
  - **Revista pelo RT em 09/10/2026: o controle passa a ser a liberação da farmácia, e a dupla conferência de enfermagem sai.** Motivo: a dupla de enfermagem fica na contramão e depende demais da enfermagem; quem dispensa já confere e libera.
    - Vale a mesma lista de alta vigilância, sem marcação nova.
    - O farmacêutico libera o **item** da prescrição pela Validação que já existe. Item alterado pelo médico precisa de nova liberação.
    - Sem farmacêutico de plantão, a enfermagem administra **com justificativa**. A administração fica marcada e entra na lista "Administradas sem liberação" da farmácia, para conferir depois.
    - Risco registrado: o ISMP recomenda dupla checagem independente na administração de alguns itens (insulina, heparina, KCl EV). Com a mudança, essa conferência à beira do leito deixa de existir. Decisão do RT.
- Aprazamento: grade de horários **configurável por unidade** (sem configuração, início às 06h); enfermagem ajusta caso a caso com registro.
- Interações: **pesquisar bases com licença comercial e trazer opções**; a tarefa 3 só começa depois da escolha.
- Fugulin: **enfermeiro, 1x por dia**, na internação, com fonte citada e histórico.
- Intercorrência: registram **médico, enfermeiro e técnico de enfermagem**.
- Alteração versionada de item de prescrição: **só o médico, com motivo**; versão anterior guardada; enfermagem vê o aviso na checagem.
- Read replica: **não agora** (só quando os painéis pesarem).

**Andamento da Fase 2** (atualizado em 09/10/2026, noite)

Todas as tarefas de 1 a 9 estão **em produção**. As PRs foram mergeadas no master, e as migrations `20261031000001` a `000008` foram aplicadas na produção com o "ok produção" do RT de 09/10/2026. O roteiro foi rodado no app local, com os resultados em `produto/docs/fase2/resultado-roteiro-2026-10-09.md`.

| Tarefa | Situação | Onde |
|---|---|---|
| 1 — Dupla checagem → liberação da farmácia | A versão com dupla de enfermagem está em produção. **A troca para liberação da farmácia (decisão do RT de 09/10) está na homologação.** Falta o teste do RT e o "ok produção" | Migrations `20261031000001_dupla_checagem.sql` e `20261101000002_liberacao_farmacia_alta_vigilancia.sql` (só homologação); testes `fase2_dupla_checagem.sql` e `fase2_liberacao_farmacia.sql`; branch `fase2/liberacao-farmacia` (sobre a `fase2/defeitos-leves`) |
| 2 — Aprazamento assistido | Em produção | Migration `20261031000002_aprazamento_assistido.sql`; teste `supabase/tests/fase2_aprazamento_assistido.sql` |
| 3 — Interações medicamentosas | Em produção (opção A: lista curada de pares críticos, com fonte por linha; a base comercial, opção B, fica como plano futuro) | Migration `20261031000005_interacoes_criticas.sql`; teste `supabase/tests/fase2_interacoes_criticas.sql`; opções em `produto/docs/pesquisa/interacoes-medicamentosas-fontes.md` |
| 4 — Intercorrência estruturada | Em produção (os dois defeitos graves do roteiro foram corrigidos, PR #45) | Migration `20261031000003_intercorrencia.sql`; teste `supabase/tests/fase2_intercorrencia.sql` |
| 5 — Fugulin | Em produção (12 áreas; intensivo acima de 34; na tela, só um resumo de cada graduação) | Migration `20261031000006_fugulin.sql`; teste `supabase/tests/fase2_fugulin.sql`; ficha registrada pela migration `20261101000001` |
| 6 — Alteração versionada de item | Em produção | Migration `20261031000004_alteracao_item_prescricao.sql`; teste `supabase/tests/fase2_alteracao_item_prescricao.sql` |
| 7 — Teste do offline | Concluída (relatório) | `produto/docs/fase2/teste-offline-2026-10-09.md`; plano de contingência atualizado |
| 8 — Auditoria clínica | Em produção | Migration `20261031000007_auditoria_clinica.sql`; teste `supabase/tests/fase2_auditoria_clinica.sql` |
| 9 — Painel da farmácia | Em produção (a correção do cache entrou pela PR #43) | Migration `20261031000008_painel_farmacia.sql`; teste `supabase/tests/fase2_painel_farmacia.sql` |
| 10 — Réplica de leitura | Não agora (decisão do RT de 08/10) | — |
| Defeitos leves do roteiro | Corrigidos e conferidos no navegador local; na homologação; falta o PR | Branch `fase2/defeitos-leves`, sem migration |

**Para encerrar a Fase 2 (com o RT):**
1. Testar os 5 defeitos leves na homologação, pela seção 10 do roteiro. Depois, merge do PR `fase2/defeitos-leves`.
1a. Testar a liberação da farmácia, pela tarefa 1 do roteiro, que foi refeita. Dar o "ok produção" da migration `20261101000002`, aplicada antes do merge, e depois fazer o merge do PR `fase2/liberacao-farmacia`.
2. Fazer o teste final pelo roteiro `produto/docs/fase2/roteiro-teste-fase2.md`, na homologação.
3. Assinar o encerramento em `produto/docs/fase2/ENCERRAMENTO-FASE2.md`, com as evidências já reunidas.

Tarefa 1, como ficou:
- **Lista.** Regras do ISMP Brasil 2019 (Boletim v. 8, n. 1, fev. 2019) marcam o cadastro pelo princípio ativo, pela via na apresentação e pela concentração. Exemplos: glicose ≥ 20% e NaCl > 0,9%. Ficam só as regras e a citação, sem o texto do boletim, que tem direitos reservados.
- **Ajuste da unidade.** O farmacêutico ou o gestor marca e desmarca com motivo, e o histórico fica guardado. As vias epidural e intratecal e os antineoplásicos dependem da marcação da farmácia.
- **Checagem.** O item mostra "alta vigilância · dupla checagem". A 1ª conferência é da enfermagem de plantão. A 2ª é de um enfermeiro de plantão ou de um farmacêutico, nunca do mesmo usuário. "Feito" fica bloqueado até as duas conferências, que valem por 2 horas e servem a uma única administração. "Não feito" e "recusado" seguem livres.
- **Tela "Alta vigilância".** Para o farmacêutico, o enfermeiro e o gestor: fila da 2ª conferência e lista da unidade.
- **Teste do RT.** Na homologação, como enfermeiro de plantão, prescrever morfina injetável e ver o bloqueio do "Feito". Fazer a 1ª conferência. Fazer a 2ª com outro usuário (enfermeiro ou farmacêutico), em Checagem ou na tela "Alta vigilância". Depois registrar "Feito".

Tarefa 2, como ficou:
- **Frequência.** Sai da posologia escrita pelo médico: "8/8h", "de 6 em 6 horas", "a cada 12 h", "2x ao dia", "1x/dia". Só os intervalos que dividem o dia têm sugestão (1, 2, 3, 4, 6, 8, 12 e 24 h). "Agora", "se necessário", "contínuo", 48/48h e 5/5h ficam com o enfermeiro.
- **Grade.** Fica em Configuração > Grade de aprazamento, e quem altera é o gestor. Define o início do dia (padrão 06:00); cada intervalo segue o início, salvo quando a unidade escreve uma grade própria para ele (ex.: 8/8h = 08, 16, 24).
- **Checagem.** O enfermeiro vê a sugestão, a origem dela e a primeira dose da grade depois da hora da prescrição. Usa a sugestão com um clique ou digita outros horários, com motivo opcional.
- **Registro.** Cada aprazamento guarda o sugerido, o escolhido, quem, quando e o motivo. Só aceita inserção, e a tela mostra o último.
- **Teste do RT.** Como gestor, salvar a grade em Configuração. Como médico, prescrever um item 8/8h. Como enfermeiro, na Checagem, usar a sugestão em um item e ajustar outro com motivo. Conferir a linha "Aprazado por…".

Tarefa 4, como ficou:
- **Registro.** Médico, enfermeiro e técnico de enfermagem de plantão com o paciente registram pelo botão "Registrar intercorrência". O botão fica na janela do atendimento da porta e no resumo do leito da internação. O registro tem tipo, gravidade (leve, moderada, grave, com a definição na tela), hora em que ocorreu (até 72 h antes), o que aconteceu, a conduta, o autor (usuário do login, com o papel) e o setor.
- **Tipos.** A lista de 21 tipos fica numa tabela e é uma **proposta para o RT revisar**. Inclui PCR, instabilidade, insuficiência respiratória, rebaixamento, convulsão, hipoglicemia, reação a medicamento, erro de medicação, queda, perda de dispositivo, evasão e "Outra", que pede o nome.
- **Correção.** Só por inserção: corrigir é "Retificar". A versão anterior fica guardada e aparece riscada.
- **Relatório do gestor.** Em Gestão > Intercorrências: total por gravidade, por tipo (com as graves), por setor e por papel, e os casos. Conta a versão vigente, e os nomes dos pacientes ficam na trilha de auditoria.
- **Teste do RT.** Registrar uma intercorrência como técnico, outra como enfermeiro e retificá-la como médico. Ver o relatório como gestor.

**Fugulin (pergunta de 08/10/2026; decisão do RT em 09/10/2026, no fim do item).** O artigo-fonte (Fugulin, Gaidzinski, Kurcgant. Rev Latino-am Enfermagem 2005;13(1):72-8, Tabela 1) traz 9 áreas de cuidado, pontuadas de 1 a 4. As faixas são: mínimos 9–14, intermediários 15–20, alta dependência 21–26, semi-intensivos 27–31 e intensivos acima de 31. Os protocolos atuais usam outra versão, com 12 áreas: as mesmas 9 e mais três, entre elas integridade cutâneo-mucosa. Nessa versão as faixas são 12–17, 18–22, 23–28, 29–34 e acima de 34, e é ela que aparece com o COFEN. Antes de construir, o RT diz:
- qual versão a unidade usa;
- qual é a fonte primária da versão de 12 áreas, se for ela.

O artigo de 2005 tem licença CC BY-NC (uso não comercial). **Decisão do RT (09/10/2026):** fica a versão de 12 áreas (Santos, Rogenski, Baptista, Fugulin. Rev Latino-am Enferm 2007;15(5):980-5), com intensivo acima de 34, porque as unidades têm leito semi-intensivo. O texto das graduações não entra no produto; a tela mostra só um resumo de cada graduação, com a citação.

Tarefa 6, como ficou:
- **Alterar.** Botão "Alterar" nos itens de medicamento, na prescrição da porta e na da internação. Só o médico de plantão, com motivo. Muda dose, via, frequência e "se necessário".
- **Versões.** A versão anterior é suspensa com "Alterado: <motivo>" e guarda as checagens. A nova passa pelas mesmas travas da prescrição (alergia, peso da criança, diluição vigente) e aponta a anterior, com o número da versão. Se a nova não passa, nada muda.
- **Aprazamento.** Com a mesma frequência, a nova versão herda o aprazamento. Com frequência nova, volta a pedir aprazamento.
- **Aviso.** A Checagem mostra "Prescrição alterada (versão N)", o que mudou e o motivo. A alteração deixa linha na trilha de auditoria. O antes e o depois ficam nas duas versões do item, porque a trilha guarda só campos de uma lista fechada, sem texto clínico.
- **Teste do RT.** Como médico, prescrever um item 12/12h e alterar a dose. Depois alterar a frequência. Como enfermeiro, ver o aviso e conferir que o aprazamento se manteve na 1ª alteração e caiu na 2ª.

Tarefa 7, como ficou:
- **Cenário de queda.** Feito no app local com o gateway do Supabase parado, e passou: sinais vitais na fila cifrada (nada em claro no IndexedDB, chave não exportável), sincronização ao voltar, com a marca "sem conexão", a hora do fato, a hora de chegada e o autor do login.
- **Conflito.** Reenvio não duplica (`ja_recebido`).
- **Regras do cliente.** Têm teste próprio (`src/lib/offline/regras.test.ts`).
- **Limites.** Recarregar durante a queda leva ao login (guardado em "Depois do backlog"). A mensagem do app agora usa a tolerância do servidor, de 20 min por decisão do RT de 03/10, e não os 15 do ADR.
- **Relatório.** `produto/docs/fase2/teste-offline-2026-10-09.md`. O plano de contingência foi atualizado.

Tarefa 3, como ficou (opção A da decisão C):
- **Lista da unidade.** Grupos de fármacos (por princípio ativo) e pares de grupos, com gravidade (contraindicada ou grave), efeito, conduta e fonte. Quem cuida dela é o farmacêutico ou o gestor, em Interações críticas. O médico só lê.
- **Modelo ONC.** Os 15 pares da lista ONC (Phansalkar 2012), resumidos com as nossas palavras, chegam como **proposta**, que não alerta. Os grupos de um fármaco só já vêm preenchidos (atazanavir, febuxostate, irinotecano, ramelteona, tizanidina, tranilcipromina, procarbazina). Os grupos de classe (IMAO, ISRS, opioides, prolongam o QT, inibidores e indutores de CYP etc.) **ficam vazios para a farmácia preencher a partir das bulas**. Par sem fármaco nos grupos não ativa.
- **Prescrição.** Com par ativo e o outro fármaco vigente, o item não entra. Aparece o alerta (fármaco, gravidade, grupos, efeito, conduta, fonte), e o médico prescreve só com justificativa. A justificativa fica gravada (`alertas_interacao`) e aparece na linha da prescrição. A trilha de auditoria registra a ação, sem o texto. Ao alterar o item, a justificativa da versão anterior segue com ele.
- **Verificado no navegador local.** Fluoxetina e depois selegilina com o par ISRS × IMAO ativo: alerta, justificativa e linha com a interação justificada.
- **Teste do RT.** Como farmacêutico ou gestor, em Interações críticas: preencher os grupos de um par (ex.: ISRS e IMAO) e ativar. Como médico: prescrever os dois e ver o alerta.
- **Plano B.** A base comercial licenciada fica para o futuro. A tabela já guarda a fonte por linha.

Tarefa 5, como ficou:
- **Fontes, conferidas no PubMed.** Fugulin et al. 2005 ([doi:10.1590/s0104-11692005000100012](https://doi.org/10.1590/s0104-11692005000100012)) traz as 9 áreas. Santos et al. 2007 ([doi:10.1590/s0104-11692007000500015](https://doi.org/10.1590/s0104-11692007000500015)) acrescenta integridade cutâneo-mucosa, curativo e tempo do curativo. As faixas da versão de 12 áreas vêm de quem a aplicou, de Brito e Guirardello 2012 ([doi:10.1590/s0034-71672012000100013](https://doi.org/10.1590/s0034-71672012000100013)), porque a Tabela 2 de 2007 é imagem no PDF. Com a decisão do RT, ficam 12–17, 18–22, 23–28, 29–34 e acima de 34.
- **Tela.** Cartão na aba Escalas dos Cuidados da internação. As 12 áreas mostram **só um resumo nosso** de cada graduação, com as citações. O servidor refaz a soma e a categoria.
- **Regras.** Só o enfermeiro de plantão, uma vez por dia por internação. A segunda do dia é retificação, com motivo, e a anterior fica riscada no histórico. Na lista Internação · enfermagem aparece "Fugulin de hoje pendente" ou o total do dia.
- **Pediatria.** Fugulin é instrumento do adulto, então criança não se classifica por ele. O instrumento pediátrico (Dini, Fugulin et al. 2011) ficou guardado em "Depois do backlog".
- **Verificado no navegador local.** Selo de pendente na lista; 12 áreas marcadas com 2 dão 24, "Alta dependência", com autor e hora.
- **Teste do RT.** Como enfermeiro, em Internação > Cuidados > Escalas, classificar um paciente e retificar no mesmo dia com motivo.

Tarefa 8, como ficou:
- **Mapa do que faltava.** Prescrição (criar, suspender, aprazar), checagem, SOAP, evolução, SAE, classificação de risco, alergia (registrar, inativar), escalas e Fugulin, transferência de setor e a internação (abertura, leito, setor, status de alta, óbito ou transferência) gravavam o registro, mas **não deixavam linha na trilha encadeada**.
- **Agora.** Um gatilho por tabela grava a linha na mesma transação, com autor do login, hora do servidor e elo de hash.
- **Fora de propósito.** Sinais vitais: volume alto, e cada aferição já é registro só de inserção, com autor, hora e marca de sem conexão.
- **Lista fechada.** O payload da trilha continua sem texto clínico nem nome. Ganhou só chaves estruturais (situação, gravidade, versão, horário, cor, escala, anterior, retifica).
- **Achado.** Os eventos novos da Fase 2 perdiam o conteúdo do payload por causa da lista fechada. Isso está certo para a LGPD: o conteúdo mora nas tabelas versionadas. O texto do BACKLOG das tarefas 3 e 6 foi corrigido.
- **Verificação.** Em Gestão > Auditoria:
  - a integridade da cadeia (já existia);
  - um quadro novo de **cobertura**: por tipo de evento, quantos registros clínicos dos últimos 30 dias (desde a instalação) ficaram sem linha na trilha.
- **Teste do RT.** Fazer uma prescrição, uma checagem e uma classificação. Depois, como gestor, ver a trilha e o quadro de cobertura com zero "sem trilha".

Tarefa 9, como ficou:
- **Painel do farmacêutico.** Nova aba "Painel", a primeira da Central do Farmacêutico, com quatro números: faltas abertas, estoque crítico ou em falta, validação pendente de alta vigilância e aguardando a 2ª conferência.
- **Faltas por prioridade.** Primeiro alta vigilância, depois quantos pacientes têm o medicamento prescrito agora e em quais setores, depois a mais antiga.
- **Retorno da farmácia.** Em cada falta, o farmacêutico escreve substituto, previsão ou conduta (só inserção, com autor e hora) e avança Em cotação → Reposta. O médico vê o retorno ao escolher o medicamento em falta na prescrição.
- **Gestor.** Em Gestão > Farmácia vê o mesmo painel, sem agir.
- **Verificado no navegador local.** Gestor: falta da selegilina com "1 paciente · Clínica Médica".
- **Teste do RT.** Como médico, sinalizar falta de um medicamento de alta vigilância. Como farmacêutico, ver a falta no topo do Painel e enviar o retorno. Como médico, escolher o medicamento e ver o retorno.

**Teste do roteiro (09/10/2026):** rodado no app local, resultado em `produto/docs/fase2/resultado-roteiro-2026-10-09.md`.
- **Defeitos graves (corrigidos na branch `fase2/correcoes-roteiro`, já na homologação):** registrar intercorrência falhava sempre; enfermeiro e técnico não tinham o botão. É só a tela, sem migration.
- **Defeitos leves (corrigidos em 09/10/2026, branch `fase2/defeitos-leves`, sem migration):**
  - item "Agora" já feito voltava a oferecer a 1ª conferência: dose única feita não pede mais conferência nem checagem, e a tela avisa que nova dose precisa de nova prescrição;
  - a mensagem "Grade salva" sumia: agora fica, porque o formulário que se remonta não guarda mais a mensagem;
  - a prescrição do médico não mostrava a versão do item alterado: agora mostra versão, o que mudou, quem alterou e o motivo, como a Checagem;
  - pontuação no alerta de interação: o efeito entre parênteses perde o ponto final, e efeito e conduta terminam em ponto;
  - números repetidos na Central do Farmacêutico: os números ficam só na faixa do topo (a 2ª conferência entrou no lugar do "item mais antigo", que passou para o texto da fila) e o Painel não os repete para o farmacêutico; o gestor continua vendo os números no Painel.

**Fase 2 PAUSADA em 09/10/2026 por decisão do RT**, para a revisão das ferramentas, das calculadoras e da biblioteca médica com o PubMed. Na volta: os defeitos leves acima e o teste do RT na homologação.

**Fase 2 RETOMADA em 09/10/2026, à noite**, depois da revisão PubMed (os 14 PRs foram mergeados, e a migration `20261101000001` foi aplicada na produção). Os defeitos leves já estão corrigidos. Falta o teste final do RT.

**FASE 2 ENCERRADA em 09/10/2026.** Aceite do RT em `produto/docs/fase2/ENCERRAMENTO-FASE2.md`.
- As tarefas de 1 a 9 estão em produção. A tarefa 1 foi revista: o controle passou a ser a liberação da farmácia (PR #61). A 10 (réplica de leitura) ficou para depois.
- O teste geral das Fases 0 a 2 está em `produto/docs/fase2/teste-geral-fases-0-1-2-2026-10-09.md`. Achou 2 defeitos leves, corrigidos na branch `fase2/correcoes-teste-geral`, e 1 configuração para o RT: ligar a proteção contra senha vazada no Auth.

**Fase 2 construída em 09/10/2026.** Tarefas 1 a 9 em produção desde 09/10/2026; a 10 não agora. Falta o teste final do RT (ver "Para encerrar a Fase 2").

**Ordem técnica da Fase 2**
1. Ajustar cadastro de medicamentos alto risco.
2. Implementar dupla checagem.
3. Implementar aprazamento assistido.
4. Implementar interações críticas.
5. Expandir auditoria.
6. Criar intercorrência estruturada e escalas.
7. Testar offline.
8. Read replica, se dashboards já pesarem.

---

## Revisão PubMed das ferramentas — decidida pelo RT em 09/10/2026

A Fase 2 está pausada. Este bloco entra antes de retomá-la, por decisão do RT, que respondeu aos três pontos do resumo em `produto/docs/pesquisa/revisao-pubmed-2026-10/RESUMO.md`:
1. resolver os 11 itens de prioridade alta;
2. corrigir as citações erradas;
3. trazer todas as fontes para a biblioteca.

Regras:
- Cada item tem branch e PR próprios e passa pela homologação.
- Toda mudança clínica cita o PMID. O livro do HC continua visível como referência.
- Número sem confirmação no texto da fonte não entra.

**Fontes de direitos reservados (decisão do RT, 09/10):** podem ser usadas com citação. Nas ferramentas, entra a recomendação, com as nossas palavras e a citação. Na biblioteca, entra uma ficha de referência (citação mais resumo nosso), não o texto integral. As CC BY-NC entram por decisão do RT, que assume o risco da cláusula "não comercial".

| # | Item | Situação |
|---|---|---|
| 1 | Pós-PCR pela ERC-ESICM 2025 | Feito, branch `revisao/pos-pcr-erc-2025` |
| 2 | Trombólise no AVC: correção oficial da AHA/ASA 2026 | Aviso feito, branch `revisao/avc-correcao-aha`. Pendente: o RT trazer o PDF da correção para conferir as Tabelas 5 e 7 |
| 3 | PAC: REMAP-CAP 2025 e citação da ATS 2025 | Feito, branch `revisao/pac-remap-cap` |
| 4 | Endocardite: Duke-ISCVID 2023 | Feito, branch `revisao/endocardite-duke-iscvid` |
| 5 | HINTS: aviso de uso (GRACE-3 2023) | Feito, branch `revisao/hints-grace3` |
| 6 | Carvão ativado: consenso CTRC 2026 | Feito, branch `revisao/carvao-ctrc-2026` |
| 7 | Síndrome hepatorrenal: ADQI-ICA 2024 | Feito, branch `revisao/shr-adqi-2024` |
| 8 | Hiponatremia: alerta contra a subcorreção | Feito, branch `revisao/hiponatremia-subcorrecao` |
| 9 | CKD-EPI: equação de 2009 no Brasil | Feito, branch `revisao/ckd-epi-2009` (2009 e 2021 lado a lado, sem campo de raça) |
| 10 | ITU pediátrica: AAP 2026 | Aviso feito, branch `revisao/itu-aap-2026`. Pendente: limiares novos de piúria e urocultura (texto integral bloqueado; a ferramenta segue com os do livro) |
| 11 | Choque séptico pediátrico: PRoMPT BOLUS | Feito, branch `revisao/prompt-bolus` |
| 12 | Citações erradas (Morse, ATS 2025, Bai & Loeb, Arzayus-Patiño) | Feito, branch `revisao/citacoes` (ATS no item 3) |
| 13 | Biblioteca: fontes novas (CC BY, CC BY-NC e fichas de referência) | Feito, branch `revisao/biblioteca-referencias`: 12 fichas de referência e o texto integral de 19 artigos abertos (14 CC BY, 5 CC BY-NC), baixado do Europe PMC com autorização do RT e convertido para Markdown. Guia em `produto/docs/pesquisa/revisao-pubmed-2026-10/item13-biblioteca.md`. Pendente com o RT: registrar as 3 pastas em `fontes.yaml` e ingerir no VPS |
| — | Registro das versões novas das fichas no banco | Feito, branch `revisao/registro-versoes` (migration `20261101000001`). As 14 versões novas entram na fila de aprovação do RT |

As branches estão empilhadas na ordem da tabela. Os PRs devem ser mergeados nessa ordem. A homologação recebe a última branch, que contém todas.

## Fase 3 — SUS, Produção e Integrações Mínimas
**Encerrada em 10/10/2026** por decisão do RT. As tarefas de 1 a 10 estão concluídas; a tarefa 11 aguarda contrato. Evidências em `produto/docs/fase3/ENCERRAMENTO-FASE3.md`.
**Horizonte:** 90-120 dias
**Objetivo:** começar a transformar dados assistenciais em produção SUS e maturidade técnica.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P0 | Evoluir ciclo AIH | Criar entidade de AIH; status: solicitada, aprovada, rejeitada, cancelada; vincular internação; registrar número; registrar competência; versionar alterações | Internação possui AIH controlada por status, número e competência |
| 2 | P0 | Críticas AIH configuráveis | Transformar avisos em críticas configuráveis; validar CID, SIGTAP (com versão da tabela registrada), idade, sexo, CNS, CBO; definir bloqueante/não bloqueante | Sistema aponta inconsistências antes de finalizar AIH |
| 3 | P0 | BPA individualizado inicial | Definir dados mínimos; mapear procedimento/profissional/CBO/CNES/CNS; gerar relatório/arquivo conforme escopo (layout do SIA/SUS vigente) | Unidade gera BPA-I básico validável |
| 4 | P1 | BPA consolidado | Mapear produção agregada; criar fechamento por competência; gerar saída; validar totais | Unidade gera BPA-C básico por competência |
| 5 | P1 | APAC MVP | Definir serviços alvo; criar entidade APAC; status; vínculo com paciente/procedimento; críticas básicas | APAC mínima funcional para escopo definido |
| 6 | P1 | Documentação API mínima | Definir recursos; criar OpenAPI/Swagger ou Markdown; documentar auth; exemplos; erros | Documento técnico de API disponível |
| 7 | P1 | API segura de pacientes/atendimentos/leitos | Criar endpoints/RPCs auditados; escopo por unidade; rate limit na borda; logs | Terceiro autorizado consulta pacientes/atendimentos/leitos com segurança |
| 8 | P1 | Checklist RNDS | Listar certificado, IP fixo, credenciamento, ambiente, chaves, testes; separar pendências externas | Documento RNDS pronto para execução quando credenciais chegarem |
| 9 | P2 | Exportação estruturada CSV/JSON | Definir datasets; pacientes, atendimentos, leitos, documentos; aplicar mascaramento quando necessário | Export estruturado disponível para admin autorizado |
| 10 | P2 | Playbook de implantação | Criar checklist de unidade; setores; leitos; usuários; escala; protocolos; medicamentos; treinamento | Implantação UPA/hospital pequeno tem roteiro padronizado |
| 11 | P2 | Standby em segunda região | Criar projeto Supabase em região secundária com replicação; definir critério de promoção (manual ou automática); criar runbook de failover e failback; executar simulado e medir RTO/RPO reais; sobe para P1 se contrato exigir | Simulado de failover documentado com RTO medido; runbook publicado; dados consistentes após failback |

**Decisões do RT para a Fase 3, tarefa 1 — ciclo da AIH (09/10/2026)**

- **Diagnóstico:** hoje a AIH é só o documento "laudo de AIH". Ele é versionado e numerado, e o cadastro bloqueia a emissão. As críticas SIGTAP (CID, sexo, idade, causa externa) são só avisos. Não há entidade AIH, status, número de 13 dígitos, competência nem quem aprove. Furo técnico: `emitir_documento` emite o laudo sem passar pelas faltas de cadastro (corrigir junto).
- **Quem decide:** o **médico regulador**, papel novo na unidade (`regulador`). Ele entra pela escala, como os outros papéis, e aprova (com o número da AIH) ou rejeita (com motivo). O médico que solicitou pode aprovar só se for regulador. Quem não é regulador nunca aprova. O papel fica para a Regulação da Fase 4.
- **AIH por internação:** uma ativa por vez. Rejeitada ou cancelada, abre-se outra. Continuidade e mudança de procedimento ficam para quando forem necessárias.
- **Competência:** o sistema sugere o mês da alta, ou o mês corrente com o paciente internado. O regulador confirma ou troca, e a troca fica registrada.
- **Número da AIH:** 13 dígitos. O dígito verificador só será conferido com fonte oficial do algoritmo. Sem ela, confere-se só o formato.

**Decisões do RT para a Fase 3, tarefa 2 — críticas da AIH configuráveis (09/10/2026)**

- **Quem configura:** o gestor da unidade marca cada crítica como bloqueante ou só aviso, com motivo e histórico. Sem configuração, vale o padrão do produto.
- **Onde bloqueia:** na emissão do laudo de AIH. O médico corrige na hora; o regulador recebe só laudos sem bloqueio e vê os avisos.
- **Padrão do produto, bloqueantes:**
  - CID principal inexistente;
  - procedimento fora do SIGTAP;
  - CID incompatível com o procedimento ou não aceito como principal;
  - sexo e idade fora do SIGTAP;
  - CNS com dígito verificador inválido;
  - lesão (S/T) sem CID de causa externa.
- **CBO:** campo novo no perfil do médico, pela lista oficial do CBO que já está na terminologia. A crítica confere se está preenchido e é válido.
- **Prazos, como alerta:**
  - AIH solicitada há mais de 72 h desde a internação, sem decisão: alerta na fila do regulador;
  - competência a mais de 3 meses da alta: alerta ao aprovar e ao ajustar.
  - Fonte: pesquisa do NIR, `produto/docs/pesquisa/nir-nucleo-interno-regulacao.md`.
- **SIGTAP:** cada AIH guarda a competência da tabela SIGTAP usada nas críticas. A tabela continua sendo atualizada à mão, pela administração. Quando ela estiver desatualizada há mais de 1 mês, aparece um aviso.
- **Guardar:** as críticas encontradas ficam registradas em cada AIH.

**Decisões do RT para a Fase 3, tarefa 3 — BPA individualizado (09/10/2026)**

- **O que entra:**
  - o atendimento médico na porta e a classificação de risco;
  - os procedimentos e as medicações. A medicação administrada na Checagem entra sozinha.
  - Cada atendimento ou procedimento recebe o código SIGTAP que a unidade associar, sempre conferido na tabela.
- **Quem registra os procedimentos:** os dois caminhos.
  - Quem fez registra na hora: enfermagem e médico, de uma lista curta da unidade.
  - O faturamento também lança depois, a partir do prontuário.
- **Saída:** arquivo no leiaute oficial do BPA Magnético, versão 05.00 do DATASUS (07/2026), com relatório de conferência por competência. A linha com crítica fica de fora e aparece para corrigir.
- **Quem fecha:** papel novo **faturamento** (sem escala), que também servirá ao BPA-C e à APAC. Ele fecha e reabre a competência com motivo.
- **CNES da unidade (RT, 10/10/2026):** cada unidade tem o seu, preenchido pelo gestor em Unidade › Configurações (7 dígitos, sem repetir entre unidades, com auditoria).
- **CNS do profissional:** campo no perfil, validado pelo dígito. Atendimento de quem não tem CNS vira pendência no fechamento.
- **Endereço do paciente:** campos estruturados na ficha da recepção (CEP, município com código IBGE, logradouro, número, bairro, nacionalidade e etnia). Não são obrigatórios para abrir a ficha. O que faltar vira pendência no fechamento.
- **Fontes:**
  - leiaute vigente em `produto/docs/pesquisa/bpa-leiaute-oficial/` (PDF e transcrição);
  - regras e códigos de UPA conferidos no SIGTAP em `produto/docs/pesquisa/bpa-i-leiaute-e-regras.md`.
- **Pontos a confirmar:**
  - INE: o leiaute marca como obrigatório, e a UPA não tem equipe;
  - tabelas de caráter do atendimento, nacionalidade e tipo de logradouro;
  - prazo de apresentação: a competência atual e as 3 anteriores (Portaria SAES 1.110/2021).

**Decisões do RT para a Fase 3, tarefa 4 — BPA consolidado (10/10/2026)**

- **O que vai no BPA-C:**
  - Tudo continua no BPA-I, como o DATASUS recomenda. Vai para o BPA-C só o que não fecha no BPA-I:
    - código que o SIGTAP aceita só em BPA-C;
    - linha sem identificação do paciente, com procedimento que aceita BPA-C.
  - A unidade também pode marcar um código para ir sempre no BPA-C.
- **Arquivo:** um só por competência, com as linhas "02" (BPA-C) e "03" (BPA-I). O cabeçalho e o campo de controle somam tudo. Um fechamento por competência.
- **SIGTAP completo:** carregar, do zip 202609 já baixado, estas tabelas:
  - instrumento de registro (`rl_procedimento_registro`: 01 BPA-C, 02 BPA-I);
  - CBO por procedimento (`rl_procedimento_ocupacao`);
  - quantidade máxima (`QT_MAXIMA_EXECUCAO`).
  A conferência passa a criticar CBO não aceito, instrumento errado e quantidade acima do máximo.
- **Valores do SIGTAP:** o importador gravava em centavos (R$ 11,00 ficava 1100). Corrigir junto com esta tarefa e recarregar os 3 bancos, depois de conferir onde o valor aparece na tela.

**Decisões do RT para a Fase 3, tarefa 5 — APAC (10/10/2026)**

- **Construir já, mesmo sem demanda agora:** as unidades de hoje (UPA e pronto-atendimento) quase não usam APAC, mas o RT quer tudo pronto.
- **Procedimentos:** só os que o SIGTAP registra em APAC (instrumento 06 principal e 07 secundário), com críticas de CID, sexo, idade, CBO e quantidade.
  - Alvo inicial: exames de alta complexidade, que usam o laudo geral (parte variável 06). Os outros laudos (oncologia, nefrologia, medicamentos, bariátrica, prótese) ficam para quando houver demanda.
- **Fluxo:**
  - quem solicita é o médico que atende;
  - quem autoriza é o médico regulador (mesmo papel da AIH), com número de 13 dígitos e validade, ou rejeita com motivo;
  - o faturamento registra a execução por competência (procedimentos, executante, motivo de saída), fecha a competência e gera o arquivo do APAC Magnético.
- **Leiaute:** `layout_Exportacao_APAC.pdf` (DATASUS, 08/07/2026), transcrito em `produto/docs/pesquisa/apac-leiaute-oficial/leiaute-apac.md`.
  - Ambiguidades a conferir no APAC Magnético: o campo de controle e a posição do fim de linha do laudo geral.
  - Tipo de atendimento, motivo de saída, órgão emissor e nacionalidade são códigos digitados, com a portaria indicada; nenhum valor foi inventado.
- **BPA Magnético e Firebird (10/10/2026):** cada secretaria instala e mantém o BPA Magnético e o Firebird. O Chefe Coruja entrega o arquivo no leiaute oficial. O Windows 11 bloqueia o Firebird 1.5 que o DATASUS distribui; o 2.5.9 (32 bits, com o `gds32.dll` de compatibilidade) é a alternativa conhecida.

**Decisões do RT para a Fase 3, tarefa 6 — documentação da API (10/10/2026)**

- **Para quem:**
  - integradores externos: secretaria, regulação, hospital parceiro, empresa contratada;
  - equipe interna: catálogo das RPCs que o frontend usa, gerado do banco.
- **Recursos da API pública** (o que a tarefa 7 constrói), só leitura e com escopo por unidade:
  - pacientes, atendimentos e leitos;
  - produção SUS: status, número e competência de AIH, BPA e APAC.
- **Acesso:** chave por integrador.
  - O administrador cria a chave, presa às unidades e aos recursos liberados.
  - A chave é guardada só como hash e pode ser revogada.
  - Todo acesso fica na auditoria.
  - Limite de requisições na borda (Cloudflare).
- **Dados do paciente (LGPD, o mínimo necessário):** nome, nome social, nascimento, sexo, CNS e município; CPF só sem CNS.
  - Ficam de fora: endereço, telefone, nome da mãe e dados clínicos, exceto a cor de risco, o CID e a situação do atendimento.
- **Endereço:** `api.chefecoruja.com.br/v1`, no Cloudflare, apontando para uma Edge Function do Supabase.
- **Formato:** OpenAPI 3.1 no repositório, validado no CI, mais uma página legível gerada dele para o integrador.

**Decisões do RT para a Fase 3, tarefa 7 — API segura (10/10/2026)**

- **Contrato:** `docs/api/openapi.yaml` (tarefa 6). Só leitura, por unidade, chave por integrador, dados mínimos do paciente.
- **Quem cria as chaves:** só o super admin da plataforma, escolhendo as unidades e os recursos. O gestor vê as chaves que acessam a unidade dele e pode revogar.
- **Validade:** 12 meses. O gestor recebe aviso 30 dias antes. Renovar é criar outra chave. A revogação é imediata, a qualquer hora.
- **Limite:** 60 consultas por minuto por chave, padrão que o super admin ajusta por chave. Há também um teto por IP na borda (Cloudflare).
- **IP de origem:** lista opcional por chave; vazia aceita qualquer IP.
- **Infraestrutura:**
  - Edge Function do Supabase atrás de `api.chefecoruja.com.br`.
  - O DNS e as regras do Cloudflare são da conta do RT: Claude prepara a configuração e o passo a passo, e o RT aplica.

**Decisões do RT para a Fase 3, tarefa 8 — checklist da RNDS (10/10/2026)**

- **Escopo:** quatro modelos.
  - RAC, para o atendimento na porta.
  - Sumário de Alta, para a internação.
  - RIA, para a unidade que vacina.
  - REL, para a unidade que faz exame laboratorial.
- **Saída com IP fixo:** o envio à RNDS sai pelo VPS que já existe (o da biblioteca), que faz o papel de intermediário com o certificado. Supabase e Vercel não têm IP de saída fixo.
- **Credencial:** cada gestor pede a credencial da sua unidade. O Chefe Coruja aparece como o sistema integrador. Não se pede uma credencial única para a rede.
- **Identificação:** segue a recomendação do DATASUS. Vai o CPF do paciente e do profissional; o CNS só entra quando falta o CPF.
- **Profissional sem CBO no CNES:** o sistema não envia em nome dele e avisa o gestor. A RNDS recusa esse envio (erro EHR-ERR906).
- **Documentos oficiais:** baixados com o ok do RT em 10/10/2026, para `produto/docs/pesquisa/rnds-oficial/`, com o SHA-256 de cada arquivo:
  - do RAC: manual de integração v2.0, manual de apoio às credenciais, mensagens de erro v3.0, modelo de informação, exemplos JSON e coleção do Postman;
  - do Sumário de Alta: manual, exemplo JSON, coleção do Postman e definições do validador.

**Decisões do RT para a Fase 3, tarefa 9 — exportação estruturada (10/10/2026)**

- **Quem exporta:** o gestor, só da sua unidade, e o super admin, de qualquer unidade. Toda exportação fica na auditoria: quem, quando, conjunto, período, filtros, formato, linhas e se saiu mascarada.
- **Conjuntos:**
  - atendimentos;
  - leitos e internações;
  - cadastro de pacientes;
  - lista de documentos (tipo, data, autor e versão, sem o texto clínico).
- **Dados que identificam o paciente** (nome, CPF, CNS, nascimento):
  - saem **mascarados por padrão**;
  - a versão completa exige motivo escrito (mínimo de 10 letras) e o código do segundo fator.
- **Formatos:**
  - CSV, com o padrão de `src/lib/csv.ts`;
  - JSON simples, com os mesmos campos e nomes do contrato da API v1.
- **Período:** até 12 meses por exportação.
- **Tela:** nova, "Exportar dados", no menu do gestor e do super admin.

**Andamento da Fase 3**

| Tarefa | Situação | Onde |
|---|---|---|
| 1 — Ciclo da AIH | **Em produção** (PR #62; roteiro rodado no app local em 10/10) | Branch `fase3/aih-ciclo`; migrations `20261102000001_papel_regulador.sql` e `20261102000002_aih_ciclo.sql`; teste `supabase/tests/fase3_aih_ciclo.sql`; tela `/aih` (médico regulador decide, gestor acompanha) e a situação da AIH na lista de laudos do médico |
| 2 — Críticas da AIH configuráveis | **Em produção** (PR #63; ok do RT em 10/10; roteiro rodado no app local) | Branch local `fase3/aih-criticas` (sobre a `fase3/aih-ciclo`); migration `20261102000003_aih_criticas.sql`; teste `supabase/tests/fase3_aih_criticas.sql`; cartão "Críticas da AIH" em Unidade › Configurações (gestor), CBO no perfil do médico, críticas no laudo e na fila do regulador |
| 3 — BPA individualizado | **Em produção** (10/10; migrations com o ok do RT; PRs #63–#65). Roteiro rodado no app local em 10/10. Falta só a importação do arquivo no BPA Magnético | Branch local `fase3/bpa-i` (sobre a `fase3/aih-criticas`); migrations `20261103000001_papel_faturamento.sql`, `20261103000002_bpa_i.sql` e `20261103000003_cnes_pelo_gestor.sql`; teste `supabase/tests/fase3_bpa_i.sql`; tela `/faturamento` (faturamento e gestor), aba Procedimentos no atendimento da porta, quadro na gaveta de cuidados da enfermagem, endereço do SUS na ficha, CNS e CBO no perfil; roteiro em `produto/docs/fase3/roteiro-teste-fase3.md` |
| 4 — BPA consolidado | **Em produção** (10/10; PR #67; migration e carga do SIGTAP aplicadas antes do merge, com ok do RT) | Branch `fase3/bpa-c`; migration `20261103000004_bpa_c.sql`; teste `supabase/tests/fase3_bpa_c.sql`. O SIGTAP passou a ter instrumento, CBO por procedimento e quantidade máxima (gerador `scripts/terminologia/gerar-sigtap-sql.ts`), e os valores foram corrigidos para reais. Na tela: destino de cada linha (BPA-I, BPA-C ou fora) com motivo, e "sempre BPA-C" por código |
| 5 — APAC | **Em produção** (10/10; PRs #69 e #70; migration aplicada antes do merge, com ok do RT; aba própria na internação) | Branch `fase3/apac`; migration `20261104000001_apac.sql`; teste `supabase/tests/fase3_apac.sql`; tela `/apac` (regulador, faturamento, gestor); solicitação no atendimento da porta (aba Procedimentos) e na internação (aba AIH); órgão emissor em Faturamento › Configuração |
| 6 — Documentação da API | **Pronta** (contrato v1 validado no CI) | Branch `fase3/api-doc`. `docs/api/openapi.yaml` (OpenAPI 3.1, validado por `npm run api:lint` no CI), `docs/api/index.html` (página para o integrador), `docs/api/catalogo-rpc.md` (485 RPCs internas, `npm run api:catalogo`) e `docs/api/README.md`. A implementação é a tarefa 7 |
| 7 — API segura | **Em produção** (10/10; PR #72): homologação testada de ponta a ponta com chave real; produção com migration, função e Cloudflare (Workers, DNS, WAF BR e rate limit) | Branch `fase3/api-segura`; migration `20261104000002_api_integradores.sql`; teste `supabase/tests/fase3_api_integradores.sql`; Edge Function `supabase/functions/api`; tela `/integracoes`; passo a passo `docs/api/implantacao.md`; Worker `infra/cloudflare/api-worker.js` |
| 8 — Checklist da RNDS | **Pronto** (10/10; PR #73): documento para executar quando as credenciais chegarem | Branch `fase3/checklist-rnds`; `docs/rnds/CHECKLIST.md` (portfólios, pendências externas e internas, formulário, IP, autenticação, evidência, divergências do código com o oficial, perguntas para o chamado); manuais oficiais em `produto/docs/pesquisa/rnds-oficial/` |
| 9 — Exportação estruturada | **Em produção** (10/10; testada pelo RT na homologação; migrations `20261105000001` e `20261105000002` aplicadas na produção antes do merge, com ok do RT) | Branch `fase3/exportacao`; migration `20261105000001_exportacao_estruturada.sql`; teste `supabase/tests/fase3_exportacao.sql` (39 OK); `src/lib/exportacao.ts` (+ teste); tela `/exportar` (gestor e super admin); a confirmação da versão completa usa o código digitado (nova coluna `codigo_em`), não o dispositivo confiável; roteiro em `produto/docs/fase3/roteiro-teste-fase3.md`. Ajustes do teste do RT (10/10): datas do CSV no formato pt-BR e no fuso local; desfecho "observacao" e "cancelado" com o próprio nome (antes saíam como "internacao" e "outro", também na API) e `desfecho_em` com o encerramento quando falta (migration `20261105000002`) |
| 10 — Playbook de implantação | **Em produção** (10/10; homologação testada pelo RT; migration `20261106000001` aplicada na produção antes do merge, com ok do RT) | Branch `fase3/implantacao`; roteiro `docs/implantacao/PLAYBOOK.md` e seis roteiros de treinamento em `docs/implantacao/treinamento/`; migration `20261106000001_implantacao.sql`; teste `supabase/tests/fase3_implantacao.sql` (36 OK); `src/lib/implantacao.ts` (+ teste); tela `/implantacao` (implantador e gestor) com itens por fase, conferências automáticas, treinamento e aceite conjunto |
| 11 — Standby em segunda região | **Aguardando contrato** (decisão do RT em 10/10/2026). Não entra até um contrato exigir; aí sobe para P1. Tem custo mensal: um segundo projeto no Supabase, mais a replicação | Nada construído. Quando entrar: projeto Supabase noutra região com replicação, critério de promoção, runbook de failover e de failback, simulado com RTO e RPO medidos |

**Ordem técnica da Fase 3**
1. Modelar AIH completa.
2. Implementar críticas.
3. Criar BPA-I.
4. Criar BPA-C.
5. Avaliar APAC por demanda.
6. Documentar API.
7. Criar endpoints seguros.
8. Preparar RNDS.
9. Standby regional conforme demanda contratual.

---

## Fase 4 — Regulação MVP e Plataforma de Rede
**Encerrada em 11/10/2026** por decisão do RT. As 12 tarefas estão em produção. Evidências em `produto/docs/fase4/ENCERRAMENTO-FASE4.md`. A Fase 5 ainda não foi aberta: começa quando o RT mandar.
**Horizonte:** 120-180 dias
**Objetivo:** criar diferencial estratégico de rede, sem tentar fazer UBS completa ainda.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P0 | Solicitação de regulação | Criar entidade; tipos: consulta, exame, leito, transferência; origem; destino desejado; prioridade; justificativa clínica | Unidade consegue abrir solicitação regulada |
| 2 | P0 | Fila regulada | Criar painel do regulador; filtrar por tipo, prioridade, unidade, status; ordenar por prioridade/SLA | Regulador vê e ordena solicitações |
| 3 | P0 | Priorização clínica | Definir critérios; permitir alteração pelo regulador; exigir motivo; auditar mudança | Prioridade pode ser definida/revisada com justificativa |
| 4 | P0 | Aceite, recusa e devolução | Criar ações; exigir justificativa; notificar unidade solicitante; registrar histórico | Solicitação pode ser aceita, recusada ou devolvida com rastreabilidade |
| 5 | P0 | Histórico no prontuário | Vincular regulação ao paciente; exibir no PEP; registrar acesso | Médico vê histórico regulatório do paciente |
| 6 | P1 | Anexos e laudos | Permitir anexos; controlar acesso; auditar visualização/download | Solicitação contém documentos clínicos de apoio |
| 7 | P1 | Painel de SLA | Calcular tempo por status; alertar atrasadas; filtrar por prioridade e tipo | Regulador vê solicitações fora do prazo |
| 8 | P1 | Mapa simples de vagas/disponibilidade | Integrar leitos livres/reservados; permitir disponibilidade manual de serviços; mostrar por unidade | Regulador vê disponibilidade básica |
| 9 | P1 | Aceite pela unidade destino | Criar papel/permissão da unidade destino; permitir aceitar/negar; registrar data/hora | Destino participa do fluxo formalmente |
| 10 | P2 | Indicadores de regulação | Tempo médio, fila por tipo, taxa de devolução, gargalos | Dashboard de regulação disponível |
| 11 | P1 (definida em 11/10/2026) | NIR — Núcleo Interno de Regulação (pedido do RT em 09/10/2026) | Função administrativa "NIR": acompanha as regulações da unidade e os documentos em falta (laudos de AIH pendentes, AIH solicitada sem decisão, rejeitada sem nova, documentos clínicos com falta). Definir: papel próprio ou permissão, o que vê, o que cobra de quem e como avisa | NIR vê, num painel, as regulações e os documentos em falta da unidade e cobra os responsáveis |
| 12 | P1 (definida em 11/10/2026) | Papéis de rede como módulo (pedido do RT em 10/10/2026) | Papéis para fora da unidade: Secretaria (acompanha a rede), Regulação regional e Faturamento da secretaria. O super admin tem o módulo; o gestor decide se a rede dele usa ou não. Definir: o que cada papel vê (só agregados ou também paciente), a quais unidades tem acesso e como se liga à escala. Até lá, integração externa usa as chaves da API (tarefa 7 da Fase 3) | Papéis de rede ligados ou desligados pelo gestor, com escopo de unidades e auditoria |

**Decisões do RT para a Fase 4, tarefa 1 — solicitação de regulação (10/10/2026)**

- **Quem regula:** a Central de Regulação da rede. Ela é cadastrada pelo super admin como uma unidade do tipo central, dentro da organização. Os médicos reguladores ficam vinculados a ela. A central recebe as solicitações de todas as unidades da organização.
- **Quem abre:**
  - o médico que cuida do paciente;
  - o gestor ou NIR da unidade, que pode enviar direto com a justificativa. Nesse caso, o médico assistente fica só informado.
  - O autor é sempre quem está logado.
- **Destino:**
  - uma unidade da rede Chefe Coruja;
  - um serviço de fora da rede, escrito;
  - ou "a definir pela regulação".
- **Tipos:**
  - consulta, por especialidade;
  - exame, por procedimento do SIGTAP;
  - leito, com o tipo: enfermaria, UTI adulto, UTI pediátrica, UTI neonatal, semi-intensiva, isolamento etc.;
  - transferência, com o tipo de transporte.
- **Prioridade:** quatro níveis (emergência, urgência, prioridade não urgente e eletivo). O solicitante propõe; o regulador revisa com motivo, na tarefa 3.
- **Justificativa clínica:** texto livre e CID.
- **Vínculo:** pode ser ligada a um atendimento ou a uma internação aberta, ou só ao paciente cadastrado (por exemplo, consulta eletiva).
- **Regulação externa:** sem integração agora. A central anota o sistema externo (SISREG, e-SUS Regulação, central estadual) e o número do protocolo. A integração fica para a Fase 5C, conforme as credenciais.

**Revisão das decisões da tarefa 1 depois da pesquisa dos sistemas de regulação (RT, 11/10/2026)**

Pesquisa em `produto/docs/pesquisa/regulacao-modelos-sistemas.md`. Ela cobre SISREG, e-SUS Regulação, CROSS, SUSfácil, GERCON/GERINT, centrais estaduais de leitos, NIR e o SERVIR de Goiás. Em Goiás, o SERVIR está sendo trocado pelo GERINT desde 11/2024. A Portaria GM/MS 9.262/2025 (Política Nacional de Regulação) exige que todo sistema de regulação, inclusive um sistema próprio, tenha no mínimo os campos do MIRA e os envie à RNDS.

- **Campos do MIRA, todos obrigatórios:**
  - CNS ou CPF do paciente (o paciente não identificado fica marcado);
  - CNES da unidade solicitante;
  - procedimento do SIGTAP em **todos** os tipos (no leito, o procedimento da AIH);
  - CBO na consulta;
  - caráter (eletivo ou urgência), novo e separado da prioridade;
  - CID-10;
  - modalidade assistencial, derivada do tipo e do caráter.
- **Prioridade:** os 4 níveis, mais "não classificada". A prioridade da central é guardada à parte, como veio. Nada é automático.
- **Justificativa em blocos:** o quadro clínico, com o tempo de evolução, é obrigatório. Sinais vitais com hora, exames com data, medicações em uso e hipótese são opcionais. Na criança, a PA não é obrigatória. Isso substitui a decisão de 10/10 de usar só texto e CID.
- **Leitos:** clínico, cirúrgico, pediátrico, obstétrico, psiquiátrico (com o tipo de internação: voluntária, involuntária ou compulsória), UTI adulto, pediátrica e neonatal, UCI adulto, pediátrica e neonatal, UTI de queimados, unidade coronariana e outro. O isolamento passa a ser atributo do pedido: sim ou não, e o tipo (contato, gotícula ou aerossol).
- **Status:** rascunho, enviada, em análise, pendência, devolvida, autorizada, agendada, em trânsito, realizada, falta, negada, cancelada (com quem cancelou) e excluída.
- **Transporte:**
  - tipos: transporte sanitário (A), básica (B), avançada (D, que é o mesmo que "UTI móvel"), aéreo (E), embarcação (F) e meios próprios;
  - campo à parte para o transporte definido pela central;
  - incubadora no recém-nascido.
- **Duplicidade:** pedido aberto para o mesmo paciente e o mesmo procedimento ou tipo de leito gera aviso, sem bloquear.
- **Ficam para as próximas tarefas:**
  - relógios de 12 h, 3 h e 72 h, na tarefa 7 (SLA);
  - consentimento e documento de transferência;
  - blocos obstétrico e de judicialização.
- **Envio à RNDS no formato MIRA:** a tarefa 1 já guarda os dados. O envio entra como item da Fase 5C.

**Decisões do RT para a Fase 4, tarefa 2 — fila regulada (11/10/2026)**

- **Ordem:** por prioridade (emergência, urgência, prioritária e eletiva). Dentro de cada nível, quem espera há mais tempo vem primeiro. Os pedidos "não classificada" aparecem em destaque no topo, para o regulador classificar.
- **Assumir:** o regulador clica em "Assumir" e o pedido passa a "em análise" com o nome dele. Os outros reguladores veem quem está com o pedido. Ele pode devolver o pedido à fila. Tudo fica no histórico.
- **Filtros:**
  - os do BACKLOG: tipo, prioridade, unidade de origem e status;
  - os clínicos: caráter, tipo de leito e isolamento;
  - busca por nome do paciente, nº da solicitação ou protocolo externo.
- **Atualização:** automática a cada 30 s, com destaque para o que chegou e o tempo de espera ao vivo.

**Decisões do RT para a Fase 4, tarefa 3 — priorização clínica (11/10/2026)**

- **Prioridade do regulador:** guardada à parte da proposta do solicitante, com quem, quando e motivo. A fila passa a ordenar por ela quando existir. Toda mudança fica no histórico.
- **Critérios:** cada nível (emergência, urgência, prioritária e eletiva) tem uma descrição do que cabe nele. A central escreve e edita esses textos, e eles aparecem para o solicitante e para o regulador. O sistema não sugere o nível.
- **Vulnerabilidade:** a Portaria GM/MS 9.262/2025 manda considerar risco, tempo e vulnerabilidade.
  - O solicitante marca os marcadores: gestante, idoso (60 anos ou mais), criança, pessoa com deficiência, situação de rua, paciente oncológico e caso judicializado.
  - Eles aparecem como selos na fila e no detalhe, sem pontuação. O regulador decide.
- **A origem fica sabendo** pela lista e pelo histórico: a solicitação mostra a prioridade do regulador e o motivo. Os avisos ativos entram na tarefa 4.

**Decisões do RT para a Fase 4, tarefa 4 — aceite, recusa e devolução (11/10/2026)**

- **Decisões do regulador:**
  - **autorizar**: a vaga fica reservada ou o procedimento autorizado. Só o destino é obrigatório (unidade da rede ou serviço de fora). Transporte, data e hora e observação são opcionais. O aceite da unidade de destino é a tarefa 9;
  - **negar**, com motivo de uma lista (sem indicação clínica, sem oferta na rede, fora do escopo da central, duplicidade, paciente já atendido ou óbito, outro) e texto obrigatório;
  - **devolver à origem** para corrigir e reenviar. No reenvio, o pedido **mantém a posição** na fila: a espera conta desde o pedido original;
  - **pendência**: uma pergunta à origem sem tirar o pedido da fila. A origem responde e o pedido segue.
- **Quem responde na origem:** o solicitante, o médico assistente ou o gestor, sempre com o próprio login.
- **Avisos:** cada decisão gera um aviso na tela "Avisos" para o solicitante e para o médico assistente. Vale para autorizada, negada, devolvida, pendência e mudança de prioridade. Sem WhatsApp por enquanto.

**Decisões do RT para a Fase 4, tarefa 5 — histórico no prontuário (11/10/2026)**

- **Onde:** no Resumo do leito da internação e no "Prontuário completo".
- **Alcance:** pedidos de **toda a rede**. Os pedidos do mesmo paciente em outras unidades da organização entram juntos, ligados pelo CPF ou CNS válido.
  - Isso compartilha dados clínicos entre unidades da rede.
  - O acesso ao detalhe de um pedido de outra unidade fica no registro de acesso daquela unidade, à vista do gestor dela.
- **Quem vê:** só o médico e o gestor da unidade. A enfermagem não vê.
- **Registro:** a lista (nº, data, unidade, tipo, prioridade, status e destino) não registra acesso. Abrir o detalhe grava no registro de acesso ao prontuário, que aparece na Auditoria do gestor.

**Decisões do RT para a Fase 4, tarefa 6 — anexos e laudos (11/10/2026)**

- **Arquivos:**
  - PDF, JPG e PNG, até 10 MB cada, sem teto de anexos por pedido (revisto pelo RT no teste da homologação, 11/10: há paciente que pede muitos envios e outro que não pede nenhum);
  - ficam em área privada, e abrir gera um link temporário de 60 segundos.
- **Do prontuário:** também se anexa um documento já emitido no prontuário do paciente, sem imprimir nem escanear. A central vê a versão anexada.
- **Quem anexa, com o pedido em aberto:**
  - na origem: o solicitante, o médico assistente e o gestor;
  - na central: o regulador.
- **Retirar:** um anexo enviado por engano sai da lista com motivo, mas continua guardado (guarda do prontuário). Quem retirou e o motivo ficam na auditoria.
- **Quem abre e baixa:** quem vê o pedido (a origem e a central) e, pelo histórico do prontuário, o médico e o gestor. Toda visualização ou download fica no registro de acesso.
- **Ajuste do teste na homologação (11/10/2026):**
  - os anexos (arquivos e documentos do prontuário) já se escolhem na nova solicitação e sobem logo depois do envio;
  - o que não subir fica avisado e pode ir pelo detalhe do pedido;
  - na lista, cada pedido mostra que abre (seta e "Ver detalhes"), e o pedido recém-enviado já aparece aberto.

**Decisões do RT para a Fase 4, tarefa 7 — painel de SLA (11/10/2026)**

- **Relógios:**
  - na origem, os três da pesquisa, só como alerta e sem ação automática: evolução do pedido a cada 12 h, resposta à pendência da central em 3 h e 72 h sem evolução (fontes: Nota Técnica SES-MG 15/2008 e Deliberação CIB-SP 35/2022, em `produto/docs/pesquisa/regulacao-modelos-sistemas.md`);
  - na central, o tempo do pedido esperando decisão, com prazo por nível de prioridade;
  - o detalhe do pedido mostra o tempo gasto em cada status.
- **Tipos:** 12 h e 72 h valem para leito e transferência, como nas fontes. As 3 h da pendência valem para todos os tipos.
- **Prazo da fila por prioridade:** não há regra nacional. Cada central cadastra o prazo de cada nível. Começa vazio, e um nível sem prazo só mostra o tempo de espera.
- **Valores dos relógios da origem:** começam em 12 h, 3 h e 72 h. A central ajusta para a rede inteira, junto com o prazo da fila, e a mudança fica auditada.
- **Pausa:** o prazo da fila conta só o tempo com a central. Com o pedido em pendência ou devolvido, corre o relógio de 3 h da origem.
- **Atualizar evolução:** ação nova no detalhe do pedido para a origem (solicitante, médico assistente e gestor): texto da evolução e sinais vitais opcionais. Fica no histórico, a central vê e o relógio de 12 h e 72 h recomeça.
- **Alerta:**
  - selo "atrasado" na fila e no painel;
  - aviso na categoria Regulação para quem deve agir: a origem (solicitante e médico assistente) nos relógios dela, os reguladores no prazo da fila.
- **Quem vê o painel:** o regulador vê todos os pedidos da rede; a origem (médico e gestor) vê os da própria unidade, com o que está atrasado do lado dela.

**Decisões do RT para a Fase 4, tarefa 8 — mapa simples de vagas (11/10/2026)**

- **Tipo de leito:** o gestor da unidade marca cada setor ofertado à regulação com um tipo da lista da regulação (por exemplo, UTI adulto, clínico, pediátrico). Setor não marcado não aparece no mapa: porta, sala vermelha e observação da UPA ficam de fora se o gestor não marcar.
- **Leitos:** vêm do mapa de leitos em tempo real, sem digitação. O mapa mostra livre (a vaga), reservado, em higienização (vaga em breve), bloqueado e ocupado, com o total, por unidade e por tipo.
- **Serviços (disponibilidade manual):**
  - o gestor cadastra os serviços da unidade (por exemplo, tomografia, hemodinâmica, consulta de cardiologia), com tipo e procedimento SIGTAP opcional;
  - marca a situação: disponível, restrito ou indisponível, com vagas opcionais e observação;
  - fica a hora e o autor de cada atualização;
  - depois de 12 h sem confirmar, o serviço aparece como "desatualizado"; "Confirmar" renova sem mudar a situação.
- **Quem vê:** o regulador e o gestor da central veem a rede inteira. O gestor da unidade vê a rede e edita os serviços da própria unidade. Só números, sem nome de paciente.
- **Ação:** o mapa é só consulta. A reserva do leito e o aceite ficam com a unidade destino (tarefa 9). Ao autorizar um pedido, o regulador vê o mapa ao lado para escolher o destino.

**Decisões do RT para a Fase 4, tarefa 9 — aceite pela unidade destino (11/10/2026)**

- **Fluxo:** como nos sistemas pesquisados (SUSfácil, CROSS, SISREG), a central autoriza para uma unidade da rede e o pedido fica "aguardando o destino". O destino aceita ("reserva confirmada") ou recusa com motivo. Na recusa, o pedido volta à fila da central, com o motivo, para a escolha de outro destino.
- **Quem responde pelo destino:** o médico plantonista e o gestor da unidade destino. O autor (com o CRM, no caso do médico) e a hora ficam no histórico. O papel NIR fica para a tarefa 11.
- **Reserva:** no pedido de leito, quem aceita escolhe um leito livre do destino, que fica reservado para o pedido pela reserva que o mapa de leitos já tem e aparece como reservado no mapa de vagas.
- **Prazo de resposta:** 24 h, só como alerta, nos relógios da tarefa 7; a central ajusta. Vencido, avisa o destino e a central. Nada é automático. (A Deliberação CIB-SP 35/2022 usa 60 min com destinação automática; o RT escolheu 24 h e sem ação automática.)
- **Recusa:** lista curta (sem leito ou vaga; sem o recurso ou a especialidade; perfil clínico fora do serviço; outro) e texto obrigatório, que a central e a origem veem.
- **Chegada:** a origem marca "saiu" (em trânsito); o destino marca "chegou" (realizada, e a reserva fica pronta para ocupar o leito) ou "não chegou" (falta), com a hora.
- **Destino fora da rede:** a central registra o aceite ou a recusa do serviço externo, com o nome de quem confirmou, a hora e o meio (telefone, sistema externo).
- **Avisos (categoria Regulação):** o destino (médicos e gestor) recebe "pedido aguardando aceite"; a origem (solicitante e médico assistente) e o regulador recebem o aceite ou a recusa.

**Decisões do RT para a Fase 4, tarefas 10, 11 e 12 (11/10/2026)**

**Ordem de construção:** 12, depois 11, depois 10. A tarefa 12 define o acesso de rede que a 11 (papel NIR) e a 10 (quem vê os indicadores) usam. As perguntas das três foram feitas juntas; cada uma continua com branch, PR, homologação e "ok produção" próprios.

**Tarefa 12 — papéis de rede como módulo**

- **Papéis:** Secretaria (gestão da rede), Regulação regional e Faturamento da secretaria.
- **Quem liga e quem libera:** o super admin liga o módulo na organização e cadastra as pessoas de rede. O gestor de cada unidade decide se a unidade dele entra (ou sai) do alcance dos papéis de rede. Tudo auditado.
- **O que veem:**
  - Secretaria: só agregados (números, gráficos, mapa de vagas, prazos), sem nome nem prontuário;
  - Regulação regional: também a lista nominal dos pedidos de regulação, só leitura, com o acesso registrado;
  - Faturamento da secretaria: produção consolidada por unidade e competência e os arquivos já gerados (BPA, AIH, APAC), só leitura; não edita nem gera lote; sem prontuário.
- **Escala:** regra geral do RT: todo mundo tem escala, menos o administrador e o gestor. Os papéis de rede ficam vinculados e escalados numa unidade administrativa "Secretaria", que o super admin cadastra na organização (como a central). O alcance vem das unidades que os gestores liberaram.

**Tarefa 11 — NIR (Núcleo Interno de Regulação)**

- **Papel próprio "NIR"** na unidade, dado pelo gestor, com escala como os outros papéis. Sem acesso clínico além do que a função precisa.
- **Na regulação, operacional, sem ato médico:** abre pedido (como NIR, com o médico assistente), anexa documentos, responde pendência administrativa e marca saída e chegada. Aceite ou recusa como destino e evolução clínica ficam com médico e gestor.
- **Painel de pendências da unidade:**
  - AIH: laudo pendente, solicitada sem decisão, rejeitada sem nova solicitação;
  - regulações com prazo vencido: pendência sem resposta, evolução vencida, destino sem resposta, chegada sem registro;
  - APAC: pendente de autorização ou rejeitada sem nova.
- **Cobrança:** cada pendência mostra o responsável e o tempo parado; o botão "Cobrar" manda aviso ao responsável (na categoria do assunto nos Avisos) e fica registrado quem cobrou e quando.

**Tarefa 10 — indicadores de regulação**

- **Indicadores:**
  - tempos: até a decisão da central (só o tempo com ela), até o aceite do destino e até a chegada, por prioridade e tipo;
  - fila atual por tipo e prioridade; pedidos por período, origem e destino;
  - desfechos: taxas de autorização, negação (por motivo), devolução, recusa do destino (por motivo), cancelamento e falta;
  - cumprimento dos prazos (fila, pendência, evolução, destino) e gargalos por unidade, tipo de leito e motivo.
- **Medida dos tempos:** mediana e percentil 90 (a média distorce com poucos casos longos).
- **Onde e quem vê:** aba "Indicadores" na tela Regulação, com filtros de período, tipo, prioridade, origem e destino. A central e a Secretaria/Regulação regional veem a rede; o gestor vê a unidade dele como origem e como destino. Só números; exporta CSV como na Fase 3.

**Andamento da Fase 4**

| Tarefa | Situação | Onde |
|---|---|---|
| 1 — Solicitação de regulação | **Em produção** (11/10; migration aplicada na produção antes do merge, com ok do RT). O PR #78 tinha entrado antes da hora e foi revertido (PR #80); a tarefa voltou com o modelo revisto pela pesquisa | Branch `fase4/regulacao-solicitacao`; migration `20261107000001_regulacao_solicitacao.sql`; teste `supabase/tests/fase4_regulacao_solicitacao.sql` (40 OK); `src/lib/regulacao.ts` (+ teste); tela `/regulacao` (origem, central e super admin); pesquisa em `produto/docs/pesquisa/regulacao-modelos-sistemas.md` |
| 2 — Fila regulada | **Em produção** (11/10; migration `20261108000001` aplicada na produção antes do merge, com ok do RT) | Branch `fase4/fila-regulada`; migration `20261108000001_fila_regulada.sql`; teste `supabase/tests/fase4_fila_regulada.sql` (26 OK); fila na tela `/regulacao` da central. O regulador da central entra pela escala, como os outros papéis: a central precisa de um setor (ex.: "Regulação") e dos plantões dos reguladores |
| 3 — Priorização clínica | **Em produção** (11/10; migration `20261109000001` aplicada na produção antes do merge, com ok do RT) | Branch `fase4/priorizacao`; migration `20261109000001_priorizacao_regulacao.sql`; teste `supabase/tests/fase4_priorizacao.sql` (19 OK); na tela `/regulacao`: "Definir prioridade" no detalhe (regulador), selo da prioridade efetiva com a proposta ao lado, marcadores de vulnerabilidade na solicitação e na fila, e o cartão "Critérios de prioridade da central" |
| 4 — Aceite, recusa e devolução | **Em produção** (11/10; migration `20261110000001` aplicada na produção antes do merge, com ok do RT) | Branch `fase4/decisao-regulacao`; migration `20261110000001_decisao_regulacao.sql`; teste `supabase/tests/fase4_decisao_regulacao.sql` (34 OK); na tela `/regulacao`: painel "Decisão da central" (autorizar, pergunta à origem, devolver, negar), resposta e "Corrigir e reenviar" na origem, e a categoria "Regulação" nos Avisos |
| 5 — Histórico no prontuário | **Em produção** (11/10; migration `20261111000001` aplicada na produção antes do merge, com ok do RT). Com ela, os P0 da Fase 4 estão concluídos | Branch `fase4/historico-regulacao`; migration `20261111000001_historico_regulacao.sql`; teste `supabase/tests/fase4_historico_regulacao.sql` (12 OK); cartão "Regulações" (`src/components/regulacao/HistoricoRegulacao.tsx`) no Resumo do leito e no Prontuário completo, com os pedidos da rede (CPF/CNS e cadastro unificado), só para médico e gestor; abrir o detalhe registra o acesso na unidade do pedido |
| 6 — Anexos e laudos | **Em produção** (11/10; migrations `20261112000001`, `20261112000002` e `20261112000003` aplicadas na produção antes do merge, com ok do RT). No teste da homologação o RT pediu anexar já na nova solicitação e tirar o teto de anexos | Branch `fase4/anexos-regulacao`; migrations `20261112000001_anexos_regulacao.sql` (bucket privado `regulacao`), `20261112000002_anexos_no_pedido.sql` (documentos do paciente para a nova solicitação) e `20261112000003_anexos_sem_teto.sql` (tira o teto de 10 anexos); teste `supabase/tests/fase4_anexos_regulacao.sql` (27 OK); `src/components/regulacao/AnexosRegulacao.tsx` no detalhe do pedido e no histórico do prontuário. O arquivo só fica legível depois de "abrir", que registra o acesso e libera a leitura por 2 min. No local, o envio de arquivo falha para qualquer bucket (o esquema de armazenamento é mais novo que o serviço local): o envio de verdade se confere na homologação |
| 7 — Painel de SLA | **Em produção** (11/10; migration `20261113000001` aplicada na produção antes do merge, com ok do RT; job `regulacao-sla-avisos` ativo) | Branch `fase4/sla-regulacao`; migration `20261113000001_sla_regulacao.sql` (prazos da central com histórico de ajustes, tempo em cada status, evoluções do pedido, painel `regulacao_sla_painel` e job `regulacao-sla-avisos` a cada 15 min, que avisa uma vez por dia e por relógio); teste `supabase/tests/fase4_sla_regulacao.sql` (32 OK); `src/components/regulacao/SlaRegulacao.tsx` (painel na central e na origem, prazos da central, selos na fila e na lista, tempo por status e "Atualizar evolução" no detalhe). Os relógios de 12 h e 72 h correm enquanto o pedido espera decisão (enviada, em análise, pendência, devolvida). Pedidos anteriores à migration têm o tempo por status aproximado pelas datas que já guardavam |
| 8 — Mapa simples de vagas | **Em produção** (11/10; migration `20261114000001` aplicada na produção antes do merge, com ok do RT) | Branch `fase4/mapa-vagas`; migration `20261114000001_mapa_vagas.sql` (tipo de leito da regulação no setor, serviços da unidade com histórico, `regulacao_mapa_vagas`); teste `supabase/tests/fase4_mapa_vagas.sql` (24 OK); `src/components/regulacao/MapaVagas.tsx` (mapa na central, para o gestor da unidade e ao lado da autorização; "Setores ofertados à regulação" e serviços para o gestor da unidade) |
| 9 — Aceite pela unidade destino | **Em produção** (11/10; migration `20261115000001` aplicada na produção antes do merge, com ok do RT; testado na homologação com o Hospital de Referência como destino) | Branch `fase4/aceite-destino`; migration `20261115000001_aceite_destino.sql` (status "aguardando o destino", respostas do destino com histórico, reserva do leito no aceite, saída, chegada e falta, prazo de 24 h nos relógios, resposta do serviço de fora pela central); teste `supabase/tests/fase4_aceite_destino.sql` (30 OK) e ajuste em `fase4_decisao_regulacao.sql` (autorizar agora espera o destino); `src/components/regulacao/DestinoRegulacao.tsx` ("Recebidos da central" na unidade, aceite e recusa, chegada, "Paciente saiu" na origem, resposta do serviço de fora na central). A reserva do leito vale 24 h, ou até 8 h depois da data prevista, e é estendida por 8 h na saída e na chegada. A origem pode cancelar também esperando o destino ou a chegada; a reserva é liberada e o destino avisado |
| 12 — Papéis de rede como módulo | **Em produção** (11/10; migrations `20261116000001` e `20261116000002` aplicadas na produção antes do merge, com ok do RT; o módulo começa desligado em todas as organizações) | Branch `fase4/papeis-rede`; migrations `20261116000001_papeis_rede_enum.sql` (papéis secretaria, regulacao_regional, faturamento_rede) e `20261116000002_papeis_rede.sql` (módulo por organização com a unidade Secretaria, liberação por unidade pelo gestor com histórico, papel de rede só na Secretaria e convite só pelo super admin, escala obrigatória, resumo da regulação, lista nominal e detalhe da Regulação regional com acesso registrado, produção e arquivos fechados para o Faturamento da secretaria, mapa de vagas das liberadas); teste `supabase/tests/fase4_papeis_rede.sql` (27 OK); tela `/rede` (`src/pages/rede/Rede.tsx`) e aba Unidade → Rede para o gestor (`src/components/rede/LiberacaoRede.tsx`). Pendência anotada: o papel Faturamento da unidade hoje entra sem escala; pela regra geral do RT (só administrador e gestor sem escala) ele passa a ter escala, a fazer em tarefa própria |
| 11 — NIR | **Em produção** (11/10; migrations `20261117000001` e `20261117000002` aplicadas na produção antes do merge, com ok do RT; antes, conferido que as funções reescritas eram iguais às da produção) | Branch `fase4/nir`; migrations `20261117000001_nir_enum.sql` (papel nir) e `20261117000002_nir.sql` (o NIR abre pedido com o médico assistente, anexa, responde pendência, marca saída e chegada; não evolui, não corrige o devolvido, não cancela, não aceita como destino; painel `nir_pendencias` e `nir_cobrar` com registro em `nir_cobrancas`); teste `supabase/tests/fase4_nir.sql` (21 OK) e mensagens de erro atualizadas em três testes da regulação; tela `/nir` (`src/pages/nir/Nir.tsx`, `src/lib/nir.ts` + teste) para o NIR e o gestor, categorias AIH e APAC nos Avisos, NIR nos convites e na escala. "Internação sem AIH" vale para internação aberta que não é de observação; o responsável é o médico no plantão do setor (sem ninguém escalado, os médicos da unidade). "Chegada sem registro" lista todo pedido em trânsito para a unidade, com o tempo desde a saída, sem prazo fixo |
| 10 — Indicadores de regulação | **Em produção** (11/10; migration `20261118000001` aplicada na produção antes do merge, com ok do RT) | Branch `fase4/indicadores-regulacao`; migration `20261118000001_indicadores_regulacao.sql` (`regulacao_indicadores`: tempos em mediana e p90 até a decisão, o aceite e a chegada, fila atual, volume, desfechos e motivos, cumprimento dos prazos e gargalos; escopo da central, dos papéis de rede e do gestor); teste `supabase/tests/fase4_indicadores_regulacao.sql` (15 OK); aba Indicadores na tela Regulação e na tela Rede (`src/components/regulacao/IndicadoresRegulacao.tsx`, `src/lib/indicadoresRegulacao.ts` + teste), com exportação CSV. O cumprimento da evolução mede o maior intervalo entre evoluções enquanto o pedido esperava decisão |

**Ordem técnica da Fase 4**
1. Criar modelo de dados de regulação.
2. Criar solicitações.
3. Criar fila do regulador.
4. Criar ações de decisão.
5. Integrar ao PEP.
6. Integrar anexos.
7. Integrar vagas/leitos.
8. Criar indicadores.

---

## Portão antes da Fase 5 — teste de ponta a ponta do fluxo assistencial

**Pedido do RT em 11/10/2026.** A Fase 5 só abre depois deste teste e da decisão do RT sobre as correções.

- **Escopo:** fluxo assistencial completo (recepção, triagem, atendimento, observação, internação, regulação, transferência, enfermagem, técnico, farmácia, gestor) com uma coorte de 15 pacientes simulados, permissões negativas, auditoria, concorrência, datas, casos-limite de cadastro, documentos, notificações, evasão e alta a pedido, passagem de plantão, rascunhos, celular, desempenho e Hermes. Nenhuma feature nova.
- **Ambiente (decisão do RT):** o teste roda no ambiente local (banco isolado, mesmas migrations), com uma conta de teste por papel e pelas telas e pelo banco. Os scripts ficam prontos para o RT repetir a coorte na homologação a cada release.
- **Hermes:** só é testado se houver um gateway de teste; casos simulados não vão para o serviço da produção.
- **Regra:** nada é corrigido durante o teste. Primeiro o relatório; o RT decide a ordem das correções.
- **Entregáveis:** `produto/docs/teste-e2e/RELATORIO_E2E_AAAA-MM-DD.md` (defeitos por severidade, lacunas, cobertura), scripts e seeds reutilizáveis e as perguntas de produto para o RT.

**Teste feito em 11/10/2026.** Relatório: `produto/docs/teste-e2e/RELATORIO_E2E_2026-10-11.md`; scripts: `scripts/e2e/`. Resultado: 340 passos, nenhum P0, 5 defeitos P1, 5 defeitos P2, 12 lacunas e 8 perguntas de produto.

### Correções do portão — ordem aprovada pelo RT em 11/10/2026

Uma tarefa por vez, cada uma em branch e PR próprios, com homologação antes da produção. A Fase 5 só abre depois da última.

| # | Defeitos | Tarefa | Critério de aceite |
|---|---|---|---|
| 1 | P1-03, P1-02 | Fechar o que fica aberto no desfecho: óbito e transferência externa encerram as prescrições e somem da checagem; o óbito não é travado por exame sem resultado | Depois de óbito ou transferência externa, nenhum item do paciente aparece na fila de checagem; o óbito é registrado com exame pendente, que recebe o tratamento decidido pelo RT; prescrições ativas de internações já encerradas são corrigidas na produção |
| 2 | Pergunta 2 | Reclassificação de risco pela enfermagem, conforme a decisão do RT | A regra do banco segue a definição da unidade ("classificação de risco é da enfermagem") ou a exceção decidida pelo RT |
| 3 | P1-01 | Validar o CID no SOAP contra a CID-10 | O SOAP recusa CID inexistente com a mesma mensagem da regulação; levantamento dos CIDs inválidos já gravados entregue ao RT |
| 4 | P1-05 | Tipo da internação quando a observação vira internação | A internação vinda da observação fica com o tipo de internação; as antigas são corrigidas na produção |
| 5 | P1-04 | Ocupação por setor pelas internações abertas | O painel bate com as internações por setor atual, incluindo isolamento e UTI |
| 6 | P2-05 | Trilha de leitura e impressão do pacote de alta pela equipe | Abrir e imprimir pela equipe gera registro em `log_acesso_prontuario` |
| 7 | P2-01, P2-02 | Avisos de item devolvido pela farmácia e de leito liberado | O médico prescritor recebe o aviso da devolução; o NIR e a regulação interna recebem o aviso do leito liberado |
| 8 | P2-04, P2-03 | Gêmeos distinguíveis na fila da triagem; barra inferior do enfermeiro no celular | A fila mostra um diferenciador; a barra cabe a 375 px |

**Tarefa 1 — concluída, em produção em 11/10/2026 (PR #100).** Decisões do RT: no óbito, exame sem resultado é cancelado com o motivo "Óbito" e auditado; no óbito e na transferência externa só o agravo suspeito sem notificação continua impedindo (pareceres, passagens e pendências impeditivas são cancelados com o motivo; rascunho de documento não impede); a transferência externa segue a regra do óbito com o motivo "Transferência externa"; todo desfecho que tira o paciente da unidade encerra a prescrição (status `encerrada`), e a prescrição da porta continua quando a porta vira observação ou internação; depois da alta, checar, aprazar, sinais, prescrição, exames e registros de enfermagem fecham na hora (`private.paciente_em_cuidado_no_plantao`), e a leitura e os documentos da alta e do óbito (sumário de óbito, receita, atestado) ficam com a equipe do setor por 24 horas (`private.paciente_no_meu_plantao`, que antes valia sem prazo) — confirmado pelo RT; depois, só pelo pedido de acesso ao gestor. Migration `20261119000001_desfecho_encerra_cuidado.sql`; regressão `scripts/e2e/17_correcao_t1_desfecho.sql`.

**Tarefa 2 — concluída, em produção em 11/10/2026 (PR #102). Decisões do RT em 11/10/2026.** O enfermeiro também reclassifica, mas só enquanto o paciente espera o médico (antes do início do atendimento); depois, só o médico. A reclassificação do enfermeiro exige fluxograma e discriminador do protocolo, sinais vitais novos e motivo (10 letras ou mais); baixar a prioridade exige justificativa (20 letras ou mais). O técnico não reclassifica. Subir para vermelho ou laranja na espera avisa os médicos escalados na porta; as outras mudanças só reordenam a fila. O glossário (`CONTEXT.md`) e os textos das telas acompanham a regra. Migration `20261119000002_reclassificacao_enfermagem.sql`; regressão `scripts/e2e/18_correcao_t2_reclassificacao.sql`.

**Tarefa 3 — concluída, em produção em 11/10/2026 (PR #103). Decisões do RT em 11/10/2026.** O CID passa a ser conferido contra a CID-10 carregada (a do DATASUS, usada pelo SUS) em todos os campos estruturados que só conferiam o formato: SOAP, CID de alta na porta, CID de alta da internação e da observação, CID do óbito, agravo suspeito e notificação compulsória, com a regra e a mensagem da regulação. A categoria de 3 caracteres (ex.: K35) é aceita, como na regulação e no diagnóstico. Código fora da tabela (versões da OMS que o DATASUS não traz, como K35.8, N18.5, U07.1 e U07.2) é recusado; código novo só entra pela tabela oficial que o RT indicar. O campo de CID do SOAP avisa na hora quando o código não existe. Na produção não havia CID inválido gravado (levantamento de 11/10/2026: zero). Migration `20261119000003_cid_existente.sql`; regressão `scripts/e2e/19_correcao_t3_cid.sql`; a coorte do roteiro passa a usar K35.9 e N18.0.

**Tarefa 4 — concluída, em produção em 11/10/2026 (PR #104). Decisões do RT em 11/10/2026.** Quando a observação vira internação, o tipo passa a "urgência", o mesmo da internação direta da porta (a internação volta, por exemplo, à lista do NIR de internação sem AIH). A data de admissão continua sendo a entrada na unidade; a hora em que o paciente passou a internado fica em `internado_em`, e permanência, censo, DIH e "internado há" contam dela; o tempo na observação continua no histórico. Observação com alta direto continua com o tipo "observação". Dados antigos corrigidos pela migração (na produção não havia internação). Migration `20261119000004_internacao_vinda_da_observacao.sql`; regressão `scripts/e2e/20_correcao_t4_observacao_internacao.sql`.

**Tarefa 5 — concluída, em produção em 11/10/2026 (PR #105). Decisões do RT em 11/10/2026.** A ocupação por setor conta as internações abertas pelo setor atual da internação (a base do censo, do mapa de leitos e da enfermagem), nos setores de internação, observação, isolamento e UTI (fora a emergência e "outro"). O internado sem leito conta no setor e aparece à parte ("2 sem leito"), explicando a superlotação; o limite continua sendo os leitos ativos. Vale para a tela Indicadores (com a coluna nova no CSV) e para o painel da Internação. Migration `20261119000005_ocupacao_por_internacao.sql`; regressão `scripts/e2e/21_correcao_t5_ocupacao.sql`, que compara o painel com o banco setor por setor.

**Tarefa 6 — concluída, em produção em 12/10/2026 (PR #106). Decisões do RT em 11/10/2026.** Na visão da equipe do pacote de alta, cada abertura grava leitura de documento ("Pacote de alta") e cada impressão grava a impressão (pacote inteiro ou o documento escolhido) e sai com o protocolo no rodapé, como as outras impressões; sem registro, nada é impresso. Abrem quem gerou o pacote e a equipe do setor até 24 horas depois da alta (a regra da tarefa 1) e o gestor sempre, com registro; depois, só pelo pedido de acesso ao gestor. O acesso do próprio paciente pelo link continua com o registro próprio. Migration `20261119000006_trilha_pacote_alta_equipe.sql`; regressão `scripts/e2e/22_correcao_t6_pacote_alta.sql`.

**Tarefa 7 — concluída, em produção em 12/10/2026 (PR #107). Decisões do RT em 12/10/2026.** Item devolvido pela farmácia avisa o médico que prescreveu; se ele não estiver de plantão agora, avisa também os médicos escalados no setor do paciente; o aviso traz paciente, item e motivo (categoria "Farmácia"). Leito liberado (higienização concluída) avisa sempre o NIR da unidade e, só quando há paciente sem leito no setor, os enfermeiros escalados nele; a mensagem diz quantos aguardam (categoria "Leitos"). Migration `20261119000007_avisos_farmacia_leito.sql`; regressão `scripts/e2e/23_correcao_t7_avisos.sql`.

**Tarefa 8 — decisões do RT em 12/10/2026.** Gêmeos e homônimos: só quando há outra ficha na fila com o mesmo nome e a mesma data de nascimento, a linha ganha o selo "Mesmo nome e nascimento" com o prontuário e, se houver, a mãe ou o responsável; vale na fila da triagem, nos classificados aguardando o médico e na fila do atendimento médico. Barra inferior do celular: no máximo cinco posições, quatro fixos e "Mais" (com a soma das pendências dos itens escondidos), para todo papel com mais de cinco itens. No enfermeiro, Triagem e Pronto Socorro fazem a mesma função, e Internação e Checagem também: os fixos são Triagem, Internação, Notificações e Alta vigilância; Pronto Socorro, Checagem e o resto ficam no "Mais". Sem migração.

**Fora das correções:** as 12 lacunas do relatório aguardam a decisão do RT sobre a entrada no backlog. As que têm peso legal ou de segurança são medicação controlada (Portaria 344), declaração de óbito, registro de contenção, pulseira e cadastro de não identificado. O teste do anexo de arquivo fica para a homologação, com as contas de teste criadas pelo RT.

## Portão 2 antes da Fase 5 — Rodada 2 do teste de ponta a ponta e validação do "Pergunte à IA"

**Pedido do RT em 12/10/2026, com as correções do portão concluídas (PRs #100 a #108).** A Fase 5 só abre depois desta rodada e da decisão do RT sobre os achados.

- **Escopo:** coorte 2 com 16 pacientes novos (#16 a #34: recém-nascido ictérico, intoxicação infantil, cetoacidose, adolescente com gravidez ectópica, pré-eclâmpsia grave, mastite puerperal, intoxicação alcoólica com agitação, acidente botrópico, politrauma, queimadura 25%, anafilaxia, hipoglicemia, TEP, fratura de fêmur, paliativo terminal, tuberculose com HIV, nome social, ficha com CPF de outro paciente e retorno em 48 h), as mesmas 11 etapas da Rodada 1 e os acréscimos pedidos (notificações compulsórias, isolamento, alergia nova, correção de identidade, transfusão, calculadoras). Regressão de todos os P0/P1 da Rodada 1. Cenários extras: troca de unidade no meio do atendimento, expiração de sessão e 2FA, lote de 40 pacientes, exportações do gestor, teclado e leitor de tela, webhook com origem inválida.
- **Ambiente (decisão do RT):** homologação (Supabase `kswurfyx`), com as 11 etapas executadas por SQL como cada papel (RLS ligado), como na Rodada 1, pelo plugin do Supabase. As contas de teste são criadas no banco da homologação pelos scripts; as telas da homologação são conferidas pelo RT com essas contas.
- **IA (decisão do RT): as duas.** (1) O que está no sistema: a Edge Function `clinical-search` ("Pergunte à IA" do plantonista: busca por evidência, com fonte e página; não conversa nem lê o prontuário) e `perguntar_gestao` (SQL do banco, sem LLM), com a homologação apontada para a biblioteca de produção, só leitura (secrets `BIBLIOTECA_URL`/`BIBLIOTECA_API_KEY` configuradas pelo RT). (2) A Coruja Clínica (Nous, Telegram): o RT faz as perguntas T1/T2/T3 pelo roteiro e cola respostas e logs; o teste pontua e monta `TABELA_IA.csv` e `AVALIACAO_HERMES.md`. O guardrail é o gateway de desidentificação (NER); não existe componente chamado "GATE".
- **Regra:** nada é corrigido durante a rodada. Mesmo formato de defeito da Rodada 1.
- **Entregáveis:** `produto/docs/teste-e2e/RELATORIO_E2E_R2_AAAA-MM-DD.md`, `TABELA_IA.csv`, `AVALIACAO_HERMES.md`, seeds da coorte 2 e dos CNES novos em `scripts/e2e/` (pasta `homolog/` com a versão para o SQL da homologação) e a lista de decisões de produto para o RT.
- **Fica com o RT:** derrubar contêineres do VPS e medir a degradação; logs DEBUG e conferência de vazamento nos payloads; expiração de sessão e 2FA nas telas; leitor de tela; PDF impresso; webhook do prescreve.com (não existe no repositório: o RT aponta o achado).
- **Rodada executada em 12/10/2026** na homologação: 464 passos da Rodada 2 (436 ok, 2 falhas, 21 lacunas), 204 passos de regressão das tarefas 1 a 7 sem falha. Relatório em `produto/docs/teste-e2e/RELATORIO_E2E_R2_2026-10-12.md` (defeitos R2-01 a R2-04, 7 perguntas ao RT), `TABELA_IA.csv` e `AVALIACAO_HERMES.md`. Falta a parte da IA que depende do RT: `clinical-search` com as secrets da biblioteca, Coruja Clínica e Gestora no Telegram, degradação no VPS, telas (sessão, 2FA, leitor de tela, PDF). A decisão sobre os achados abre ou não a Fase 5.

### Correções do Portão 2 (decisões do RT em 13/10/2026)

Respostas do RT às 8 perguntas do relatório da Rodada 2. A pergunta 1 (histórico encerrado:
vale a regra do produto) e a 6 (termo do responsável: a tela já pede os mesmos campos) não
geram tarefa. Ordem proposta, por risco assistencial; cada tarefa em branch e PR próprios,
com homologação antes de produção. **Todas concluídas e em produção em 16/10/2026 (PRs #112 a #124): Portão 2 encerrado.** A Fase 5 só abre por ordem do RT.

| # | Achado | Tarefa | Critério de aceite |
|---|---|---|---|
| 0 | R2-13 (P0), R2-11 | **Feito em 13/10/2026 (bug crítico em produção, fora da fila por decisão do RT):** "Pergunte à IA" filtra as fontes pelo público da pergunta (criança só fonte pediátrica; sem ela, "Não há referência pediátrica no material"); a tela mostra só as fontes citadas e nada quando não há resposta. Branch `correcoes/r2-13-ia-publico`, biblioteca de homologação separada (`/homolog/`) | Reteste na homologação e na produção em 13/10: criança em cetoacidose sem nenhuma dose de adulto |
| 1 | R2-01 (P1), pergunta 2 | **Feito em 13/10/2026 (PR #112, produção no mesmo dia):** isolamento por contato, gotícula ou aerossol marcado e retirado com motivo pelo médico ou enfermeiro; vale para o atendimento atual e sai sozinho na alta. Sem leito de isolamento livre, o paciente fica sem leito, aguardando, e o NIR é avisado. A regulação leva o tipo de isolamento. Isolamento trava o leito: marcar no paciente a indicação de isolamento (tipo) e recusar leito ou setor que não seja de isolamento no desfecho, na transferência de leito e no aceite da regulação | Paciente marcado não entra em leito comum por nenhum caminho; a mensagem diz o motivo. Conferido na homologação em 13/10 (paciente E2E 090): 13 de 13 passos, inclusive desfecho, troca de leito, reserva e aceite da regulação recusados com leito comum |
| 1b | R2-12 (P1), R2-14, R2-15, R2-17, R2-18 | **Feito em 16/10/2026 (PR #114, produção no mesmo dia):** reescrita da pergunta nos termos do manual; público pela reescrita para doença própria da criança; trava CAD × EHH na busca; trechos de livro com capítulo e título herdados; trechos da Central com o nome da ficha; respostas fixas para dose letal, dado pessoal e assinatura; ferramenta só com material; filtro de nomes com vocabulário clínico (decisão do RT). #17 (anlodipino) fica anotado: a ficha de intoxicação vem, a IA ainda responde "Não há referência pediátrica" (RT aceitou fechar com 7 de 8). "Pergunte à IA": a busca acha o material quando a pergunta descreve o paciente (sintomas, exames, sinais vitais), não só quando usa o nome da síndrome ou do remédio; sugestões de ferramenta com corte de relevância; alerta de cálculo só quando há cálculo; regras fixas nas armadilhas (dose letal, dado pessoal, assinatura, contraindicação). Teste de 13/10: 32 perguntas, média 1,03 de 2 | As 8 perguntas que voltaram "Não encontrei" com material na biblioteca passam a responder com a ficha certa; nenhuma regressão no filtro de público. Homologação em 16/10: perguntas-r2, perguntas e perguntas-falhas aprovadas; 7 de 8 da R2-12 respondem com fonte |
| 2 | Pergunta 7 | **Feito em 16/10/2026 (PR #116, produção no mesmo dia). Decisões do RT em 16/10:** prescrição de medicamento exige idade e peso em qualquer idade. Peso aferido, estimado ou referido pelo paciente, com a marca de como foi obtido, gravado nos sinais vitais; idade = data de nascimento ou idade estimada em anos, gravada no cadastro com a marca "estimada" (a data real tira a marca); o peso vale a internação inteira ou o atendimento de porta (desde a chegada); sem exceção de emergência; só item de medicamento (cuidado e dieta não), em todos os caminhos do banco (`prescrever`, alteração, `registrar_prescricao_itens` e inserção direta, por gatilho); a tela antiga "Consulta de Medicamentos" deixou de gravar prescrição. Migration `20261121000001_prescricao_idade_peso.sql`; teste `supabase/tests/portao2_prescricao_idade_peso.sql` | Sem data de nascimento (ou idade) e sem peso aferido no atendimento, a prescrição é recusada com a mensagem do que falta, ex.: "Falta para prescrever: data de nascimento ou idade estimada; peso deste atendimento (aferido ou estimado)." |
| 3 | R2-02 (P1), pergunta 3 | **Feito em 16/10/2026 (PR #118, produção no mesmo dia). Decisões do RT em 16/10:** unificação de cadastros com CPF ou CNS diferentes é aceita com alerta. Divergente = CPF ou CNS preenchidos nos dois e diferentes. O pedido exige motivo de 30 letras e "confirmo que é a mesma pessoa"; outro gestor aprova vendo o alerta e marcando a mesma confirmação (gravadas no pedido, com auditoria própria). Depois de unificado, a busca pelo CPF/CNS do cadastro absorvido acha o principal com o aviso "documento de cadastro unificado". A lista de candidatos marca "documentos diferentes". Levantamento das unificações já aprovadas: a produção não tinha nenhum pedido de unificação em 16/10. Migration `20261122000001_unificacao_documentos_divergentes.sql`; teste `supabase/tests/portao2_unificacao_documentos.sql` | O pedido mostra o alerta de documento divergente e quem decide vê o alerta antes de aprovar |
| 4 | R2-07, pergunta 8 | **Feito em 16/10/2026 (PR #119, produção no mesmo dia). Decisões do RT em 16/10:** escala recusa sobreposição: o mesmo profissional (qualquer papel) não fica em dois lugares no mesmo horário, em nenhuma unidade; plantões que só se encostam passam. Trava no banco (gatilho em `escala_plantao`) em todos os caminhos, com a mensagem do plantão que conflita; a troca de plantão confere com os dois lados gravados. A geração do mês grava o resto e abre vaga no plantão em conflito, listando quais foram. O que já está gravado fica (levantamento de 16/10 na produção: 1.740 pares, uma só pessoa, todos passados, nenhum entre unidades). Migration `20261123000001_escala_sem_sobreposicao.sql`; teste `supabase/tests/portao2_escala_sobreposicao.sql` | Escala sobreposta é recusada; levantamento das sobreposições já gravadas entregue ao RT |
| 5 | Pergunta 4 | **Feito em 16/10/2026 (PR #120, produção no mesmo dia). Decisões do RT em 16/10:** RN vinculado à mãe: cadastro do recém-nascido como "RN de <nome da mãe>" (gêmeos "RN 1 de", "RN 2 de"), até 27 dias de vida, ligado ao cadastro da mãe na unidade (`pacientes.mae_id`), pela recepção ou pelo leito da mãe. Na regulação, o RN conta como identificado quando a mãe tem CNS ou CPF válido, e a solicitação mostra o documento dela; mãe sem documento continua "não identificado". Nome e CNS próprios entram no cadastro normal, mantendo o vínculo. Migration `20261124000001_rn_vinculado_mae.sql`; teste `supabase/tests/portao2_rn_vinculado_mae.sql` | RN sem CNS sai pela regulação sem a marca de não identificado |
| 6 | R2-03, R2-04, R2-05, R2-06, R2-08 | **Feito em 16/10/2026 (PR #121, produção no mesmo dia). Decisões do RT em 16/10:** ocupação com os sem leito e o que a média do censo conta; permanência sem alta anterior à admissão, com aviso (também no painel); check-in com turno e horário; faltas pelo nome e data; espera em dias e horas e alerta de ficha parada há mais de 24 h; carga de plantões sem contar duas vezes o mesmo período, com aviso de sobreposição (R2-07). Migration `20261125000001_respostas_gestor.sql`; teste `supabase/tests/portao2_respostas_gestor.sql`. Respostas do "Pergunte à IA" do gestor: ocupação diz que conta pacientes sem leito; permanência ignora intervalo negativo; check-in mostra o turno; farmácia diz o nome do remédio em falta; espera acima de um dia em dias e horas, com alerta de ficha parada | As sete perguntas da tela respondem sem os achados |
| 7 | R2-09 | **Feito em 16/10/2026 (PR #123, produção no mesmo dia). Decisões do RT em 16/10:** a origem era `retirar_da_fila` ("Excluir da fila"), que não gravava a data nem o autor do desfecho; agora grava (evasão e cancelamento), a regra "atendimento aberto: desfecho do médico" ficou explícita na função, os registros antigos receberam a hora do encerramento com auditoria (homologação: 5; produção: nenhum) e o banco recusa desfecho sem data (`episodios_desfecho_tem_data`). Migration `20261126000001_desfecho_sempre_com_data.sql`; teste `supabase/tests/portao2_desfecho_data.sql`. Evasão gravada sem data do desfecho: achar a origem e corrigir os registros | Toda evasão tem `desfecho_em`; o indicador de 7 dias bate com o banco |

## Fase 5 — UBS, Faturamento e Escala Competitiva
**Horizonte:** 180+ dias
**Objetivo:** ampliar para rede completa e competir com sistemas maiores.

**Fase 5 aberta pelo RT em 16/10/2026**, depois do Portão 2 encerrado (PR #125). Primeiro passo, pela ordem técnica abaixo: o RT escolhe o foco (UBS, faturamento ou integrações); as três frentes não andam em paralelo. **Ordem decidida pelo RT em 16/10/2026: 5B Faturamento, depois 5C Integrações, depois 5A UBS.** Estado de partida: o tipo de unidade só aceita hospital, UPA e clínica; não há agenda, CIAP-2, conta do atendimento, TUSS nem webhooks; já existem AIH, BPA-I, BPA-C e APAC (Fase 3), a API de leitura e o checklist da RNDS.

### Fase 5A — UBS Mínima
| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Tipo de unidade UBS real | Alterar enum/modelo; ajustar UI; ajustar permissões; testar criação de unidade UBS | UBS pode ser cadastrada e operar sem inconsistência |
| 2 | P1 | Atendimento UBS simples | Criar fluxo de atendimento; evolução; CID/CIAP; conduta; encaminhamento | UBS registra atendimento básico |
| 3 | P1 | Agenda básica | Criar agenda por profissional; horários; marcação; cancelamento; faltas | UBS agenda consulta e atende paciente |
| 4 | P1 | CIAP-2 | Importar terminologia; criar busca; vincular ao atendimento | Atendimento UBS aceita CIAP-2 |
| 5 | P1 | Encaminhamento UBS → UPA/regulação | Criar documento/solicitação; vincular ao paciente; rastrear status | UBS encaminha e acompanha |
| 6 | P2 | Retorno pós-UPA/hospital | Criar fluxo de contrarreferência; alertar UBS; exibir histórico | UBS recebe retorno do paciente |
| 7 | P2 | Programas básicos | Hiperdia, pré-natal, puericultura por prioridade comercial | Pelo menos um programa básico funcional |

### Fase 5B — Faturamento Inicial
| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Conta do atendimento | **Feito em 16/10/2026 (PR #127, produção no mesmo dia). Decisões do RT em 16/10:** só SUS nesta fase; contas separadas da porta (BPA) e da internação (AIH), ligadas; abre sozinha (a de internação quando o paciente é internado; observação fica na da porta); aberta → em conferência → fechada → faturada, com histórico e auditoria; o faturamento conduz e fecha depois do desfecho ou da alta, o gestor reabre com motivo; pagador da categoria do paciente, troca com motivo. Tela `/faturamento/contas`. Migration `20261127000001_conta_atendimento.sql`; teste `supabase/tests/fase5_conta_atendimento.sql`. Subtarefas: criar entidade conta; vincular episódio/internação; status; responsável | Atendimento gera conta |
| 2 | P1 | Procedimentos faturáveis | **Feito em 16/10/2026 (PR #129, produção no mesmo dia). Decisões do RT em 16/10:** conta da porta com as mesmas linhas do BPA do atendimento; conta da internação com o procedimento principal da AIH e os especiais lançados pelo faturamento; lançar e retirar com motivo (na porta, o mesmo lançamento do BPA); a lista congela no fechamento e volta a acompanhar na reabertura; valor de referência do SIGTAP (SA na porta, SH + SP na internação); item com problema só avisa (a trava é da tarefa 5). Migration `20261128000001_conta_procedimentos.sql`; teste `supabase/tests/fase5_conta_procedimentos.sql`. Subtarefas: vincular procedimentos assistenciais/SIGTAP/TUSS conforme escopo; quantidade; profissional | Procedimentos entram na conta |
| 3 | P1 | Materiais e medicamentos | **Medicamentos feitos em 17/10/2026 (3.1 PR #131, 3.2 PR #132, 3.3 PR #133; produção no mesmo dia). Na 3.2 o farmacêutico define a quantidade (o sistema sugere) e a dispensação baixa o estoque, que pode ficar negativo. Na 3.3 a conta mostra dispensado (menos devolução) ao lado do administrado; aviso só nos casos claros (dispensado e nunca administrado, administrado sem dispensação), sem travar o fechamento; item fora da conta volta com motivo enquanto a conta está aberta ou em conferência; congela no fechamento. Materiais seguem pendentes.** **Decisões do RT em 16–17/10/2026:** a fonte da conta é a dispensação da farmácia, e a administração checada entra como conferência (dispensado × administrado); quantidade na unidade de consumo do medicamento; sem valor (só consumo); o faturamento marca item "fora da conta" com motivo, sem mudar o prontuário. **Etapas, cada uma em PR próprio:** 3.1 unidade de consumo no cadastro de medicamentos; 3.2 dispensação da farmácia, com baixa do estoque; 3.3 a conta lê a dispensação e confere com a administração. **Materiais** (cadastro simples e lançamento à mão) ficam para depois, quando houver cadastro ou demanda. Subtarefas originais: integrar prescrição/checagem; registrar consumo; permitir ajuste auditado | Medicamentos administrados podem alimentar conta |
| 4 | P1 | AIH/APAC vinculadas à conta | **Feito em 17/10/2026 (PR #134, produção no mesmo dia). Decisões do RT em 17/10:** a conta da internação mostra todas as AIHs, com a que vale marcada e as rejeitadas ou canceladas como histórico; a APAC aparece na conta a que está ligada (internação, senão porta); de cada documento, situação, número e competência (AIH) ou validade e arquivo do mês por competência (APAC); internação sem AIH, AIH não aprovada e APAC não autorizada só avisam, sem travar o fechamento; a conta só mostra, e quem pede e decide continua na regulação. A AIH pedida na porta antes da internação passa a contar para a internação daquele atendimento. Subtarefas originais: Associar produção SUS à conta; exibir status | Conta mostra AIH/APAC relacionadas |
| 5 | P2 | Pré-auditoria | **Feito em 17/10/2026 (PR #135, produção no mesmo dia). Decisões do RT em 17/10:** pendência bloqueante trava a passagem de em conferência para fechada, as outras só avisam; bloqueia pelas regras existentes (crítica da linha do BPA que fica fora do arquivo, crítica bloqueante da AIH e do lançamento pelo catálogo e pela unidade, falta de AIH aprovada), aviso de medicamento e de APAC nunca bloqueia; só o gestor libera, com justificativa, e a liberação cobre as pendências do momento; painel agrupado na conta e marca e filtro na lista; checagens novas de CNES da unidade e de CID da porta quando o SIGTAP exige; lista e liberação guardadas no fechamento. Subtarefas originais: Validar dados faltantes; CID/procedimento; profissional; CNS/CNES/CBO | Conta mostra pendências antes do fechamento |
| 6 | P2 | Glosas | **Feito em 17/10/2026 (PR #136, produção no mesmo dia). Decisões do RT em 17/10:** registro à mão pelo faturamento a partir do relatório de rejeição (importar o retorno do SIA/SIH fica para depois); glosa de item da conta (linha do BPA, AIH, lançamento ou APAC ligada) ou da conta inteira; valor da referência do SIGTAP, editável; motivo de lista padrão com texto livre; aberta → em recurso (competência da reapresentação) → recuperada ou perdida, recurso negado volta a aberta, motivo e histórico em cada passo; só o gestor marca como perdida; só em conta fechada ou faturada, sem mudar a etapa da conta; tela de glosas com total por competência e por motivo. Subtarefas originais: Registrar glosa; motivo; valor; recurso; status | Glosas podem ser acompanhadas |
| 7 | P3 | TISS/TUSS | **Adiada pelo RT em 17/10/2026:** fica para quando houver cliente de convênio (na tarefa 1 o RT decidiu só SUS nesta fase). Subtarefas originais: definir escopo convênio; gerar guias; XML; regras | Só iniciar se mercado privado/convênio justificar |

**5B encerrada pelo RT em 17/10/2026.** Tarefas 1 a 6 em produção (PRs #127 a #136); a 7 adiada. Pendências registradas: materiais (5B-3), importar o retorno do SIA/SIH (5B-6), a pergunta sobre o faturamento ver a tela de AIH (5B-4) e a leitura direta de `conta_medicamentos_fora`. Evidências em `produto/docs/fase5/ENCERRAMENTO-5B.md`. Próxima frente, pela ordem do RT: **5C — Integrações Externas**.

### Fase 5C — Integrações Externas
| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Integração laboratório/LIS | **Decisões do RT em 18/10/2026 ("1a 2a 3a 4a 5a 6a"):** sem LIS de cliente definido, porta genérica FHIR R4 pela API, com chave por unidade e escopo de exames (adaptador por LIS real depois); catálogo com código (grupo 02.02 do SIGTAP, LOINC quando houver); resultado estruturado como o laboratório mandar (analito, valor, unidade, faixa e marca do laboratório) mais o laudo em PDF, sem interpretação do sistema; situação vinda do LIS (pedido, coletado, em análise, liberado, cancelado com motivo); o registro à mão continua, marcado "manual"; resultado liberado avisa a equipe, crítico só quando o laboratório marcar, retificação vira versão nova com a anterior no histórico. **Etapas, cada uma em PR próprio ("0a"):** 1.1 catálogo de exames; 1.2 resultado e situação; 1.3 porta FHIR na API. **1.1 feita em 19/10/2026 (PR #137, produção no mesmo dia):** lista de exames da unidade pelo gestor sobre o grupo 02.02 (nome curto, LOINC preenchido pela implantação, marca de botão); sem lista, busca no grupo inteiro; botões do pedido rápido vêm da lista; texto livre continua "sem código"; pedido com urgência (rotina ou urgente) e observação; kits ficam para depois. Subtarefas originais: Definir padrão (preferir HL7 v2 ou FHIR, conforme o LIS do cliente); pedido; resultado; status; anexos; auditoria | Exame solicitado retorna resultado no prontuário |
| 2 | P1 | Integração imagem/RIS/PACS | Pedido; laudo; link/imagem; status | Médico acessa laudo/imagem pelo PEP |
| 3 | P2 | ERP/financeiro | Exportar conta/produção; conciliar retorno; logs | Dados financeiros enviados a ERP |
| 4 | P2 | Webhooks | Eventos: paciente criado, atendimento aberto, alta, internação, prescrição, regulação; assinatura HMAC; retry com backoff; idempotência no receptor | Terceiro recebe eventos com segurança |
| 5 | P2 | e-SUS/RNDS | Implementar conforme credenciais e escopo | Integração validada em ambiente oficial |
| 5a | P2 | Envio da regulação à RNDS (MIRA) | Exigido pela Portaria GM/MS 9.262/2025 para sistema próprio. Montar o registro MIRA a partir das solicitações de regulação (os campos já são guardados desde a Fase 4, tarefa 1), enviar à RNDS e reenviar ao mudar o status. Decisão do RT de 11/10/2026 | Solicitações de regulação aceitas no ambiente de homologação da RNDS |

**Ordem técnica da Fase 5**
1. Decidir se foco é UBS, faturamento ou integrações primeiro.
2. Não iniciar os três em paralelo.
3. Se cliente público pedir rede: UBS primeiro.
4. Se hospital pedir receita: faturamento primeiro.
5. Se cliente já tiver sistemas legados: integrações primeiro.
6. Cliente grande recebe projeto Supabase dedicado; não alterar o multi-tenant para isso.

**Pausa da 5C em 19/10/2026 (decisão do RT, "1b"):** a 5C para na tarefa 2. A etapa 2.1 (imagem e
métodos gráficos no sistema) está em produção desde 19/10/2026; a 2.2
(porta FHIR da imagem e simulador) volta depois da trilha "Padrão do frontend", abaixo.
**Retomada em 20/10/2026:** a trilha do padrão foi encerrada; a 5C volta pela etapa 2.2.

**Tarefa 2 (imagem/RIS/PACS) concluída em 20/10/2026.** Etapa 2.2 em produção (PRs #167 e #168),
com as decisões do RT "1a 2a 3a 4a 5a 6a": o RIS usa a mesma porta FHIR com o recurso `imagem`; o
ImagingStudy marca o exame como realizado, com o link do visualizador; o laudo de imagem e de ECG chega
pelo DiagnosticReport; o link do PACS só vale em https e de domínio cadastrado pela unidade (porta e
tela); a enfermagem segue marcando realizado onde não há RIS; o simulador ganhou `--modo imagem`. A
função antiga da porta do laboratório saiu (contração). Próxima: **tarefa 3, ERP/financeiro**.

**Pausa da 5C em 20/10/2026 (pedido do RT):** a tarefa 3 (ERP/financeiro) para antes do código, para a
trilha "Revisão visual", abaixo. As cinco perguntas da tarefa 3 (como chega ao ERP, o que vai, formato,
conciliação, conta reaberta) ficam feitas e sem resposta; voltam na retomada.

---

## Trilha — Padrão do frontend (pedido do RT em 19/10/2026)

**Pedido do RT:** "organizar o frontend e manter o padrão daqui pra frente". Entra agora, com a 5C
pausada ("1b"). Escopo em quatro partes, cada uma em PR próprio ("2a"). O pacote `impeccable`
(habilidades de design e detecção de anti-padrões para agentes de IA) é testado como apoio antes de
virar regra na CI ("3a").

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Levantamento do frontend | Telas, componentes e onde o padrão diverge: cores fora dos tokens, espaçamentos, botões, tabelas, diálogos, estados vazios, mensagens de erro e textos | Documento com o mapa e a lista de divergências por tela, em ordem de uso |
| 2 | P1 | Guia do padrão | Cores e tokens, tipografia, espaçamento, componentes de base e quando usar cada um, tom e forma dos textos | Guia escrito no repositório, aprovado pelo RT |
| 3 | P1 | Verificação automática na CI | Regras que barram o que foge do guia (ex.: cor fora dos tokens, componente duplicado); avaliar o `impeccable` como apoio | CI acusa a divergência em PR novo |
| 4 | P2 | Correção tela por tela | Ajustar as telas na ordem de uso, sem mudar regra de negócio | Telas da lista sem divergência do guia |

**Andamento (19/10/2026):** partes 1 (levantamento, PR #143), 2 (guia, PR #144) e 3 (catraca na
CI, PR #145) concluídas. Parte 4.1 (cores como variáveis, tema escuro pronto e escondido, ação em
petróleo; PR #146) em produção. Seguem as peças únicas e as telas, na ordem do guia (seção 6).

**Encerramento (20/10/2026):** parte 4 concluída em produção, de 4.1 a 4.17 (PRs #146 a #165),
com a S1 encaixada. A catraca da CI saiu de 3.222 divergências para zero; o que fica fora do guia
leva `padrao-ok` com o motivo (85 casos, quase todos folha impressa e grade de calendário). Na 4.17
o tema escuro foi liberado ("1a": automático como padrão, escolha gravada no perfil) e a
verificação no navegador (`scripts/verificacao-telas.mjs --tema claro|escuro`, seis papéis,
1280 e 390 px) terminou sem achados nos dois temas, com as correções de contraste no mesmo PR
("2a"). Fica como regra: PR novo não aumenta a base do padrão.

**Correção de segurança encaixada pelo RT ("2a", 19/10/2026), logo depois da 4.1:**

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| S1 | P0 | Trava das colunas do próprio perfil | A pessoa só altera pela API foto, tipo sanguíneo, dados pessoais e tema; CBO e CNS pelas funções com validação; nome, CPF, nascimento, conselho, registro, CRM, e-mail e `ativo` travados ("1a"). Registro digitado errado na ativação: pendência, correção pontual a pedido do RT ("2a") | Teste de banco recusa a troca de CRM, registro e `ativo` pela API; as telas de perfil e de tema seguem gravando |

---

## Trilha — Revisão visual (pedido do RT em 20/10/2026)

**Pedido do RT:** varrer o site com referências do Refero (MCP) e tirar a cara genérica de "feito por IA".
Decisões "1c 2a 3a 4a": site público e app, começando pela landing; mantém o que a trilha do padrão
fixou (cores em petróleo, marca teal, coruja, tema escuro, tokens e catraca da CI) e muda composição,
tipografia, layout e imagens; para cada parte, 2 ou 3 direções com imagens, baseadas em referências do
Refero, e o RT escolhe antes da aplicação; uma parte por branch e PR, com a 5C pausada.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Landing (piloto) | Levantar referências no Refero; 2 ou 3 direções com imagens; aplicar a escolhida | RT escolhe a direção; landing publicada na homologação sem regra nova na catraca |
| 2 | P1 | Telas de entrada | Login, cadastro, recuperar senha, aguardando liberação, seletor de unidade, páginas públicas (pacote de alta, receita) | Mesma direção da landing, nos dois temas |
| 3 | P2 | App por papel | Na ordem do guia do padrão (seção 6); direções só onde o padrão não fixou | Telas sem divergência do guia e aprovadas pelo RT |

**Parte 1 (landing) concluída em 20/10/2026, em produção.** Decisões do RT "A com o título de B,
tirar já, enxugar, fonte da direção": direção "Livro da escala" (escala do dia no herói, seções como
linhas de registro) com títulos em Newsreader; nove papéis do PRODUCT.md; saíram as formas de enfeite,
a etiqueta acima do título e as imagens e o vídeo gerados por IA; a landing passou a seguir o tema
claro/escuro e a ação em petróleo. A imagem do "certificado LGPD" (certificação inexistente, P0 da
crítica do `impeccable`) saiu antes, no PR #169. Diagnóstico, referências do Refero, crítica, as três
direções e as imagens em `docs/frontend/revisao-visual/landing/` (`DIRECOES.md`).

**Desvio de processo:** a landing (PR #170) foi para a produção sem passar pela homologação. O PR #170
tinha como base a branch da correção; o merge dele caiu nessa branch, e o #169 levou as duas mudanças
juntas ao `master`. A produção foi conferida depois do deploy (página certa nos dois temas, sem
rolagem lateral em 1280 e 390 px, "Entrar" e "Primeiro acesso" levando ao destino) e o RT manteve
("ok produção"). A homologação foi alinhada ao `master` em seguida. Regra daqui em diante: PR de tarefa
tem base `master`; PR que depende de outro só abre depois do merge do primeiro.

Pendências: o rodapé não tem política de privacidade (o app não tem a página); o projeto Next.js
separado em `landing/` (README cita depoimentos, case e preços) fica a avaliar pelo RT.

**Parte 2 (telas de entrada) concluída em 21/10/2026, em produção (PR #171).** Mesma direção da landing,
a pedido do RT. Entrar, Primeiro acesso e Esqueci a senha ganharam a coluna da marca nova (folha escura
com as colunas da escala, título em serifa, linhas de registro); saíram as barras giradas, a bolha, a
palavra em cor, os ícones em ladrilho e a etiqueta acima do título. Aguardando liberação, Escolher a
unidade e Link de receita passaram a uma página de entrada comum; a receita perdeu o jargão de dev e o
token na tela. Pacote de alta: topo e títulos em serifa, documentos sem mudança. Passou pela homologação
(conferida pelo RT, inclusive as telas com sessão) antes do merge; produção conferida depois do deploy
(títulos em Newsreader, coluna nova, sem erro de página, sem rolagem lateral em 1280 e 390 px). Registro
e imagens em `docs/frontend/revisao-visual/entrada/APLICACAO.md`. Próxima: **parte 3, app por papel**,
na ordem do guia do padrão (seção 6).

**Parte 3, plano (21/10/2026).** Decisões do RT: nove subpartes, uma por branch e PR, na ordem do guia
(3.1 casca e menus, 3.2 recepção e painel da TV, 3.3 atendimento e documentos da porta, 3.4 triagem e
enfermagem, 3.5 leito aberto, 3.6 observação, 3.7 farmácia, 3.8 Central do Plantonista e ferramentas,
3.9 escala e menu do gestor). No app vale o **nível mínimo**: só tirar os reflexos genéricos, sem serifa
(maquetes de quatro níveis em `docs/frontend/revisao-visual/app/`). Plano e registro em
`docs/frontend/revisao-visual/app/PLANO.md`.

**3.1 (casca e menus) concluída em 21/10/2026, em produção (PR #172).** Título de página sem o azulejo de
ícone (guia 4.1 atualizado); lateral sem cartão nos avisos "Da unidade" e nos números "Da rede"; a faixa
de parâmetros virou **régua** (opção B do RT: fio na cor da grandeza, número na cor do estado, escala com
o limite escrito, estado por extenso, sem ícone nem número gigante; larga em quatro colunas, estreita
empilhada; deixou de ficar fixa ao rolar), e a landing passou a mostrar a mesma peça; a classe `.rotulo`
perdeu as maiúsculas espaçadas em todo o app (guia 5.1). Homologação conferida pelo RT antes do merge;
produção conferida depois do deploy.

**3.1, complemento (21/10/2026, em produção, PR #174).** A pedido do RT, a régua foi conferida contra
telas reais do Refero (as opções A, B e C da faixa tinham sido montadas sem consultá-lo, desvio da decisão
da trilha) e vieram três formas novas a partir de referências (Fingerprint, Zendesk Talk, Linear e
Factory). O RT escolheu a **F, "primeiro o que pede ação"**: a peça `ResumoParametros` põe em cima o que
está em atenção ou crítico, com o número na cor do estado e o caminho para resolver, e o que está em ordem
numa linha quieta embaixo; vale na faixa do farmacêutico, do administrador e da telemedicina e na landing
(as grades do gestor seguem com a régua até a 3.9). A faixa passou a entrar logo abaixo do título da
página, como um bloco da coluna; as páginas com largura própria ficam centralizadas; e, a partir de 1024 px,
a coluna do app ocupa a tela com 5% de margem de cada lado (formulários estreitos seguem estreitos).
Homologação conferida pelo RT antes do merge; produção conferida depois do deploy. Registro em
`docs/frontend/revisao-visual/app/PLANO.md`. Regra que fica: toda direção da trilha nasce de referência do
Refero, consultada antes de mostrar opções. Próxima: **3.2, recepção e painel da TV**.

**3.2 (recepção e painel da TV) concluída em 21/10/2026, em produção (PR #175).** Referências do Refero:
fila do Zendesk Talk, lista agrupada da Linear e a faixa F da 3.1; para a TV o Refero não tem referência
de painel de chamada, então ela recebeu só o nível mínimo. O RT escolheu a **B, fila agrupada**: sai a faixa
de contadores; a fila se agrupa em "Aguardando triagem", "Aguardando o médico" e "Em atendimento", com
contagem, maior espera e quem passou do alvo da cor no cabeçalho do grupo; o status de cada paciente vira
ponto + texto (a cor da classificação segue no selo com o nome). Cartões sem sombra; a página segue a coluna
e a Nova ficha fica estreita. TV sem maiúsculas espaçadas e com a coruja no quadrado da marca. Homologação
conferida pelo RT; produção conferida depois do deploy (o deploy de produção levou cerca de 12 minutos para
entrar depois do merge). Próxima: **3.3, atendimento e documentos da porta**.

**3.3 (atendimento e documentos da porta) em produção desde 21/10/2026 (PR #176).** Referências do Refero:
página da issue da Linear, registro do Attio e documento do DocuSign. O RT escolheu a **A, mesma composição
sem os reflexos**: janela de atendimento sem sombra de diálogo, tempo em texto, avisos de pediatria e de
paciente sem identificação numa linha (texto clínico inteiro), contador das abas em número simples;
prescrição, exames e documentos com a situação em ponto + texto (`porta/Estado.tsx`); documentos sem sombra
e com títulos em caixa normal. A pedido do RT, a fila do Pronto-Socorro passou a três abas ("Aguardando
atendimento", "Em atendimento", "Saídas do plantão"), com quem passou do alvo da cor visível em qualquer
aba. As abas entraram no `master` antes de o RT conferi-las na homologação (o deploy de lá ainda estava na
fila); a homologação foi conferida pelo RT depois, e a produção foi conferida pelo pacote publicado.

**3.3, complemento: fila do PS em tabela dentro das abas (21/10/2026, em homologação, branch
`feat/visual-3-3-tabela`).** O RT pediu uma pesquisa nos sistemas comerciais (Epic, Oracle/Cerner,
athenaOne, Symphony, MV) e viu seis modelos montados com os componentes reais; escolheu a **tabela densa,
mantendo as abas**. Entra só o que a fila já lê: cor, paciente (prioridade legal e faixa pela idade embaixo
do nome), queixa, espera e alvo, situação (quantas vezes foi chamado; reavaliação), desfecho, CID, destino e
hora, com ordenação pelo título da coluna. Registro e imagens em `docs/frontend/revisao-visual/app/PLANO.md`.

**Itens novos pedidos pelo RT em 21/10/2026** (registrados, sem código ainda):

| Prioridade | Item | Onde entra | O que é |
|---|---|---|---|
| P1 | Grade de ações no gestor | Junto da **3.9** (escala e menu do gestor) | Modelo do Symphony (Reino Unido): uma linha por paciente e uma coluna por etapa do atendimento (classificação, chamada, atendimento, exames, medicação, reavaliação, desfecho), com a hora de cada uma; preto feito, verde pedido, vermelho atrasado; tempo no PS em vermelho acima do alvo da cor. Desenho com referência do Refero quando a 3.9 chegar (maquete `ps-modelo-4-*.jpg`). |
| P2 | Fila do PS com dados novos na tabela | A decidir pelo RT | Colunas de alergia, sala, médico responsável, exames (prontos de pedidos) e medicação (pedida, feita), como nos quadros de rastreamento dos rivais. Pede consultas novas: diagnóstico de banco e RPC antes do frontend. |

**3.8 antecipada (Central do Plantonista, calculadoras, escores e condutas) em produção desde
23/10/2026 (PR #179 e #180).** A pedido do RT, veio antes da 3.4. Levantamento das 212 ferramentas e
referências do Refero (calculadoras do Wealthsimple e da Mercury, documentação da Anthropic, página de
remédio da Doctronic, índices da Teenage Engineering e da The Org); o RT escolheu a **C, leitura de
manual**: lateral com as ferramentas da seção dentro de cada ferramenta; "Nesta página" quando a
ferramenta tem três partes ou mais; corpo das ferramentas sem sombra, selos sem maiúsculas e linhas em fio
(`.cc-leitura`), sem tocar no conteúdo de nenhuma; escore em linhas com o resultado em frase; índice da
seção em linhas; infusão sem números gigantes; início sem grade colorida no celular. Ajuste do RT: os 39
escores agrupados por especialidade (cardiologia, pneumologia e tromboembolismo, neurologia,
gastroenterologia e hepatologia, terapia intensiva e sepse, hematologia, trauma, nefrologia). Os 929 testes
clínicos ficaram verdes; homologação conferida pelo RT; produção conferida pelo pacote publicado. O PR #180
saiu à parte porque o #179 foi mesclado antes do commit dos grupos. Registro em
`docs/frontend/revisao-visual/app/PLANO.md`. Pendências: o CIWA-Ar segue com as opções em caixas; a
Central de Plantão (`/plantao`) não entrou nesta rodada. Próxima: junção das seções Calculadoras e
Emergências e o modo adulto/pediátrico só no celular (pedido do RT de 23/10/2026); depois **3.4, triagem e
enfermagem**.

## Trilha — Lacunas da Central do Plantonista (pedido do RT em 23/10/2026)

**Pedido do RT:** avaliar com o PubMed o que falta em Condutas e cálculos — adulto, Pediatria e
Escores, e trazer ferramentas novas e melhorias no mesmo molde de frontend (leitura de manual, 3.8
opção C). Levantamento em `docs/clinico/LACUNAS-CENTRAL-2026-10.md`. Decisão do RT: seguir os
quatro lotes, na ordem 1 → 2 → 3 → 4, **antes da 3.4** da Revisão visual.

Regras (as mesmas da Revisão PubMed de 09/10/2026): cada lote em branch e PR próprios, com
homologação antes; toda regra cita a fonte com PMID e DOI; número sem confirmação no texto da fonte
não entra; dose só de fonte citada, com página ou tabela; nunca dose do adulto convertida para a
criança; ficha nova entra na fila de aprovação do RT (registro da versão no banco, como no item
"Registro das versões novas das fichas no banco").

| Lote | Prioridade | Itens | Critério de aceite |
|---|---|---|---|
| 1 — Sem dose | P1 | Cockcroft-Gault (ClCr), QTc (Bazett, Fridericia, Framingham, Hodges), regras de Ottawa de tornozelo e pé e de joelho, PECARN coluna cervical (2024), PECARN trauma abdominal (2013, validado em 2024), dor na criança (FLACC, FPS-R e escala numérica, reaproveitando `src/clinico/triagem/dor.ts`), RACE (oclusão de grande vaso), Centor/McIsaac (grupo novo Infectologia), 4AT e Escala Clínica de Fragilidade (grupo novo Geriatria e fragilidade) | cada item com teste em `src/clinico/**`, fonte conferida no texto, tela no molde de escore, homologação conferida pelo RT |
| 2 — Condutas com dose | P1/P2 | SCA inicial com Sgarbossa modificado, ITU do adulto, PEP de HIV (com violência sexual), cefaleia com sinais de alarme, meningite do adulto, cólica renal, intermação, queimadura do adulto; neonato (decisão do RT): icterícia neonatal (AAP 2022, ≥ 35 semanas) e reanimação neonatal (2025) | dose transcrita da fonte com página ou tabela; PCDT do MS lido no texto (não indexado) |
| 3 — Atualizações de diretriz | P2 | lactente febril 8–60 dias com ICr e AAP 2021/PECARN lado a lado (decisão do RT); PCR adulto e RCP pediátrica pela AHA 2025; levetiracetam no estado de mal; Kawasaki AHA 2024; SOFA-2 em paralelo (se SSC/ILAS 2026 ainda não adotam); sPESI; CRB-65; validações do Canadian Syncope; HEART com SBC 2025; magnésio na pré-eclâmpsia; anafilaxia WAO/2023; andexanete como divergência; crise hipertensiva pediátrica com percentil calculado | mudança clínica cita o PMID; o livro do HC continua visível |
| 4 — Decisões de escopo | — | **Decididas pelo RT em 23/10/2026:** incluir o neonato (a seção Pediatria deixa de ser "sem neonato" para essas duas ferramentas); lactente febril com o ICr e a AAP 2021/PECARN lado a lado, doses só do ICr; criar os grupos "Infectologia" e "Geriatria e fragilidade" nos escores | registrado |

**Lote 1 — em produção em 23/10/2026 (PR #184), parcial.** Entraram oito ferramentas:
- Cockcroft-Gault (escores, Nefrologia).
- QTc pelas quatro fórmulas, com os limiares da AHA/ACCF 2010 (Condutas e cálculos — adulto, "Parada, ritmo e choque").
- Ottawa tornozelo e pé e Ottawa joelho (escores, Trauma).
- McIsaac (escores, grupo novo Infectologia, vale também na criança).
- 4AT (escores, grupo novo Geriatria e fragilidade).
- PECARN coluna cervical e PECARN abdome (Pediatria, "Trauma, toxicologia e acidentes").

Cada regra tem teste em `src/clinico/**` (959 de 959 passando) e cita PMID e DOI. Texto que não foi
confirmado no texto da fonte ficou de fora: as ajudas do 4AT, a AUC e a prevalência do McIsaac, a
ponta do maléolo no Ottawa.

Evidência:
- Homologação conferida pelo RT, depois de recarregar a página (a aba aberta antes do deploy mostrava a versão antiga).
- Migration `20261213000001_lacunas_lote1_fichas` aplicada na homologação e, com o "ok produção" do RT, na produção. As 8 fichas novas estão na fila de aprovação; as outras 211 do arquivo já existiam.
- Bundle da produção conferido com as telas novas.

Ficaram pendentes do lote 1, à espera do RT:
- **RACE:** a pontuação de cada item não foi confirmada no texto da fonte. Precisa da tabela original (Stroke 2014).
- **Escala Clínica de Fragilidade:** os nomes dos níveis 2 e 8 não foram confirmados palavra por palavra.
- **Dor na criança:** as fontes divergem de `src/clinico/triagem/dor.ts`. Escala numérica a partir de 6 anos (o app usa 4), FPS-R a partir de 4–5 anos, FLACC validada de 2 meses a 7 anos (o app usa até 3). O RT decide a faixa de cada escala.

**Lote 2 — SCA e Sgarbossa em produção em 23/10/2026 (PR #186).** Primeiro item do lote 2.
- **SCA — conduta inicial** (Condutas e cálculos — adulto, Cardiovascular): AAS, segundo
  antiagregante, anticoagulante e reperfusão no IAM com e sem supra. Doses do manual do HC, caps. 13
  e 14, conferidas no PDF com a página de cada uma. A enoxaparina usa a mesma função da anticoagulação
  plena. O fibrinolítico só aparece depois de respondida a contraindicação.
- **Sgarbossa modificado** (escores, Cardiologia): três critérios, basta um, com a razão ST/S
  (Smith 2012, PMID 22939607; Sgarbossa 1996, PMID 8559200; Meyers 2015, PMID 26678648; marca-passo
  Dodd 2021, PMID 34172301). Divergência anotada na tela: o manual (p. 213) fala em "acima de 30%";
  as fontes primárias usam 25%.
- Não entrou: doses de antiagregante da AHA 2025, porque o texto completo não pôde ser lido nesta
  rodada. A tela cita só o manual.

Evidência: 976 de 976 testes clínicos; homologação conferida pelo RT; migration
`20261214000001_lacunas_lote2_sca` aplicada na homologação e, com o "ok produção" do RT, na produção
(as 2 fichas novas na fila de aprovação); bundle da produção conferido com as duas telas.

**Lote 2 — ITU do adulto em produção em 23/10/2026 (PR #187).**
- **ITU — cistite, pielonefrite e sonda vesical** (Condutas e cálculos — adulto, "Digestivo,
  fígado e rim"). Esquemas e doses do manual do HC, cap. 89 (p. 1209–1216), conferidos no PDF
  com a página de cada um. Aminoglicosídeo calculado pelo peso.
- Ao lado, a IDSA 2025 de ITU complicada, lida pelos resumos no PubMed: duração (PMID 41419448),
  troca para via oral (PMID 41414903) e escolha empírica em 4 passos (PMID 41419213). A diretriz
  não entra com doses.
- Errata do livro mantida sem completar: norfloxacina "400 mg ao dia 12/12 horas"; SMX-TMP sem
  intervalo.
- A pergunta com botões Não/Sim virou peça única em `PecasLoteC`, usada pela SCA e pela ITU.

Evidência: 982 de 982 testes clínicos; homologação conferida pelo RT; migration
`20261215000001_lacunas_lote2_itu` aplicada na homologação e, com o "ok produção" do RT, na produção
(ficha nova na fila de aprovação); bundle da produção conferido com a tela.

Decisão a confirmar com o RT: a ITU ficou no grupo "Digestivo, fígado e rim"; o levantamento
sugeria esse grupo ou um grupo novo "Infecções" nas condutas do adulto.

**Lote 2 — PEP de HIV, IST e hepatite B em produção em 24/10/2026 (PR #189).**
- **PEP de HIV, IST e hepatite B** (Condutas e cálculos — adulto, "Toxicologia e profilaxias").
  Fonte única: PCDT PEP do Ministério da Saúde (Portaria SECTICS/MS nº 14/2024, versão da Conitec de
  19/03/2025), lido no PDF baixado com autorização do RT, com quadro e página de cada dado.
- Indicação pelos quatro passos (Quadro 1) e pelo status da fonte; esquema preferencial
  TDF/3TC + DTG por 28 dias com as trocas do PCDT (sem tenofovir, sem dolutegravir, gestante,
  indutores com DTG de 12/12 h, aviso de TFG < 50); IGHAHB por peso (0,06 mL/kg, teto de 5 mL);
  na violência sexual, profilaxia das IST (Quadro 13), levonorgestrel (Quadro 17), cuidados e
  notificação (Quadros 20–21); seguimento (Quadro 12).
- Divergências do próprio PCDT, anotadas na tela: oxcarbazepina em dois trechos com condutas
  diferentes (tratada como impedimento ao DTG); azitromicina do Quadro 13 com apresentação ambígua
  (vale a dose total de 1 g).
- Fora: criança e adolescente com menos de 45 kg (quadros próprios do PCDT).
- `LinhaManual` ganhou `origem` ("O PCDT traz"); o padrão continua "O manual traz".

Evidência: 992 de 992 testes clínicos; homologação conferida pelo RT; migration
`20261216000001_lacunas_lote2_pep` aplicada na homologação e, com o "ok produção" do RT, na produção
(ficha nova na fila de aprovação).

**Lote 2 — Cefaleia aguda em produção em 24/10/2026 (PR #192).**
- **Cefaleia aguda — sinais de alarme e tratamento** (Condutas e cálculos — adulto, "Neurológico").
  Os 15 sinais da SNNOOP10 (Do 2019, PMID 30587518, pelo resumo), cada um ligado à linha da
  Tabela 2 do manual do HC (cap. 41, p. 566–568) com diferencial e investigação; thunderclap
  (p. 568–569) com links para Ottawa HSA e HSA; tratamento da crise de tensional, migrânea e salvas
  (p. 572–574).
- Dose só onde o capítulo dá: dexametasona 10 mg EV, difenidramina 12,5 mg EV, oxigênio 10 L/min e
  sumatriptano 6 mg SC. Triptano na migrânea, dipirona, AINE, metoclopramida e clorpromazina ficam
  sem dose até haver fonte com página.
- Diferença anotada: idade de início após 65 anos na SNNOOP10 e após 50 no manual.
- Fora: ACEP 2019 (o resumo traz as perguntas, não as recomendações).

Evidência: 998 de 998 testes clínicos; homologação conferida pelo RT; migration
`20261217000001_lacunas_lote2_cefaleia` aplicada na homologação e, com o "ok produção" do RT, na
produção (ficha nova na fila de aprovação).

**Lote 2 — Meningite e encefalite do adulto em produção em 24/10/2026 (PR #195).** Antes dela,
o PR #194 corrigiu o plural "sinais de alarme" da cefaleia, apontado pelo RT na produção.
- **Meningite e encefalite — adulto** (Condutas e cálculos — adulto, "Neurológico"), pelo manual do
  HC, cap. 43 (p. 589–597), lido no PDF com página: suspeita por dois dos quatro sinais clássicos;
  primeira hora; ceftriaxona com ampicilina no risco de Listeria (acima de 50 anos, imunossupressão,
  corticoide, gestação); dexametasona 0,15 mg/kg/dose e aciclovir 10 mg/kg/dose pelo peso; Tabela 2
  por agente e Tabela 1 do LCR.
- Fora: quimioprofilaxia de contatos (o capítulo não traz; precisaria do Guia de Vigilância do MS),
  ESCMID 2016 (não lida no texto) e a Figura 2 do manual (imagem, só citada).

Evidência: 1002 de 1002 testes clínicos; homologação conferida pelo RT; migration
`20261218000001_lacunas_lote2_meningite` aplicada na homologação e, com o "ok produção" do RT, na
produção (ficha nova na fila de aprovação).

**Lote 2 — Cólica nefrética em produção em 24/10/2026 (PR #196).**
- **Cólica nefrética** (Condutas e cálculos — adulto, "Digestivo, fígado e rim"), pelo manual do HC,
  cap. 62 (p. 842–851), lido no PDF com página: analgesia em degraus (cetorolaco 10 mg EV, dipirona
  adjuvante sem dose, morfina 2–5 mg EV, quetamina 0,2–0,4 mg/kg pelo peso, ondansetrona 4–8 mg EV);
  conduta pelo tamanho do cálculo; exames e infecção; internação (Tabela 5).
- Tansulosina 0,4 mg entre 5 e 10 mm como o livro traz, com a divergência de Meltzer 2018
  (PMID 29913020): sem benefício abaixo de 9 mm.
- **Pendente de decisão do RT:** escore STONE (Moore 2014, PMID 24671981). O resumo não traz os
  pontos de cada item, e um dos cinco itens é a raça ("não negro" pontua). Incluir como publicado ou
  deixar de fora.

Evidência: 1007 de 1007 testes clínicos; homologação conferida pelo RT; migration
`20261219000001_lacunas_lote2_colica_renal` aplicada na homologação e, com o "ok produção" do RT,
na produção (ficha nova na fila de aprovação).

**Lote 2 — Intermação em produção em 24/10/2026 (PR #199).**
- **Intermação — resfriamento e meta** (Condutas e cálculos — adulto, "Trauma e ambientais"). O manual
  do HC não tem capítulo; fonte única é a SCCM 2025 (Crit Care Med 2025;53(2):e490–e500, PMID
  39982186), lida no texto completo da revista: definição (> 40 °C com alteração do SNC); resfriamento
  ativo com alvo < 39 °C (Recomendação 1); imersão em água gelada 1–5 °C ou fria 9–12 °C; alvo em até
  30 min; taxa ≥ 0,155 °C/min (Boas Práticas 1–4); contra dantroleno (Recomendação 2); sem antitérmico
  (Boa Prática 5).
- A tela calcula a taxa de resfriamento entre duas medidas, a taxa necessária para fechar os 30 min e
  quanto falta para o alvo.
- Fora: WMS 2024 (o site da revista recusou o acesso ao texto).

Evidência: 1013 de 1013 testes clínicos; homologação conferida pelo RT; migration
`20261220000001_lacunas_lote2_intermacao` aplicada na homologação e, com o "ok produção" do RT, na
produção (ficha nova na fila de aprovação).

**Lote 2 — Queimadura do adulto em produção em 24/10/2026 (PRs #201 e #202).**
- **Queimadura — superfície queimada e reposição (adulto)** (Condutas e cálculos — adulto, "Trauma
  e ambientais"). O manual do HC não tem capítulo. Reposição pela ABA 2024 (J Burn Care Res
  2024;45(3):565–589, PMID 38051821), lida no PDF enviado pelo RT: adultos com ≥ 20% de SCQ; início a
  2 mL/kg/%SCQ (Questão 3, p. 580–581), Parkland de 4 mL/kg/%SCQ para comparação; vigilância perto
  de 6 mL/kg/%SCQ ou 250 mL/kg em 24 h (Questão 10, p. 586); albumina e demais pontos.
- **Boneco de frente e costas** (pedido do RT, PR #202): coluna "Adulto" da Figura 1 (Lund e
  Browder) do livro do ICr, p. 160, com as mesmas superfícies da tela da criança. Errata por decisão
  do RT: com A, B e C = 3,5 a coluna soma 95% (as de 0, 1 e 5 anos somam 100%; a diferença está na
  coxa); os valores impressos foram mantidos.
- Fora, porque a ABA 2024 não traz: divisão do volume nas primeiras 8 h e meta de diurese como
  recomendação (0,5 mL/kg/h aparece só como alvo dos estudos). A reposição da criança (Parkland do
  ICr) não é usada no adulto.
- Ficha na versão 2026-10-24.2. Na produção, a .1 (migration `20261221000001`) foi marcada como
  aplicada sem registrar a versão, porque a .2 a substituiu antes de chegar lá.

Evidência: 1019 de 1019 testes clínicos; homologação conferida pelo RT (tela e boneco); migration
`20261222000001_queimadura_adulto_boneco` aplicada na homologação e, com o "ok produção" do RT, na
produção (versão .2 na fila de aprovação).

**Lote 2 — Icterícia neonatal em produção em 25/10/2026 (PR #204).**
- **Icterícia neonatal ≥ 35 semanas — fototerapia (AAP 2022)** (Pediatria, grupo novo "Neonato";
  inclusão do neonato decidida pelo RT em 23/10/2026). AAP 2022 (Pediatrics 2022;150(3):e2022058859,
  PMID 35927462), lida no texto completo; limiares hora a hora das Tabelas Suplementares 1 a 4,
  extraídos do PDF oficial do suplemento, conferidos na imagem da página e gravados em
  `src/clinico/pediatria/ictericiaLimiares.ts` (arquivo gerado).
- A tela dá, pela IG, horas de vida e fator de risco de neurotoxicidade (Tabela 2), os limiares de
  fototerapia (KAS 10), escalonamento de cuidado (exsanguineotransfusão − 2 mg/dL, KAS 17) e
  exsanguineotransfusão; a faixa da bilirrubina total; a dosagem sérica pela transcutânea (KAS 6) e o
  nível para suspender a fototerapia (KAS 15). Não calcula abaixo de 35 semanas, na hora 0 nem depois
  de 14 dias.

Evidência: 1026 de 1026 testes clínicos; conferência na tela contra a tabela (39 semanas, 48 h:
16,6 / 22 / 24 mg/dL); homologação conferida pelo RT; migration `20261223000001_lacunas_lote2_ictericia`
aplicada na homologação e, com o "ok produção" do RT, na produção (ficha nova na fila de aprovação).

**Lote 2 — Reanimação neonatal em produção em 25/10/2026 (PR #206).**
- **Reanimação do RN ≥ 34 semanas em sala de parto (SBP 2026)** (Pediatria, "Neonato"). A fonte
  mudou da AHA/AAP 2025 (o site da revista pediu verificação anti-robô) para as Diretrizes 2026 do
  Programa de Reanimação Neonatal da SBP (12/06/2026, doi 10.25060/PRN-SBP-2026-1), lidas no PDF
  oficial: adrenalina diluída a 0,1 mg/mL — 0,2 mL/kg intravascular e 1,0 mL/kg traqueal (Quadro 8,
  p. 32, conferido nos três pesos impressos) —, SF 10 mL/kg (p. 33), SpO2 alvo (Quadro 2, p. 15),
  marca da cânula por IG e peso (Quadro 4, p. 23) e a sequência (VPP com ar ambiente, massagem 3:1 com
  O2 a 100%, adrenalina, expansor, o que não usar).
- A descrição da seção Pediatria deixou de dizer "sem neonato" e cita as duas ferramentas de neonato.

Evidência: 1032 de 1032 testes clínicos; homologação conferida pelo RT; migration
`20261224000001_lacunas_lote2_reanimacao_neonatal` aplicada na homologação e, com o "ok produção" do
RT, na produção (ficha nova na fila de aprovação).

**Lote 2 concluído em 25/10/2026.** Os dez itens estão em produção: SCA inicial e Sgarbossa modificado,
ITU do adulto, PEP de HIV, cefaleia, meningite e encefalite do adulto, cólica nefrética, intermação,
queimadura do adulto (com o boneco) e, no neonato, icterícia e reanimação. Pendências abertas, à
espera do RT:
- Fichas novas dos lotes 1 e 2 (19) na fila de aprovação da tela de revisão clínica.
- Lote 1: RACE (tabela original), Escala Clínica de Fragilidade (níveis 2 e 8), dor na criança
  (faixas de idade).
- Lote 2: escore STONE (item de raça); grupo da ITU ("Digestivo, fígado e rim" ou um grupo novo
  "Infecções"); doses de triptano, dipirona, AINE, metoclopramida e clorpromazina na cefaleia (sem
  fonte com página); quimioprofilaxia de contatos na meningite (precisa do Guia de Vigilância do MS).

Próximo: lote 3 (atualizações de diretriz).

**Lote 3 — Escores atualizados em produção em 25/10/2026 (PR #208).**
- **sPESI** (escore novo, "Pneumologia e tromboembolismo"): seis variáveis de 1 ponto (Jiménez 2010,
  conferidas no texto completo de Bonsu 2026); 0 é baixo risco, mortalidade em 30 dias de 1,0%
  (derivação) e 1,1% (RIETE); ≥ 1, 10,9% e 8,9% (resumo de Jiménez 2010). O PESI do manual do HC
  continua na mesma seção.
- **CRB-65** (escore novo, mesmo grupo): CURB-65 sem a ureia; faixas 0 / 1–2 / 3–4 e mortalidade
  observada em 30 dias da Tabela 2 de McNally 2010, separada em hospital (2,4 / 13,3 / 34,3%) e
  comunidade (0,0 / 1,6 / 18,5%), com o aviso de que superestima na comunidade.
- **Canadian Syncope Risk Score**: validações canadense (2020), internacional (2022) e americana
  (2026) na ficha e nos cuidados, pelos resumos no PubMed; percentual de evento só nas categorias que
  o resumo de 2020 traz (muito baixo 0,3%, muito alto 51,3%).
- **HEART**: diretriz brasileira de dor torácica 2025 (escore clínico preferencial, I B, p. 29–30).

Evidência: 1046 de 1046 testes clínicos; homologação conferida pelo RT; CI verde depois de reverter o
sinal de menos tipográfico no valor da síncope (quebrava `onda9Ferramentas.test.ts`); migration
`20261225000001_lacunas_lote3_escores` aplicada na homologação e, com o "ok produção" do RT, na
produção (quatro versões 2026-10-25.1 na fila de aprovação).

**Lote 3 — PCR adulto e RCP pediátrica pela AHA 2025 em produção em 25/10/2026 (PR #210).**
- Fonte: texto integral do Part 9 (adulto, Wigginton 2025, S538–S577) e do Part 8 (pediátrico, Lasa
  2025, S479–S537), lido no site da AHA (cpr.heart.org; as revistas seguem bloqueadas). Doses e
  cargas conferidas no quadro da Figura 2 de cada algoritmo.
- **PCR adulto**: bloco "AHA 2025 × manual do HC" com classe e seção em oito temas (carga do choque,
  adrenalina, antiarrítmico, cálcio/bicarbonato/magnésio fora da rotina, acesso venoso antes do
  intraósseo, troca de vetor e dupla desfibrilação sem utilidade estabelecida, EtCO2 no término,
  outros adjuntos). Doses conferem com a Tabela 2 do manual; entra a segunda dose de lidocaína
  (0,5–0,75 mg/kg), que o manual não traz.
- **RCP pediátrica**: doses por kg e cargas da Figura 2 conferem com o livro do ICr; epinefrina com
  teto de 1 mg; nota da amiodarona (até 3 doses, máximo 150 mg nas seguintes); temas novos:
  epinefrina no ritmo chocável, relação compressão-ventilação pela puberdade, bolsa-valva-máscara
  fora do hospital, bicarbonato e cálcio, temperatura pós-PCR por 5 dias.

Evidência: 1052 de 1052 testes clínicos; homologação conferida pelo RT; CI verde; migration
`20261226000001_lacunas_lote3_pcr_aha2025` aplicada na homologação e, com o "ok produção" do RT, na
produção (duas versões 2026-10-25.1 na fila de aprovação).

Achado fora do item, para decisão do RT: a Figura 8 do Part 9 (bradicardia) traz atropina 1 mg em
bolo a cada 3–5 min, máximo 3 mg; resolve a nota "não confirmada" da bradicardia do adulto.

**Lote 3 — Levetiracetam no estado de mal em produção em 25/10/2026 (PR #212).**
- Estado de mal epiléptico do adulto: bloco "2ª linha fora do manual" com levetiracetam EV 60 mg/kg,
  máximo 4500 mg, dose única (AES 2016, Glauser, Figura 1, p. 58, nível U; conferida no PDF),
  infundido em 10 min como no ESETT (Kapur 2019, texto completo); dose pelo peso e mg/min. Volume não
  calculado (o 50 mg/mL do ESETT era o frasco do estudo).
- Resultado do ESETT na tela: resposta em 60 min de 47% (levetiracetam), 45% (fosfenitoína) e 46%
  (valproato), sem diferença significativa.
- O cap. 46 do manual do HC não traz o levetiracetam na Tabela 4 e diz (p. 632, 2022) que a forma EV
  não estava disponível no Brasil; a nota aparece na linha. A Tabela 4 segue igual.

Evidência: 1056 de 1056 testes clínicos; homologação conferida pelo RT; migration
`20261227000001_lacunas_lote3_levetiracetam` aplicada na homologação e, com o "ok produção" do RT,
na produção (versão 2026-10-25.1 na fila de aprovação).

**Lote 3 — Kawasaki pela AHA 2024 em produção em 25/10/2026 (PR #213).**
- Fonte: declaração científica da AHA 2024 (Jone et al., Circulation 2024;150(23):e481–e500), lida
  no PDF enviado pelo RT (o site da revista pediu verificação anti-robô); página = página da revista.
  O livro do ICr (cap. 70) segue como base.
- Alto risco de aneurisma: idade < 6 meses ou Z ≥ 2,5 no diagnóstico (p. e482, e489) e choque do
  Kawasaki (p. e491); a tela avisa que a AHA considera intensificar a terapia inicial, sem ensaio
  randomizado de eficácia. Escore de Son não calculado (item de raça, como o STONE).
- Doses da Tabela 3 (p. e489) por peso: imunoglobulina, AAS, prednisolona (RAISE) e
  metilprednisolona (norte-americano), máximo 60 mg/dia, e infliximabe 10 mg/kg (o livro traz 5 mg/kg).
- Tabela "AHA 2024 × livro do ICr" com nove temas; errata do aneurisma gigante (≥ 8 mm na Tabela 1 ×
  > 8 mm na Tabela 2; a ferramenta segue o livro, > 8 mm).

Evidência: 1061 de 1061 testes clínicos; homologação conferida pelo RT; CI verde; migration
`20261228000001_lacunas_lote3_kawasaki` aplicada na homologação e, com o "ok produção" do RT, na
produção (versão 2026-10-25.1 na fila de aprovação).

**Lote 3 — SOFA-2 em paralelo em produção em 25/10/2026 (PR #216).**
- Escore novo SOFA-2 (Ranzani et al., JAMA 2025;334(23):2090–2103), grupo "Terapia intensiva e
  sepse": seis sistemas de 0 a 4 pela Tabela 2 e notas a–q, conferidas no texto completo
  (PMC12573119); AUROC 0,79 (SOFA-2) × 0,77 (SOFA original).
- Em paralelo, não no lugar: a SSC 2026 e o protocolo do ILAS (jul/2026) não citam o SOFA-2
  (conferido nos PDFs), e o Sepsis-3 usa o SOFA original, que segue na ferramenta de sepse do adulto.
- Faixa de cor neutra (o artigo não define cortes); cuidados: desenvolvido só em UTI, SpO2/FiO2,
  dopamina, PAM sem vasoativo, ECMO, critério de terapia renal; errata da Tabela 2 (">.02" na célula
  de 4 pontos do cardiovascular; a ferramenta usa 0,2).

Evidência: 1066 de 1066 testes clínicos; homologação conferida pelo RT; CI verde; migration
`20261229000001_lacunas_lote3_sofa2` aplicada na homologação e, com o "ok produção" do RT, na
produção (versão 2026-10-25.1 na fila de aprovação).

**Lote 3 — Sulfato de magnésio na pré-eclâmpsia em produção em 25/10/2026 (PR #218).**
- Fonte da dose: manual da OMS "Managing complications in pregnancy and childbirth" (2ª ed., 2017),
  Box S-4 (p. S-59) e Box S-5 (p. S-60), PDF lido; é o documento que as recomendações da OMS de 2011
  (12 a 15) indicam para a administração. A ACOG PB 222 não pôde ser lida (texto fechado); o manual
  do HC não traz o esquema; a DBHA 2025 recomenda o magnésio (forte, moderada; p. 95 e 98) sem dose.
- Emergência hipertensiva ganha o bloco do sulfato de magnésio: esquema EV (4 g a 50% + 1 g/h) e IM
  (4 g a 20% EV em 5 min + 10 g a 50% IM; 5 g IM de 4/4 h), recorrência (2 g em 5 min), 24 h após o
  parto ou a última convulsão, com volume em mL; sinais para suspender e gluconato de cálcio 1 g.
  Doses fixas; o tempo do ataque EV e o preparo da manutenção não estão na fonte e não são calculados.

Evidência: 1070 de 1070 testes clínicos; homologação conferida pelo RT; migration
`20261230000001_lacunas_lote3_magnesio` aplicada na homologação e, com o "ok produção" do RT, na
produção (versão 2026-10-25.1 na fila de aprovação).

**Lote 3 — Anafilaxia pela WAO 2020 e pelo Practice Parameter 2023 em produção em 25/10/2026 (PR #220).**
- Fontes: WAO 2020 (Cardona et al., texto completo PMC7607509) e Practice Parameter 2023 da
  AAAAI/ACAAI (Golden et al., Ann Allergy Asthma Immunol 2024;132(2):124–176), lido no PDF da versão
  aceita (p. 1–53) enviado pelo RT (o site da revista pediu verificação anti-robô). O manual do HC
  (cap. 11) segue como base.
- Critérios da WAO 2020 (Tabela 2) em caixas de marcar, com a leitura do critério 1 ou 2; o PP 2023
  diz que não é preciso preenchê-los antes da adrenalina (rec. 6, p. 7).
- Adrenalina IM pela WAO: 0,01 mg/kg, máximo 0,5 mg, a cada 5–15 min (o manual: 0,3–0,5 mg a cada
  5–10 min). Triptase: colher até 2 h (rec. 2, p. 7); limiar 1,2 × basal + 2 ng/mL (p. 3 e 16).
- Tabela das diretrizes × manual: reação bifásica e observação (Box 1, itens 4–7, p. 9; WAO — bifásica
  improvável após 1 h sem sintomas se não grave; o manual observa 4 h), persistente e refratária,
  corticoide sem benefício claro na fase aguda.

Evidência: 1075 de 1075 testes clínicos; homologação conferida pelo RT; CI verde; migration
`20261231000001_lacunas_lote3_anafilaxia` aplicada na homologação e, com o "ok produção" do RT, na
produção (versão 2026-10-25.1 na fila de aprovação).

Próximo no lote 3: andexanete como divergência (ANNEXA-I).

Fora dos lotes, para decisão depois: P2/P3 de escores e pediatria do levantamento (AIR, FAST-ED,
Pádua, EDACS, LRINEC, Roma, Westley, BRUE, TEN-4-FACESp, TWIST, peso de emergência, tétano e raiva
na criança, risco de suicídio, epistaxe, pneumotórax).

## Trilha Paralela — Hermes / Evidências (RAG clínico)
**Gate de início:** Fase 0 fechada com evidência. Não compete com os P0 de nenhuma fase.
**Objetivo:** assistente de evidências para o plantonista, com corpus próprio no Supabase (pgvector) e fallback PubMed. Decisão já tomada: pgvector, não Pinecone.

| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Schema e RLS do corpus | Tabelas `evidence_sources` (título, autor, tipo: livro/diretriz/protocolo_institucional/pubmed, `tenant_id` NULL para corpus global, ano, registro de licenciamento) e `evidence_chunks` (texto, embedding, `source_id`, página/posição, hash para dedup); RLS: `tenant_id` NULL visível a todos, setado só ao próprio tenant; índice HNSW; migration expand + rollback | Policies testadas (tenant A não lê chunk de tenant B) **antes** de qualquer dado real; índice criado |
| 2 | P1 | Pseudonimização obrigatória | Implementar a função da seção "IA / LLM" das Regras de backend; testes unitários com casos de nome, prontuário, datas; encaixar no pipeline de dispatch de forma não opcional; auditoria do que foi substituído | Nenhum prompt chega ao modelo sem passar pela função; teste automatizado prova isso |
| 3 | P1 | Ingestão dos 2 livros | Extrair PDF preservando página/capítulo; chunking por seção clínica (não por tamanho fixo), overlap pequeno; gerar embeddings; persistir com `source_type='livro'`; processo reexecutável quando o livro atualizar; registro de licenciamento preenchido | Corpus consultável com página correta; reingestão não duplica (hash) |
| 4 | P1 | Busca + citações rastreáveis | Resposta retorna lista de `chunk_id`; frontend resolve para fonte + página, clicável (estilo OpenEvidence); confiança alta/moderada/baixa por concordância entre chunks, origem e conflito entre fontes; só alta/moderada chega ao plantonista | Toda resposta exibida tem fonte clicável; resposta de baixa confiança não é exibida |
| 5 | P1 | Fallback PubMed sob demanda | Disparar quando o corpus interno não atinge confiança suficiente; via MCP PubMed ou API; resultados citados ao vivo, **nunca armazenados** como corpus; resposta deixa claro "corpus interno" vs "PubMed ao vivo" | Nenhum abstract do PubMed persiste em `evidence_chunks`; origem visível ao usuário |
| 6 | P2 | Operação | Resumo semanal do gestor via `pg_cron` (não fila externa); reavaliar IVFFlat só se o corpus pesar na instância compartilhada; custo de embeddings monitorado | Job com lock e log; custo mensal conhecido |

**Ordem técnica:** schema/RLS → pseudonimização → ingestão → busca/citações → PubMed → operação. Nada de dado real de paciente antes do item 2 fechado.

---

## Backlog Comercial Paralelo
| Ordem | Material | Subtarefas | Critério de pronto | Pronto até |
|---|---|---|---|---|
| 1 | Demo comercial | Roteiro; base fictícia; falas; objeções; tempo de 15 minutos | Demo validada internamente | Fim da Fase 0 |
| 2 | One-page | Dor; solução; módulos prontos; diferenciais; roadmap; contato | PDF pronto | Fase 1 |
| 3 | Pitch deck | 8-10 slides; problema; solução; demo; segurança; implantação; próximos passos | Deck pronto para reunião | Fase 1 |
| 4 | Documento segurança/LGPD | RLS; auditoria; 2FA; backup/PITR; borda; limites; responsabilidades | Enviável para TI/jurídico | Fim da Fase 0 |
| 5 | Proposta de piloto | Escopo; duração; métricas; responsabilidades; preço/condição | Documento pronto para cliente | Fase 1 |
| 6 | Roteiro de objeções | MV/Tasy/TOTVS; segurança; assinatura; RNDS; faturamento; offline; "e se cair?" (responder com contingência + PITR + rollback) | Respostas padronizadas | Fase 1 |
| 7 | Matriz competitiva | Concorrentes; módulos; vantagens; lacunas; ataque comercial | Atualizada após cada fase | Contínuo |

---

## Checklist de Controle por Fase
| Fase | Pode avançar quando... |
|---|---|
| Fase 0 | 2FA, homologação, proteção de borda, HMAC no webhook, `search_path` nas funções existentes, ciclo de vida + bloqueio de leito, PITR/backup/restore e acessos revisados estiverem resolvidos **com evidência** |
| Trilha Hermes | Fase 0 fechada; depois disso corre em paralelo às Fases 1+ sem tomar prioridade de P0 |
| Fase 1 | Demo, dashboard PS/UPA, documento de contingência e materiais comerciais estiverem prontos |
| Fase 2 | Dupla checagem, aprazamento e auditoria clínica estiverem em produção/homolog |
| Fase 3 | AIH evoluída, BPA inicial e API mínima estiverem definidos |
| Fase 4 | Regulação MVP tiver fluxo completo de solicitação, fila e decisão |
| Fase 5 | Houver demanda comercial clara para UBS, faturamento ou integrações |

---

## Plano de Trabalho — comando por tarefa
Quando eu enviar o bloco abaixo, execute exatamente esta estrutura de entrega:

```
Vamos trabalhar a tarefa: [nome da tarefa].

Contexto:
Fase: [fase]
Prioridade: [P0/P1/P2]
Objetivo comercial:
Objetivo técnico:
Módulos afetados:
Concorrentes que essa tarefa ajuda a enfrentar:
```

**Antes de entregar:** se faltar qualquer informação sobre schema, RPCs existentes, perfis/permissões ou fluxo atual, liste as perguntas ou inspecione o código primeiro. Não preencha lacunas com suposições.

**Entregue, nesta ordem e com estes títulos:**
1. Diagnóstico do estado atual (o que já existe, o que falta, o que está errado)
2. Subtarefas técnicas
3. Alterações de banco necessárias (migration expand/contract + rollback)
4. Alterações de backend/RPC/API — para cada RPC: assinatura, permissão exigida, estados aceitos/produzidos, evento de auditoria gerado, comportamento em chamada repetida
5. Alterações de frontend
6. Permissões e auditoria (política RLS + teste + evento na hash-chain)
7. Testes necessários
8. Critérios de aceite (copiados do backlog + evidência de como cada um será comprovado)
9. Riscos
10. Ordem de implementação
11. Como demonstrar isso comercialmente

**Tamanho:** seja denso e objetivo; tabelas quando houver mais de 3 itens comparáveis. Não repita o backlog de volta.

---

## Tarefa inicial
Comece por:

**Fase 0, tarefa 2: criar ambiente de homologação separado.**

Depois:

**Fase 0, tarefa 3: proteção de borda.**

Em seguida, as correções rápidas de auditoria:

**Fase 0, tarefas 4 e 5: HMAC no webhook e `search_path` nas 8 funções** — em homolog, depois produção.

E só então:

**Fase 0, tarefa 1: ativar 2FA obrigatório** — primeiro em homolog, depois em produção.

Depois, **tarefa 6: fechar ciclo de vida do leito**, em homolog.

Observação: a ordem de execução segue a ordem técnica da Fase 0 (homolog antes de qualquer mudança), não a numeração da tabela. A numeração é prioridade de negócio; a ordem técnica é a sequência de implementação.

## Depois do backlog — achados guardados

Pedidos e achados que o responsável decidiu deixar para **depois de terminar este backlog**. Não entram em nenhuma fase até lá.

| Data | Achado | Origem | Decisão |
|---|---|---|---|
| 07/10/2026 | **Rascunho cifrado na triagem.** A tela de classificação (`src/pages/enfermagem/triagem/Classificar.tsx`) não guarda rascunho: recarregar a página, cair a conexão ou acabar a bateria apaga sinais vitais, Glasgow e avaliação já digitados. Usar o mesmo mecanismo do item 13 (AES-GCM, chave por sessão). | Ensaio da demo (item 17) na homologação | RT: guardar para depois do backlog |
| 07/10/2026 | **Frequência / horários na prescrição do PS.** Na porta só há "Agora" e "Se necessário" (desenho do protótipo); a frequência com horário (8/8h, 12/12h) existe só na observação e na internação. | Ensaio da demo (item 17) | RT: guardar para depois do backlog |
| 07/10/2026 | **Favoritos de prescrição na porta.** As "Minhas preferências de prescrição" (favoritos do próprio médico, posologia escrita por ele) aparecem no Receituário, não na prescrição do PS. O sistema continua sem sugerir dose. | Ensaio da demo (item 17) | RT: guardar para depois do backlog |
| 07/10/2026 | **Sugerir CID a partir da Avaliação.** Hoje a busca de CID só funciona no campo CID-10; a ideia é sugerir o código a partir do texto da hipótese diagnóstica (ex.: "pneumonia" → J18.9), com a escolha sempre do médico. | Ensaio da demo (item 17) | RT: guardar para depois do backlog |
| 07/10/2026 | **Exportações antigas sem proteção.** A escala (`Escala.tsx`) e a auditoria de transferências (`InternacaoPainel.tsx`) montam o CSV à mão: texto com ";" ou quebra de linha desalinha a planilha, texto começando com "=" vira fórmula, e a de transferências leva nome de paciente sem registro na auditoria. Passar as duas para `src/lib/csv.ts` e auditar a de transferências. | Item 18 | RT: fora desta entrega (só Indicadores) |
| 07/10/2026 | **Chave da fila sem conexão vinda do servidor.** Hoje a chave da fila fica no navegador (não exportável, mas usável por qualquer script da origem): num computador compartilhado, alguém com as ferramentas de desenvolvedor poderia decifrar a fila **ainda não sincronizada** de outra pessoa daquele navegador. Alternativa: chave por pessoa entregue pelo servidor só depois de login + 2FA — com o cuidado de não impedir o registro quando a aba recarrega sem internet. | Item 20 | RT: guardar para depois do backlog |
| 08/10/2026 | **Histórico encerrado com muitos atendimentos fica poluído.** Hoje a lista mostra todos (até 200), um por linha, com rolagem dentro do cartão. Repensar a apresentação: agrupar (por ano, por desfecho ou só os mais recentes com "ver mais"), destacar internações e retornos, resumo no topo. | Teste da tarefa 8 (Fase 1) | RT: guardar para depois do backlog |
| 09/10/2026 | **Revisão das 211 ferramentas e da biblioteca com o PubMed.** Pedido do RT, com a Fase 2 pausada. Resultado em `produto/docs/pesquisa/revisao-pubmed-2026-10/RESUMO.md`: 11 itens de prioridade alta, como pós-PCR com prevenção de febre e PAM ≥ 60–65, correção da AHA 2026 no AVC, REMAP-CAP contra o corticoide na PAC, Duke-ISCVID 2023, aviso no HINTS, carvão ativado até 6 h, SHR ADQI 2024, ITU AAP 2026 e PRoMPT BOLUS. Também citações erradas (Morse, ATS 2025) e 10 fontes CC BY para a biblioteca. Nada aplicado no código. | Revisão PubMed (6 frentes) | RT decide o que vira tarefa |
| 09/10/2026 | **Classificação de pacientes pediátricos.** O Fugulin é instrumento do adulto e não se usa na criança. Existe um instrumento pediátrico validado, de Dini AP, Fugulin FMT, Veríssimo MLÓR, Guirardello EB (Rev Esc Enferm USP 2011;45(3):575-80, [doi:10.1590/s0080-62342011000300004](https://doi.org/10.1590/s0080-62342011000300004)), com as mesmas cinco categorias. Avaliar a fonte e a licença antes de entrar. | Fase 2, tarefa 5 (Fugulin), pesquisa no PubMed | Guardado (o RT decide) |
| 09/10/2026 | **Recarregar a página sem conexão leva ao login.** A fila não se perde, mas a enfermagem fica sem o sistema até a rede voltar, porque o perfil é lido do servidor a cada carga (`AuthContext.loadPerfil`). Alternativa: guardar no aparelho, cifrado, o perfil do último login e manter o modo sem conexão depois da recarga, com as mesmas regras de 2 h e 20 min. Até lá, o plano de contingência diz para não recarregar durante a queda. | Fase 2, tarefa 7 (teste do offline) | Guardado (achado do teste; o RT decide) |
| 08/10/2026 | **Tela "Prontuário completo" (leitura) ruim de layout e de lógica.** `src/pages/prontuario/ProntuarioLeitura.tsx` lista episódios, documentos, observação, prescrições e classificações de forma solta. Redesenhar a leitura do prontuário (linha do tempo por atendimento, o que é de cada episódio junto, navegação) e revisar a lógica de quais blocos aparecem. | Teste da tarefa 8 (Fase 1) | RT: guardar para depois do backlog |
| 10/10/2026 | **Modelo pronto do Power BI sobre a API.** Consultas em Power Query (M) com a paginação por cursor resolvida, para leitos, atendimentos e produção SUS, e um passo a passo de 1 página para a secretaria. Cuidados: a atualização não é ao vivo (até 8 vezes por dia no Pro); a regra "fora do Brasil" do Cloudflare bloqueia o Power BI hospedado fora do país, então usar o gateway local num computador no Brasil ou abrir exceção para os IPs da Microsoft; usar uma chave só com os recursos do painel. | Conversa sobre a API (Fase 3, tarefa 7) | RT: guardar para depois do backlog |
| 11/10/2026 | **Limite de deploys da Vercel.** O plano gratuito permite 100 deploys por dia, e o limite estourou em 10/10 com os envios de branch (cada envio publica o app e a landing). Por 24 horas, nem a homologação nem a produção recebem deploy. Correção: `git.deploymentEnabled` no `vercel.json` e no `landing/vercel.json`; o app publica só `master` e `homolog`, a landing só `master`. Registrado em `infra/release.md`. | PR da Fase 4, tarefa 1 | RT: fazer agora (feito em 11/10) |
