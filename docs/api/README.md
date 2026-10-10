# API do Chefe Coruja

Documentação da Fase 3, tarefa 6. As decisões do RT de 10/10/2026 estão no
BACKLOG.

| Arquivo | Para quem | O que é |
|---|---|---|
| `openapi.yaml` | Integradores e equipe | Contrato da API pública v1 (OpenAPI 3.1). É a fonte da verdade. |
| `index.html` | Integradores | Página legível gerada do contrato (Redoc). Pode ser enviada ao integrador. |
| `catalogo-rpc.md` | Equipe interna | Funções do banco que o frontend chama, com parâmetros e onde são usadas. |

## Situação

O contrato v1 está pronto. A implementação é a **tarefa 7** da Fase 3:
- a Edge Function em `api.chefecoruja.com.br/v1`;
- as chaves por integrador;
- o limite de requisições no Cloudflare;
- a auditoria.

Até lá, os endereços não respondem.

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

## Para a equipe

- `npm run api:lint`: valida o contrato. O CI roda isso no job web.
- `npm run api:pagina`: gera `index.html` de novo. Rode depois de mudar o
  `openapi.yaml`.
- `npm run api:catalogo`: gera `catalogo-rpc.md` de novo. Rode depois de
  criar ou mudar RPC.
