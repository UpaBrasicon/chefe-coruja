# ANVISA: Lista CMED e vigia das ampolas

Pedido do RT de 20/11/2026: facilitar a busca das concentrações das ampolas para a dose em mL e manter a lista atualizada a cada 15 a 30 dias.

## O que cobre
- `scripts/anvisa/lista-cmed.mjs` baixa a lista de medicamentos da CMED. São todas as apresentações à venda, com substância, laboratório, registro, apresentação e se o produto foi comercializado no último período. A lista fica em cache em `scripts/anvisa/.cache/`, fora do git. Modos:
  - `--atualizar`: acha a planilha PMC mais nova na página pública da CMED (gov.br/anvisa), baixa e converte.
  - `--planilha <xlsx>`: converte uma planilha já baixada.
  - `--baixar`: usa a API da ANVISA (`api.anvisa.gov.br`, Lista CMED). Precisa de credencial. Em 20/11/2026 o token saiu, mas a lista respondeu 403. Com a chave nova, o token respondeu "Invalid client secret". Por isso o vigia usa a planilha pública.
  - `--injetaveis termo1,termo2`: lista as apresentações injetáveis de substância única.
  - `--conferir`: compara as ampolas cadastradas (`src/clinico/pediatria/ampolas.ts`, mais a adrenalina e o magnésio de `src/clinico/adulto/ampolasAdulto.ts`) com a CMED. Conta só as apresentações à venda, por decisão do RT de 20/11/2026. Lista as concentrações que o cadastro não tem e sai com código 1 quando acha alguma.
- `.github/workflows/cmed-vigia.yml` roda nos dias 1 e 16 de cada mês, às 08:00 de Brasília, e também à mão (workflow_dispatch). Atualiza a lista e confere as ampolas. Quando acha concentração nova, abre um aviso no GitHub, ou comenta no aviso que já estiver aberto, para o RT decidir.

## O que não cobre
- A CMED só traz o que tem preço regulado. Por exemplo, o gluconato de cálcio não aparece. Para esses itens a fonte continua sendo a bula ou o livro.
- O vigia não muda nenhuma ficha nem nenhuma ampola. Toda concentração nova passa pela decisão do RT, pela ficha `ped-ampolas` ou `adulto-ampolas` e pelo gate LG10.
- Ficam fora da conferência: o cálcio (dose em elemento), o bicarbonato (a CMED dá mg/mL e o cadastro usa mEq/mL) e a naloxona em µg (é a mesma ampola da naloxona em mg).

## Chaves envolvidas
- A planilha pública não precisa de chave.
- A API usa `ANVISA_CLIENT_ID` e `ANVISA_CLIENT_SECRET`, do ambiente ou do arquivo `scripts/anvisa/.credenciais`, que está no `.gitignore`. O client_id é o CPF de quem gerou a credencial. É dado pessoal: fica só no arquivo local e o script nunca o imprime. O vigia do GitHub não usa a API, então nenhum segredo vai para o repositório.

## Como reverter
Apague `.github/workflows/cmed-vigia.yml` para parar o vigia. O script não mexe em banco nem em tela.
