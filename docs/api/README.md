# API do Chefe Coruja

Documentação da Fase 3, tarefa 6. As decisões do RT de 10/10/2026 estão no
BACKLOG.

| Arquivo | Para quem | O que é |
|---|---|---|
| `openapi.yaml` | Integradores e equipe | Contrato da API pública v1 (OpenAPI 3.1). É a fonte da verdade. |
| `index.html` | Integradores | Página legível gerada do contrato (Redoc). Pode ser enviada ao integrador. |
| `catalogo-rpc.md` | Equipe interna | Funções do banco que o frontend chama, com parâmetros e onde são usadas. |
| `implantacao.md` | Equipe e RT | Publicação: migration, Edge Function, segredo da borda e Cloudflare. |

## Situação

- Contrato v1 pronto (tarefa 6).
- Implementação pronta (tarefa 7):
  - Edge Function `supabase/functions/api`;
  - chaves em **Integrações (API)**;
  - porta única `public.api_v1` no banco, com auditoria.
- A publicação segue o passo a passo de `implantacao.md`, que inclui o
  Cloudflare.

## Resumo para o integrador

- **Acesso:** chave criada pelo administrador do Chefe Coruja, no cabeçalho
  `Authorization: Bearer <chave>`.
  - A chave vale só para as unidades e os recursos liberados nela.
  - Ela aparece uma vez, na criação. Se perder, peça outra.
- **Só leitura:**
  - pacientes, por busca exata de CNS ou CPF;
  - atendimentos, por período de até 31 dias;
  - leitos;
  - produção SUS: AIH, APAC e fechamentos de competência.
- **Dados do paciente:** o mínimo necessário (LGPD): nome, nome social,
  nascimento, sexo, CNS e município. O CPF só vem quando o paciente não tem
  CNS. Não vêm endereço, telefone, nome da mãe nem dados clínicos, fora a cor
  de risco, o CID principal e a situação do atendimento.
- **Erros** no formato RFC 9457:

  | Código | Quando |
  |---|---|
  | 400 | Parâmetro ausente ou inválido |
  | 401 | Chave ausente, inválida ou revogada |
  | 403 | Unidade ou recurso fora da chave |
  | 404 | Não existe ou está fora do escopo (as duas situações respondem igual) |
  | 429 | Limite por minuto excedido (veja `Retry-After`) |
  | 500 | Erro do servidor (mande o `requisicao` ao suporte) |

- **Versão:** `/v1` no caminho. Campo novo não quebra a versão; mudança
  incompatível vira `/v2`, e a anterior fica pelo menos 6 meses.

### Exemplo

```bash
curl -s "https://api.chefecoruja.com.br/v1/atendimentos?unidade_id=21000000-0000-4000-8000-000000000001&desde=2026-10-01T00:00:00-03:00&ate=2026-10-02T00:00:00-03:00&limite=50" \
  -H "Authorization: Bearer $CHEFE_CORUJA_CHAVE"
```

## Laboratório (LIS) — porta FHIR R4

Fase 5C, tarefa 1, etapa 1.3 (decisões do RT de 19/10/2026 no BACKLOG).

- **Chave:** criada em **Integrações (API)** com o recurso "Laboratório (LIS)".
  Ela só lê os pedidos de exame e só grava coleta, situação e laudo.
- **Pedidos:** `GET /v1/fhir/ServiceRequest` devolve um Bundle com os pedidos
  com código ainda pendentes (pedido, coletado ou em análise), com o paciente
  contido. Exame pedido em texto livre não sai do sistema.
- **Coleta:** `POST /v1/fhir/Specimen`.
- **Situação e laudo:** `POST /v1/fhir/DiagnosticReport`. `preliminary` põe em
  análise; `final` grava o resultado (analitos e PDF); `amended` grava versão
  nova; `cancelled` cancela. O mesmo laudo reenviado não vira versão nova.
- **Erros:** `OperationOutcome` FHIR. Cada chamada fica em **Integrações (API)**
  → acessos da chave.
- **O que a porta oferece:** `GET /v1/fhir/metadata` (sem chave).

### Testar sem LIS real (só homologação)

`scripts/lis-simulador.mjs` faz o papel do laboratório: busca os pedidos,
registra a coleta, põe em análise e devolve um laudo de TESTE (o texto
"TESTE — simulador, não é exame real" e um PDF de teste). Reenvia o mesmo
laudo para mostrar que ele não duplica. Recusa chave de produção (`cc_live_`).

```bash
LIS_URL=https://<projeto>.supabase.co/functions/v1/api/v1 LIS_CHAVE=cc_test_... node scripts/lis-simulador.mjs --critico
```

`--critico` marca o analito de teste como crítico do laboratório, para ver o
aviso; `--sem-pdf` não manda o PDF; `--limite N` trata N pedidos (padrão 5).

## Para a equipe

- `npm run api:lint`: valida o contrato. O CI roda isso no job web.
- `npm run api:pagina`: gera `index.html` de novo. Rode depois de mudar o
  `openapi.yaml`.
- `npm run api:catalogo`: gera `catalogo-rpc.md` de novo. Rode depois de
  criar ou mudar RPC.
