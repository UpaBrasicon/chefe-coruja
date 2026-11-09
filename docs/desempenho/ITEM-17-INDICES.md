# Item 17 — Índices nas consultas comuns

Trilha de desempenho (kit de 31 passos). **Decisão do RT em 09/11/2026: A, agora** ("Todas como recomendado"): trigram no nome do paciente, as 8 políticas RLS do advisor, índices nas chaves das tabelas que crescem, `EXPLAIN ANALYZE` antes e depois na homologação.

## Diagnóstico

- **Busca de paciente** (`buscar_pacientes`, usada pela recepção, porta, Hiperdia, pré-natal, agenda, reserva de leito, recém-nascido). Filtra a unidade e depois aplica `LIKE '%termo%'` sobre `private.nome_comparavel(...)` em nome, nome social e nome da mãe, e compara CPF, CNS e os dígitos do prontuário, tudo num `OR` só. Com parâmetros, o plano não usa índice nenhum: lê todos os pacientes da unidade a cada busca.
- **8 políticas RLS** (advisor `auth_rls_initplan`): `auth.uid()` reavaliado em cada linha (`aceites_termo`, `adesoes_contrato`, `clinical_search_feedback`, `preferencias_aviso` ×3, `dispositivos_confiaveis` ×2).
- **Chaves estrangeiras sem índice**: 129 fora das colunas de autoria. Escolhidas 52, nas tabelas que crescem com o uso (AIH, APAC, contas, classificações, intercorrências, isolamentos, regulação, reservas, episódios, checagens, procedimentos, agendamentos, contrarreferências, encaminhamentos, dispensações, estoque, aprazamentos, pré-natal, programas, eventos de AIH/APAC, faltas, contingência, webhooks). Colunas de autoria (`por`) e catálogos ficam sem índice de propósito.

## Correção

Migration `20270320000002_busca_pacientes_indices_rls.sql` (só cria; reaplicável):

1. `pg_trgm` no esquema `extensions`; índices GIN trigram em `nome_comparavel(nome)`, `(nome_social)` e `(nome_mae)`; índice em `(unidade_id, so_digitos(prontuario))`. CPF e CNS já tinham índice por unidade.
2. `buscar_pacientes` reescrita com um ramo por índice (`UNION ALL`; a deduplicação que já existia junta o paciente achado por mais de um ramo). Resultado igual. A troca só acontece se a função estiver igual à da homologação (md5 `b4cb21d0…`) ou já trocada (`dc716fef…`); senão a migration para.
3. As 8 políticas com `(SELECT auth.uid())`: mesma regra, avaliada uma vez por consulta.
4. 52 índices `*_fk_idx`.

Rollback: `docs/desempenho/ROLLBACK-20270320000002.sql` (volta a função e as políticas, tira os índices; a extensão fica).

## Medição (homologação, 09/11/2026)

Transação desfeita, 50 mil pacientes sintéticos na UPA Fase 5, gestor de teste (JWT simulado), melhor de 5 chamadas a `buscar_pacientes`:

| Busca | Antes | Depois |
|---|---|---|
| Nome raro ("zuleica", 3 achados) | 628 ms | **1,6 ms** |
| Sobrenome comum ("oliveira", 7 mil achados, devolve 20) | 592 ms | **81 ms** |
| CPF (11 dígitos, nenhum achado) | 651 ms | **10 ms** |

Consulta isolada, por ramo: nome 610 → 0,3 ms; documento 108 → 0,1 ms. O `EXPLAIN ANALYZE` do ramo do nome passou de leitura da unidade inteira para `Bitmap Index Scan` no trigram. Índices da busca: cerca de 5 MB para 50 mil pacientes.

## Testes e homologação

- `supabase/tests/desempenho_17_busca_rls.sql`: cada ramo acha (nome sem acento, nome da mãe, CPF com pontuação, dígitos do prontuário); o paciente achado por mais de um ramo sai uma vez; os 4 índices da busca existem e o `LIKE` usa o trigram; 52 índices de chave; as 8 políticas com `(SELECT auth.uid())`; a regra das preferências de aviso não mudou. Depende do `seed.sql` (roda no CI). A busca em si continua coberta por `fase2_ficha_episodio.sql`.
- Homologação: migration aplicada pelo SQL em 09/11/2026, versão `20270320000002` registrada; conferido 3 índices trigram + prontuário, 52 de chave, 8 políticas, md5 novo da função; busca real do gestor de teste funcionando. Rollback testado numa transação desfeita (tira tudo e a versão).

## Produção

Sem "ok produção" ainda: pedir com o número `20270320000002` e o CI do banco verde. Sem mudança de tela.

## Medição na tela logada

Pendente para quando o RT voltar ao computador; o item 30 (métricas de usuários reais) mostra o efeito nas telas de busca.
