# ERP/financeiro: contas e plantões para o ERP (Fase 5C, tarefa 3)

Decisões do RT de 27/10/2026: "1a 2a 3a 4a 5a" para as contas, "o ERP entra tudo: remédio,
procedimento, plantões" e "1a 2a 3a" para os plantões. Etapas: 3.1 contas (PR #270), 3.2 plantões
(PR #271), 3.3 porta da API (este documento), 3.4 telas.

## Como funciona

- **Quem puxa:** o ERP busca pela API v1, com uma chave que tenha o recurso `financeiro`. O
  Chefe Coruja não manda nada sozinho, e por isso não há webhook nem IP fixo de saída.
- **Contas:** quando o faturamento marca a conta como **faturada**, nasce uma versão. Ela leva:
  - o cabeçalho e os itens guardados no fechamento (código SIGTAP, quantidade, valor de referência);
  - os medicamentos, só em quantidade, sem valor;
  - o total e as glosas atuais.

  Do paciente vai só o prontuário: nem nome, nem CPF/CNS, nem CID. Glosa nova ou alterada devolve
  a versão à lista do ERP.
- **Plantões:** quando o gestor fecha o mês (só depois de o mês acabar), nasce uma versão. Ela
  leva:
  - os plantões da escala, com a presença (check-in, check-out, minutos);
  - a falta justificada;
  - o valor da tabela de remuneração da unidade.

  Só o plantão realizado soma no total. Do profissional vão nome, CPF, conselho, registro com UF e
  CBO.
- **Retorno:** o ERP responde por versão.
  - `lancada`, com o id e o valor do lançamento: o sistema marca `conciliada` (valor igual ao
    total) ou `divergente`.
  - `estornada`: só vale para a versão substituída.
  - O retorno não muda a conta nem o mês, e o reenvio igual não muda nada.
- **Correção:** o gestor reabre a conta ou o mês, com motivo, e a versão vigente fica
  `substituida`. O ERP estorna essa versão. O faturamento ou o fechamento seguinte gera a próxima.

| Rota (base `https://<projeto>.supabase.co/functions/v1/api/v1`, ou `api.chefecoruja.com.br/v1`) | Ação no banco |
|---|---|
| `GET /financeiro/contas?unidade_id&desde&situacao&conciliacao&limite&cursor` | `contas` |
| `GET /financeiro/contas/{conta_id}` | `conta` |
| `POST /financeiro/contas/{conta_id}/versoes/{n}/retorno` | `retorno` |
| `GET /financeiro/plantoes?unidade_id&desde&competencia&situacao&conciliacao&limite&cursor` | `plantoes` |
| `POST /financeiro/plantoes/{versao_id}/retorno` | `plantoes_retorno` |

Contrato completo em `docs/api/openapi.yaml`, seção "Financeiro (ERP)".

## O que cobre

- Leitura das versões das contas faturadas e dos plantões fechados, com filtro, paginação e busca
  incremental (`desde`, pela `alterada_em`).
- Retorno e conciliação por versão, e o estorno da versão substituída.
- Registro:
  - cada chamada em `api_acessos` (chave, ação, unidade, status, IP);
  - cada mudança da conta em `conta_eventos` e na auditoria;
  - cada fechamento, reabertura e retorno dos plantões na auditoria.
- Chave por unidade, com limite por minuto, lista de IP e validade, como nas outras chaves da API.
- Simulador `scripts/erp-simulador.mjs`, só para homologação.

## O que não cobre

- Envio ativo ao ERP (webhook ou fila): fica para a tarefa 4 (Webhooks).
- Leiaute de ERP específico (TOTVS, MV, SAP): fica para quando houver cliente, como adaptador.
- Valor de medicamento e de material: o consumo vai sem valor (decisão da 5B-3). Materiais seguem
  pendentes.
- Retorno de pagamento do SUS (valor pago, glosa do SIA/SIH): pendência da 5B-6. As glosas vão
  como estão registradas à mão.
- Convênio e TISS: adiados (5B-7). Hoje só há conta SUS.
- Tela do faturamento e do gestor (versões, conciliação, baixar CSV/JSON, fechar o mês): etapa 3.4.
  Até lá, o gestor fecha o mês pela função `fechar_plantoes_erp`.

## Chaves envolvidas (só nomes; valores ficam nos painéis)

- **Chave do ERP:** criada pelo super admin em Administração › Integrações, com o recurso
  "Financeiro (ERP)" e as unidades. Vale 12 meses. O gestor da unidade vê e revoga. O sistema
  guarda só o hash.
- `SUPABASE_SERVICE_ROLE_KEY` (ou a chave secreta nova): segredo da Edge Function `api`. É a única
  que executa `api_v1_financeiro`.
- `API_BORDA_SEGREDO`: o mesmo da borda Cloudflare, para o IP de origem valer na lista de IP da
  chave (`docs/api/implantacao.md`).

## Banco

| Migration | O que faz |
|---|---|
| `20270120000001_erp_contas.sql` | `conta_versoes_erp`, gatilhos na conta e na glosa, `api_v1_financeiro` (contas), recurso `financeiro` na chave |
| `20270120000002_erp_plantoes.sql` | `plantao_versoes_erp`, `plantoes_erp_previa`, `fechar_plantoes_erp`, `reabrir_plantoes_erp` (gestor, segundo fator) |
| `20270120000003_api_financeiro_plantoes.sql` | ações `plantoes` e `plantoes_retorno` na porta |

Testes: `supabase/tests/fase5c_erp_contas.sql`, `fase5c_erp_plantoes.sql` e
`fase5c_api_financeiro_plantoes.sql`. Eles não dependem da semente local e rodam também na
homologação. As regras da Edge Function estão em `supabase/functions/api/financeiro.test.ts`, no CI.

## Teste na homologação

1. **Chave:** em Administração › Integrações, crie uma chave `test` com o recurso "Financeiro
   (ERP)" e a unidade.
2. **Conta:** em Faturamento › Contas, leve uma conta até "faturada".
3. **Plantões:** feche um mês já encerrado, pela tela da 3.4 ou por `fechar_plantoes_erp`.
4. **Simulador:**

   ```bash
   ERP_URL=https://kswurfyxxvfydpjfrivy.supabase.co/functions/v1/api/v1 ERP_CHAVE=cc_test_... node scripts/erp-simulador.mjs
   ```

   Ele lança cada versão vigente e reenvia o primeiro retorno. Com `--divergir`, lança R$ 0,01 a
   menos.
5. **Correção:** reabra a conta ou o mês e rode o simulador de novo. Ele estorna a versão
   substituída. Fature ou feche de novo e rode mais uma vez: a versão 2 é lançada.

## Evidência (homologação, 27/10/2026)

- **Banco:** as três migrations foram aplicadas.
  - A `20270120000001` e a `20270120000002` foram com `homolog:push`.
  - A `20270120000003` foi pelo SQL, com a versão registrada em `schema_migrations`. O `db push`
    recusaria, porque a homologação já tem uma migration posterior de outra sessão (`20270131000001`).
- **Testes de banco:** cada teste e cada rollback rodaram juntos com a migration numa transação
  desfeita, e tudo passou.
- **Função:** a Edge Function `api` foi publicada com a versão `999a0df`.
- **Ponta a ponta:** com uma chave temporária, já revogada:

  | Chamada | Status |
  |---|---|
  | `GET /financeiro/contas` e `GET /financeiro/plantoes` | 200 |
  | conta e versão inexistentes | 404 |
  | corpo errado | 400 |
  | método errado | 405 |
  | sem chave | 401 |
  | unidade fora da chave | 403 |
  | `/unidades` (rota antiga) | 200 |

  Cada chamada ficou em `api_acessos`. O fluxo com dados (lançar, divergir, estornar) foi
  conferido pelos testes de banco. Na homologação, o RT confere com o simulador.

## Como reverter

1. **Edge Function:** publicar a `api` do commit anterior. A função antiga não tem as rotas
   `/financeiro`, e o ERP passa a receber 404.
2. **Chaves:** revogar as chaves com o recurso `financeiro` (Administração › Integrações).
3. **Banco**, na ordem inversa, com o rollback escrito no cabeçalho de cada migration:
   - a `20270120000003` volta a porta da 3.1;
   - a `20270120000002` tira os plantões;
   - a `20270120000001` tira as versões das contas e o recurso.

   As versões já geradas saem junto com as tabelas. Os eventos e a auditoria ficam como histórico.
