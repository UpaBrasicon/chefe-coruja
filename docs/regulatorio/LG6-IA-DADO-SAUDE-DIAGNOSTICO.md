# LG6: IA com dado de saúde (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG6 (P0). É a maior exposição legal da trilha: texto escrito por profissional de saúde vai a um provedor de IA fora do Brasil, sem contrato de transferência internacional.

**Decisão do RT, 17/11/2026: "Todas A"** (I1 a I5). A implementação segue em PRs próprios.

**Não é parecer jurídico.** É o mapa técnico para o RT decidir e para o advogado confirmar a leitura da norma. Este documento não muda código nem banco.

## Como é hoje

### Quem chama modelo de linguagem

| Caminho | Onde roda | Provedor e modelo | O que vai ao modelo |
|---|---|---|---|
| Busca clínica ("Perguntar", `/v1/ask`) | Edge `clinical-search` → biblioteca (`biblioteca/app/main.py`) no VPS | DeepSeek, `DEEPSEEK_MODEL`, sem provedor de reserva | Pergunta desidentificada (até 800 caracteres), trechos da biblioteca, peso e idade digitados. São três chamadas: reescrita, resposta e termos para o PubMed |
| Corujinha e agentes do Nous (Telegram) | Hermes, rota `/v1/chat/completions` (`hermes/src/server/ia-proxy.ts`) | DeepSeek (`LLM_BASE_URL`, padrão `api.deepseek.com`); reserva opcional Kimi (Moonshot) | A conversa inteira: falas do usuário e do assistente, e resultados de ferramentas (agregados de censo, indicadores, notificações com `[COLEGA_n]`) |
| WhatsApp (Cérbero) | Hermes (`hermes/src/agent/loop.ts`) | DeepSeek, com a mesma reserva | Histórico da sessão (até 20 mensagens) e texto livre; as ferramentas são só de quarentena e incidente |

Fora isso, nenhum outro ponto chama modelo:
- **Edges:** as demais Edges não chamam.
- **App:** a leitura de laudo é local, com pdf.js e tesseract.
- **Embeddings:** saem do Ollama local (`bge-m3`), no próprio VPS.
- **Modelo local para gerar texto:** não existe hoje. `LLM_PROVIDER` só aceita `deepseek` (`hermes/src/config/env.ts:37`).

### O que protege hoje

- **Gateway único (ADR 0006).** No Hermes, só `chamarIA` (`hermes/src/gateway/gateway.ts`) chega ao modelo, e o lint proíbe o atalho (`hermes/eslint.config.js`).
  - Na busca clínica, o portão é a Edge (`supabase/functions/clinical-search/liberar.ts`). A biblioteca pseudonimiza de novo, e sem NER responde 503.
  - Quem tiver a chave da biblioteca e chamar `/v1/ask` direto pula a Edge. Fica só com a proteção da própria biblioteca.
- **O que a desidentificação tira** (`hermes/src/gateway/desidentificacao.ts`, cópia na Edge conferida no CI):
  - nomes conhecidos da unidade (pacientes, mães, responsáveis, profissionais);
  - nome depois de gatilho ("paciente", "sr.", "mãe");
  - CPF e CNS com dígito certo, prontuário, data completa, CEP, telefone e e-mail.
- **NER obrigatório** (spaCy, `/v1/deid`), com falha fechada.
- **Na fala da IA:** nome achado vira pseudônimo (S8, #772).
- **O que passa:**
  - nome sem gatilho ou em minúscula;
  - idade, data parcial, hora, leito e endereço por extenso;
  - toda a narrativa clínica.
  O texto que sai é **pseudonimizado, não anonimizado**.
- **Registro:**
  - `ia_gateway_log` guarda contagens e hash, nunca o texto;
  - `clinical_search_logs` guarda a pergunta já desidentificada;
  - `hermes_sessions.messages` (WhatsApp) guarda o texto cru, e `hermes_audit_log` guarda os 100 primeiros caracteres da resposta (`hermes/src/agent/pipeline.ts:147-153`);
  - nenhuma rotina apaga essas tabelas.

### O que já está escrito

- **ADR 0006** (`produto/docs/adr/`): aceita provedor fora do Brasil e declara que nome sem gatilho passa.
- **`produto/docs/seguranca-lgpd.md`:** a tabela de fornecedores não lista DeepSeek nem Kimi.
- **`RESPOSTAS-TECNICO.md`** e **`RESPOSTAS-TECNICAS-VERIFICADAS.md`:** sobre cláusulas-padrão, "não temos". A transferência internacional foi assumida, com "região no Brasil ou modelo próprio" como plano.
- **`docs/seguranca/red-team-2026-10-01.md`, achado V5:** a regex deixa passar nome, e o dado sai do Brasil. A política de retenção e de treino do provedor está pendente.
- **`docs/porta/CID-SUGERIDO-AVALIACAO-DIAGNOSTICO.md`:** o CID por IA foi descartado, também por causa do provedor fora do Brasil.

## O que a norma pede (leitura técnica, para o advogado confirmar)

- **Dado de saúde é dado sensível** (LGPD, art. 5º, II, e art. 11). O texto do médico sobre um paciente, mesmo sem nome, é dado de saúde de uma pessoa identificável enquanto der para chegar nela: por idade, data, leito, unidade ou pela própria história. Pseudonimizar reduz o risco, mas o dado continua pessoal (art. 12 e art. 13, § 4º). Só o dado anonimizado sai da LGPD.
- **Mandar esse dado a um servidor fora do Brasil é transferência internacional** (art. 33). Ela só é permitida por uma das hipóteses da lei:
  - país com decisão de adequação da ANPD;
  - cláusulas-padrão contratuais da ANPD;
  - normas corporativas globais;
  - cláusulas específicas aprovadas pela ANPD;
  - ou as exceções do art. 33.
  O Regulamento de Transferência Internacional (Resolução CD/ANPD 19/2024) trouxe o texto obrigatório das cláusulas-padrão e deu prazo para incorporá-las aos contratos.
- **DeepSeek e Kimi são empresas chinesas.** Segundo as políticas de privacidade publicadas, o DeepSeek guarda os dados em servidores na China. A política vigente precisa ser conferida, inclusive sobre o uso dos dados para treinar o modelo. Até onde este mapa alcança, nenhum dos dois oferece contrato com as cláusulas-padrão da ANPD. Hoje o contrato é o termo de uso da API.
- **Quem responde.** O hospital é o controlador do dado do paciente, e o Chefe Coruja é o operador. O provedor de IA é suboperador e precisa estar no contrato de operador (LG1) e no relatório de impacto (LG3).

Em resumo: hoje não há base para a transferência. A desidentificação diminui o que sai, mas não transforma o texto clínico em dado anônimo.

## Decisões para o RT

**I1. Caminho para o texto clínico (busca clínica, Corujinha e WhatsApp)**
- **A (recomendada):** trocar por um provedor que processe no Brasil, com contrato de operador e sem uso para treino. O provedor seria uma nuvem grande na região de São Paulo.
  - **Primeiro passo:** um comparativo curto, com qualidade nas perguntas de avaliação da biblioteca, custo por mês, latência, garantia de que a inferência fica na região e contrato.
  - **Candidatos:** Amazon Bedrock, Azure OpenAI e Google Vertex AI, na região do Brasil, e o que mais tiver processamento local.
  - O RT escolhe o provedor com o comparativo na mão.
- **B:** modelo aberto rodando no próprio VPS (o Ollama já existe para os embeddings). O dado não sai do servidor. Pesa a qualidade do modelo, e precisa de máquina com GPU, com outro custo.
- **C:** manter o DeepSeek e buscar contrato com as cláusulas-padrão da ANPD. É pouco provável que o provedor assine, e o dado continua indo para a China.

**I2. Até a troca entrar**
- **A (recomendada):**
  - Tirar a reserva do Kimi. É um segundo provedor fora do Brasil, também sem contrato.
  - Aviso: a busca já mostra "Não digite nome, CPF ou dados identificáveis do paciente" (`src/pages/plantonista/PlantonistaHome.tsx:267`). Pôr o mesmo aviso na primeira mensagem da Corujinha e do WhatsApp.
  - Registrar o risco aceito, com data, no relatório de impacto (LG3).
- **B:** desligar a busca "Perguntar" e a Corujinha até a troca. Fica só a busca na biblioteca, sem modelo, que já existe (`/v1/search`).
- **C:** manter tudo como está até a troca.

**I3. Texto cru guardado do WhatsApp**
- **A (recomendada):** apagar o texto de `hermes_sessions.messages` depois de 30 dias e trocar os 100 caracteres crus da `hermes_audit_log` por um resumo sha256, como a S8 já fez em outros registros. O mesmo prazo vale para `clinical_search_logs.query_redacted`.
- **B:** manter como está e registrar no inventário (LG4).

**I4. Transparência e papéis**
- **A (recomendada):** listar o provedor de IA, com país e finalidade, em três lugares:
  - na tabela de fornecedores (`produto/docs/seguranca-lgpd.md`);
  - no contrato de operador (LG1), como suboperador;
  - no relatório de impacto (LG3).
  Atualizar a ADR 0006 com a decisão do I1.
- **B:** só depois da troca do provedor.

**I5. Atalho da chave da biblioteca**
- **A (recomendada):** a biblioteca passa a aceitar `/v1/ask` só da Edge, com uma chave própria para isso, diferente da chave da busca do Nous. Assim, toda pergunta ao modelo passa pela liberação da Edge.
- **B:** manter a chave única e registrar o risco.

## Como ficaria a implementação, com tudo A

| Parte | O que muda |
|---|---|
| Comparativo (I1) | `docs/regulatorio/LG6-COMPARATIVO-PROVEDORES.md`: perguntas de avaliação da biblioteca rodadas em cada candidato, com custo, latência, região e contrato. O RT escolhe |
| Troca (I1) | `LLM_PROVIDER` aceita o provedor novo no Hermes; a biblioteca troca o cliente; tudo pelo gateway; homologação antes, com as avaliações de qualidade; produção com o "ok produção" |
| Imediato (I2) | sem `LLM_FALLBACK_*` no `.env` da produção (o RT confirma no VPS); aviso na Corujinha e no WhatsApp |
| Guarda (I3) | migration expand com a rotina de apagar texto vencido (pg_cron) e teste em `supabase/tests`; Hermes com sha256 no `hermes_audit_log` |
| Documentos (I4) | tabela de fornecedores, ADR 0006, e entradas no LG1 e no LG3 |
| Chave (I5) | chave nova na biblioteca e no segredo da Edge; `infra/` com a troca e a volta |

## Riscos

- **A resposta pode piorar com o provedor novo.** As avaliações da biblioteca entram no comparativo para medir isso antes da troca.
- **Custo.** O DeepSeek é barato (`docs/hermes/E6-CUSTO-IA.md`). Um provedor com região no Brasil deve custar mais, e o comparativo traz o número.
- **Região não basta.** Alguns serviços mandam a inferência para outra região quando a local está cheia. O contrato e a configuração precisam garantir que ela fique no Brasil.
- **Desidentificação continua.** Mesmo com o provedor no Brasil, o gateway e o NER ficam: menos dado para fora é sempre melhor.
