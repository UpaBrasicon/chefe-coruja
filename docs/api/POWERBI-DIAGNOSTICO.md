# Modelo pronto do Power BI sobre a API: diagnóstico

Este é o achado guardado de 10/10/2026, da conversa sobre a API (Fase 3, tarefa 7). O RT o abriu em 06/11/2026 como item 8, o último da frente "Achados guardados".

## O que já existe
- **API de leitura para integradores**, em produção desde 10/10/2026 (`api.chefecoruja.com.br`). A homologação fica em `api-homolog.chefecoruja.com.br`. O contrato está em `docs/api/openapi.yaml`.
  - **Chave:** `Authorization: Bearer <chave>`. Cada chave vale só para as unidades e os recursos liberados nela, e pode ter uma lista de IPs. É criada em **Integrações (API)** e aparece só uma vez.
  - **Limite:** 60 consultas por minuto por chave (ajustável no banco), informado nos cabeçalhos `RateLimit-*`. Passando disso, a resposta é 429 com `Retry-After`.
  - **Listas:** devolvem `dados` e `proximo_cursor`, com `limite` de até 100 por página. A lista acaba quando `proximo_cursor` vem `null`.
  - **Atendimentos:** a consulta cobre no máximo 31 dias (`desde` e `ate`).
  - **Recursos que o painel usa:** `/unidades`, `/leitos`, `/atendimentos` e `/producao/aih`, `/producao/apac` e `/producao/fechamentos`.
  - **Dados do paciente:** só o mínimo, sem dado clínico além da cor, do CID principal e da situação.
- **Cloudflare:** a regra "Fora do Brasil" bloqueia a API para quem está fora do país (`infra/cloudflare.md`). O serviço do Power BI atualiza os dados a partir da nuvem da Microsoft, que pode não estar no Brasil.
- **Produção sem equipe** (31/10/2026): a UPA Centro ainda não tem dados de uso real. O modelo é testado contra a homologação.

## Cuidados do Power BI que o modelo precisa resolver
- **Atualização no serviço:** o Power BI só atualiza uma fonte web que tenha o endereço base fixo. O caminho e os parâmetros vão em `RelativePath` e `Query` do `Web.Contents`. Se o endereço for montado por inteiro na consulta, a atualização agendada falha ("fonte de dados dinâmica").
- **Frequência:** a atualização não é ao vivo. No plano Pro são até 8 por dia.
- **Chave no arquivo:** o cabeçalho `Authorization` sai de um parâmetro da consulta, então a chave fica dentro do `.pbix`. O arquivo tem de ser tratado como senha.
- **Paginação:** as consultas seguem o `proximo_cursor` até o fim e respeitam o limite por minuto. Com 100 por página, 60 páginas por minuto bastam para o volume de uma UPA.

## Decisões para o RT

**Decisão do RT em 06/11/2026: A em B1 a B6 ("Sim, todas A").**

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| B1 | O que é entregue | Consultas em Power Query (M), em arquivos de texto no repositório (`docs/api/powerbi/*.pq`), e um passo a passo de 1 página para a secretaria colar no Power BI Desktop. Não há Power BI Desktop aqui para gerar um modelo `.pbit` | Um arquivo `.pbit` pronto, que precisa do Power BI Desktop instalado nesta máquina |
| B2 | Recursos | Unidades, leitos, atendimentos e produção SUS (AIH, APAC e fechamentos), como no achado. O financeiro fica fora | Incluir também o financeiro |
| B3 | Período dos atendimentos | Parâmetro "dias para trás" (padrão 90). A consulta divide o período em janelas de até 31 dias e junta tudo | Só os últimos 31 dias |
| B4 | Chave | Uma chave só do painel: os recursos de B2, as unidades da secretaria e a lista com o IP do gateway (B5). A chave fica num parâmetro, e o passo a passo avisa que o `.pbix` não pode ser compartilhado | Mudar a API para aceitar a chave no endereço. Não recomendo: a chave iria parar em logs |
| B5 | Atualização agendada e a regra "Fora do Brasil" | Gateway local (on-premises data gateway) num computador da secretaria, no Brasil. A regra do Cloudflare fica como está, e o IP fixo do gateway entra na lista de IPs da chave | Abrir exceção no Cloudflare para os IPs da Microsoft, o que libera a API para a nuvem da Microsoft inteira |
| B6 | Como provar que funciona | Um script de conferência no repositório faz a mesma paginação das consultas contra a API da homologação, com uma chave de teste, e confere as contagens. O RT confere no Power BI Desktop dele | Só o RT testa no Power BI |

## Plano com A em tudo
1. **Testes antes:** um teste de unidade da lógica de janelas de 31 dias e da paginação, numa função JavaScript que espelha o M, com uma API falsa: várias páginas, 429 com `Retry-After`, lista vazia e cursor nulo.
2. **Consultas M** (`docs/api/powerbi/`):
   - parâmetros: endereço base, chave e dias para trás;
   - uma função `CorujaLista(caminho, filtros)` que pagina pelo `proximo_cursor`;
   - uma consulta por recurso, com os tipos de coluna definidos.
3. **Script de conferência** (`scripts/powerbi/conferir.mjs`): roda só contra a homologação e recusa chave de produção (`cc_live_`), como o simulador do LIS.
4. **Passo a passo de 1 página** (`docs/api/powerbi/PASSO-A-PASSO.md`), com os passos:
   - criar a chave;
   - colar as consultas;
   - preencher os parâmetros;
   - publicar;
   - instalar o gateway;
   - pôr o IP do gateway na chave;
   - agendar a atualização.
5. **Homologação:**
   - eu crio uma chave de teste em Integrações (API) e rodo o script de conferência;
   - o RT cola as consultas no Power BI Desktop e confere.
   - Não há migration, deploy de função nem mudança de tela.

## Riscos
- **Chave vazada junto com o `.pbix`:** a chave só lê, com escopo mínimo e lista de IPs, e pode ser revogada em Integrações (API).
- **Painel desatualizado:** o painel mostra a hora da última atualização, e o passo a passo deixa claro que ele não é ao vivo.
