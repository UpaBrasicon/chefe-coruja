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
- Aprazamento: grade de horários **configurável por unidade** (sem configuração, início às 06h); enfermagem ajusta caso a caso com registro.
- Interações: **pesquisar bases com licença comercial e trazer opções**; a tarefa 3 só começa depois da escolha.
- Fugulin: **enfermeiro, 1x por dia**, na internação, com fonte citada e histórico.
- Intercorrência: registram **médico, enfermeiro e técnico de enfermagem**.
- Alteração versionada de item de prescrição: **só o médico, com motivo**; versão anterior guardada; enfermagem vê o aviso na checagem.
- Read replica: **não agora** (só quando os painéis pesarem).

**Andamento da Fase 2**

| Tarefa | Situação | Onde |
|---|---|---|
| 1 — Dupla checagem | Pronta na homologação, aguardando teste do RT | Branch `fase2/dupla-checagem`; migration `20261031000001_dupla_checagem.sql` (só homologação); teste `supabase/tests/fase2_dupla_checagem.sql` |
| 2 — Aprazamento assistido | Pronta na homologação, aguardando teste do RT | Branch `fase2/aprazamento-assistido` (sobre a da tarefa 1); migration `20261031000002_aprazamento_assistido.sql` (só homologação); teste `supabase/tests/fase2_aprazamento_assistido.sql` |
| 3 — Interações medicamentosas | **Pronta na homologação (opção A), aguardando teste do RT.** Branch `fase2/interacoes`; migration `20261031000005_interacoes_criticas.sql` (só homologação); teste `supabase/tests/fase2_interacoes_criticas.sql`. Decidida em 09/10: **opção C**. Começa pela A (lista curada de pares críticos pelo RT/farmacêutico, a partir da lista ONC e das bulas ANVISA, com fonte por linha); a B (base comercial licenciada) fica como plano futuro | Opções em `produto/docs/pesquisa/interacoes-medicamentosas-fontes.md` |
| 4 — Intercorrência estruturada | Pronta na homologação, aguardando teste do RT | Branch `fase2/intercorrencia` (sobre a da tarefa 2); migration `20261031000003_intercorrencia.sql` (só homologação); teste `supabase/tests/fase2_intercorrencia.sql` |
| 5 — Fugulin | **Pronta na homologação, aguardando teste do RT.** Branch `fase2/fugulin`; migration `20261031000006_fugulin.sql` (só homologação); teste `supabase/tests/fase2_fugulin.sql`. Decidida em 09/10: **versão de 12 áreas** (intensivo acima de 34; a unidade tem leito semi-intensivo). Na tela, **só um resumo** de cada graduação, sem o texto do artigo | Ver "Fugulin" abaixo |
| 9 — Painel da farmácia | **Pronta na homologação, aguardando teste do RT.** Branch `fase2/painel-farmacia`; migration `20261031000008_painel_farmacia.sql` (só homologação); teste `supabase/tests/fase2_painel_farmacia.sql` | Ver "Tarefa 9, como ficou" |
| 10 — Réplica de leitura | Não agora (decisão do RT de 08/10) | — |
| 8 — Auditoria clínica | **Pronta na homologação, aguardando teste do RT.** Branch `fase2/auditoria-clinica`; migration `20261031000007_auditoria_clinica.sql` (só homologação); teste `supabase/tests/fase2_auditoria_clinica.sql` | Ver "Tarefa 8, como ficou" |
| 7 — Teste do offline | **Concluída em 09/10** (relatório; sem migration) | Branch `fase2/teste-offline`; `produto/docs/fase2/teste-offline-2026-10-09.md`; plano de contingência atualizado |
| 6 — Alteração versionada de item | Pronta na homologação, aguardando teste do RT | Branch `fase2/alteracao-prescricao` (sobre a da tarefa 4); migration `20261031000004_alteracao_item_prescricao.sql` (só homologação); teste `supabase/tests/fase2_alteracao_item_prescricao.sql` |

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

**Fase 2 construída em 09/10/2026.** Tarefas 1 a 9 na homologação; a 10 não agora. Falta o teste do RT, os merges e o "ok produção" das migrations 20261031000001 a 000008.

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
| 13 | Biblioteca: fontes novas (CC BY, CC BY-NC e fichas de referência) | 12 fichas de referência feitas, branch `revisao/biblioteca-referencias`. Licenças conferidas e entradas de `fontes.yaml` prontas em `produto/docs/pesquisa/revisao-pubmed-2026-10/item13-biblioteca.md`. Pendente com o RT: baixar os PDFs, registrar em `fontes.yaml` e ingerir no VPS |
| — | Registro das versões novas das fichas no banco | Feito, branch `revisao/registro-versoes` (migration `20261101000001`). As 14 versões novas entram na fila de aprovação do RT |

As branches estão empilhadas na ordem da tabela. Os PRs devem ser mergeados nessa ordem. A homologação recebe a última branch, que contém todas.

## Fase 3 — SUS, Produção e Integrações Mínimas
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

## Fase 5 — UBS, Faturamento e Escala Competitiva
**Horizonte:** 180+ dias
**Objetivo:** ampliar para rede completa e competir com sistemas maiores.

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
| 1 | P1 | Conta do atendimento | Criar entidade conta; vincular episódio/internação; status; responsável | Atendimento gera conta |
| 2 | P1 | Procedimentos faturáveis | Vincular procedimentos assistenciais/SIGTAP/TUSS conforme escopo; quantidade; profissional | Procedimentos entram na conta |
| 3 | P1 | Materiais e medicamentos | Integrar prescrição/checagem; registrar consumo; permitir ajuste auditado | Medicamentos administrados podem alimentar conta |
| 4 | P1 | AIH/APAC vinculadas à conta | Associar produção SUS à conta; exibir status | Conta mostra AIH/APAC relacionadas |
| 5 | P2 | Pré-auditoria | Validar dados faltantes; CID/procedimento; profissional; CNS/CNES/CBO | Conta mostra pendências antes do fechamento |
| 6 | P2 | Glosas | Registrar glosa; motivo; valor; recurso; status | Glosas podem ser acompanhadas |
| 7 | P3 | TISS/TUSS | Definir escopo convênio; gerar guias; XML; regras | Só iniciar se mercado privado/convênio justificar |

### Fase 5C — Integrações Externas
| Ordem | Prioridade | Tarefa | Subtarefas | Critérios de aceite |
|---|---|---|---|---|
| 1 | P1 | Integração laboratório/LIS | Definir padrão (preferir HL7 v2 ou FHIR, conforme o LIS do cliente); pedido; resultado; status; anexos; auditoria | Exame solicitado retorna resultado no prontuário |
| 2 | P1 | Integração imagem/RIS/PACS | Pedido; laudo; link/imagem; status | Médico acessa laudo/imagem pelo PEP |
| 3 | P2 | ERP/financeiro | Exportar conta/produção; conciliar retorno; logs | Dados financeiros enviados a ERP |
| 4 | P2 | Webhooks | Eventos: paciente criado, atendimento aberto, alta, internação, prescrição, regulação; assinatura HMAC; retry com backoff; idempotência no receptor | Terceiro recebe eventos com segurança |
| 5 | P2 | e-SUS/RNDS | Implementar conforme credenciais e escopo | Integração validada em ambiente oficial |

**Ordem técnica da Fase 5**
1. Decidir se foco é UBS, faturamento ou integrações primeiro.
2. Não iniciar os três em paralelo.
3. Se cliente público pedir rede: UBS primeiro.
4. Se hospital pedir receita: faturamento primeiro.
5. Se cliente já tiver sistemas legados: integrações primeiro.
6. Cliente grande recebe projeto Supabase dedicado; não alterar o multi-tenant para isso.

---

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
| 09/10/2026 | **Classificação de pacientes pediátricos.** O Fugulin é instrumento do adulto e não se usa na criança. Existe um instrumento pediátrico validado, de Dini AP, Fugulin FMT, Veríssimo MLÓR, Guirardello EB (Rev Esc Enferm USP 2011;45(3):575-80, [doi:10.1590/s0080-62342011000300004](https://doi.org/10.1590/s0080-62342011000300004)), com as mesmas cinco categorias. Avaliar a fonte e a licença antes de entrar. | Fase 2, tarefa 5 (Fugulin), pesquisa no PubMed | Guardado (o RT decide) |
| 09/10/2026 | **Recarregar a página sem conexão leva ao login.** A fila não se perde, mas a enfermagem fica sem o sistema até a rede voltar, porque o perfil é lido do servidor a cada carga (`AuthContext.loadPerfil`). Alternativa: guardar no aparelho, cifrado, o perfil do último login e manter o modo sem conexão depois da recarga, com as mesmas regras de 2 h e 20 min. Até lá, o plano de contingência diz para não recarregar durante a queda. | Fase 2, tarefa 7 (teste do offline) | Guardado (achado do teste; o RT decide) |
| 08/10/2026 | **Tela "Prontuário completo" (leitura) ruim de layout e de lógica.** `src/pages/prontuario/ProntuarioLeitura.tsx` lista episódios, documentos, observação, prescrições e classificações de forma solta. Redesenhar a leitura do prontuário (linha do tempo por atendimento, o que é de cada episódio junto, navegação) e revisar a lógica de quais blocos aparecem. | Teste da tarefa 8 (Fase 1) | RT: guardar para depois do backlog |
