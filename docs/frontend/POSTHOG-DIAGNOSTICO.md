# Analytics de produto e feature flags (PostHog): diagnóstico (PH1 a PH3)

Fase 1, item 14 (P2): eventos mínimos de uso (login, troca de aba na Central Clínica, uso de calculadora e escore, abertura do censo), feature flag por unidade, session replay desligado ou mascarado nas telas clínicas, nenhum identificador de paciente nos eventos. Pedido pelo RT em 23/11/2026. Lido na master (be3848a6). Nada foi programado.

## O que já existe

- **Uso de ferramenta da Central**: `ferramenta_uso` (migration `20261010000001`) conta, por pessoa e ferramenta, quantas vezes cada calculadora e escore foi aberto. Só a própria pessoa lê; o gestor não vê (decisão da época: uso individual não é indicador de desempenho).
- **Entrada na conta**: os registros de acesso do LG9 (`auth.sessions`, na produção) já guardam cada login.
- **Ligar recurso por unidade**: o app já faz isso por coluna ou chave da unidade, sem sistema genérico (ex.: `unidades.usa_pulseira`, `rnds_config_unidade.rac_aps_pelo`).
- **Erros**: Sentry na União Europeia, com mensagem higienizada, já listado como suboperador nas peças da LGPD (LG1).
- **CSP do site** (`vercel.json`): só libera o que o app usa hoje; o PostHog pediria um domínio novo em `connect-src` e `script-src`.

## O que o PostHog muda na LGPD

Seria um suboperador novo recebendo dado de uso de profissional de saúde (e, sem cuidado, da tela clínica). Precisa entrar no contrato de operador (LG1) e no relatório de impacto (LG3), que ainda esperam o advogado, com região (a nuvem da UE do PostHog), prazo de guarda e a garantia de que nada de paciente sai: `autocapture` desligado, `session replay` desligado, IP anonimizado e propriedades revisadas evento por evento.

## Decisões

### PH1. Medir o uso do app

**A (recomendo).** Sem fornecedor novo. Uma tabela de uso no próprio banco, **agregada por dia, unidade, papel e evento**, sem pessoa e sem paciente (ex.: "UPA Centro · médico · abriu o censo · 23/11 · 14 vezes"), alimentada por uma RPC chamada nos pontos do item 14. Leitura num painel "Uso do app" do administrador da plataforma. Não muda a LGPD nem a CSP, e não espera o advogado.

**B.** PostHog Cloud na UE, com `autocapture` e `session replay` desligados, IP anonimizado e eventos só com papel e unidade. Precisa de conta, CSP nova e da entrada no LG1 e no LG3; só vai à produção depois do advogado.

### PH2. Feature flag por unidade

**A (recomendo).** Manter o padrão de hoje: quando um recurso precisar ser ligado por unidade, uma chave da unidade no banco, conferida pelo servidor (como `usa_pulseira`). O exemplo do item (painel do gestor por unidade) já foi para todas as unidades e não precisa mais de flag.

**B.** Flags do PostHog (só se PH1 = B).

### PH3. O que medir (se PH1 = A)

**A (recomendo).** Os eventos do item 14, sem pessoa: entrada no app (contagem por unidade e papel, lida dos registros do LG9), troca de aba na Central Clínica, abertura de calculadora ou escore (total por ferramenta, somando o `ferramenta_uso` sem a pessoa) e abertura do censo. Sem chat lateral, que não existe.

**B.** Só a contagem de ferramentas que já existe, exposta ao administrador sem a pessoa; nada novo.

## Perguntas ao RT

1. PH1 a PH3: A ou B em cada um?
