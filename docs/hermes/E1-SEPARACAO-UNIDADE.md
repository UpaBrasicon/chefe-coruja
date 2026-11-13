# E1: o corpus fica no Qdrant, com separação por unidade provada

Trilha Hermes / Evidências, tarefa 1. Decisão do RT de 12/11/2026: E1 = A. O corpus continua no Qdrant do VPS, o `BACKLOG.md` passa a descrever o que existe, e a tarefa 1 fecha com o teste de separação por unidade (`docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md`).

## Como a separação funciona

- Cada trecho tem `tenant_id`: `global` (todas as unidades) ou o id de uma unidade (`fontes.yaml`, gravado por `ingest.py`).
- A Edge `clinical-search` só aceita pergunta de quem tem vínculo ativo com a unidade (ou é super admin) e manda à biblioteca `tenant_id = unidade_id`.
- Na biblioteca, as duas consultas ao corpus, a densa (`query_points`) e a por palavra (`scroll`), levam o filtro `tenant_id = global OU a unidade` (`main.py`, `buscar` e `filtro_tenant`).
- A coleção `ferramentas` não tem `tenant_id`, porque é a lista das ferramentas da Central, igual para todos.
- Hoje todas as fontes são `global`. A separação passa a pesar quando houver protocolo próprio de uma unidade, ou se a E7 restringir os livros sem licença a uma rede.

## Teste

`biblioteca/app/test_separacao_unidade.py` roda contra o Qdrant de verdade:
- cria uma coleção temporária com um trecho global, um da unidade A e um da unidade B;
- chama a mesma `buscar` da API;
- apaga a coleção no fim.

As coleções `biblioteca` e `biblioteca_homolog` não são tocadas.

| Caso | Esperado |
|---|---|
| unidade A | global e A |
| unidade B | global e B, nunca A |
| outra unidade | só global |
| `tenant_id` "global" ou "*" | só global (não abre tudo) |

**Execução em 13/11/2026**, dentro do container `biblioteca-api-homolog`: 4 de 4 passaram. A coleção temporária foi apagada, e depois ficaram só `biblioteca`, `biblioteca_homolog` e `ferramentas`.

O teste não entra no CI do GitHub, porque precisa do Qdrant e das variáveis da imagem. Ele roda no container, com `python -m unittest test_separacao_unidade`, como os outros testes da biblioteca.

## Diferenças em relação ao texto antigo da tarefa 1

| O BACKLOG pedia | O que existe |
|---|---|
| Tabelas `evidence_sources` e `evidence_chunks` no Supabase, com pgvector | Coleção `biblioteca` no Qdrant e registro das fontes em `fontes.yaml` |
| RLS por `tenant_id` | Filtro de `tenant_id` em toda consulta ao corpus, com acesso à biblioteca só pela Edge (vínculo com a unidade) e chave de serviço |
| Índice HNSW | HNSW padrão do Qdrant, com índices de `tenant_id`, `fonte_id` e `texto` |
| Policies testadas antes de dado real | `test_separacao_unidade.py`, passando em 13/11/2026 |
