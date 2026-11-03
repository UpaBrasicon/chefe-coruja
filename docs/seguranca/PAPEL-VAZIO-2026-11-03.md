# Papel vazio liberava a leitura de outra unidade (03/11/2026)

Achado no portão da Fase 5, na etapa da UBS, pelo passo de permissão "conta de outra rede não lê os retornos da UBS". O RT autorizou corrigir na hora, como bug crítico em produção, fora da regra de não corrigir durante a rodada.

## O defeito

`private.papel_na_unidade(u)` devolve `''` (texto vazio) quando a pessoa não tem vínculo na unidade. Nunca devolve NULL. Nove funções liberavam a leitura com `private.papel_na_unidade(u) IS NOT NULL`, um teste que é sempre verdadeiro. Assim, qualquer usuário logado lia a unidade de outro:

| Função | O que vazava | Desde |
|---|---|---|
| `pendencias_pep` | nome do paciente e documentos pendentes | 22/10/2026 |
| `admissao_detalhes_config` | configuração da admissão | 05/10/2026 |
| `receita_protocolos_da_unidade` | protocolos de receita da unidade | 07/10/2026 |
| `agenda_dia`, `agenda_configuracao` | agenda da UBS (nomes dos pacientes marcados) | 02/11/2026 |
| `encaminhamentos_upa_origem`, `encaminhamentos_upa_do_paciente` | envios à UPA com o resumo clínico | 03/11/2026 |
| `contrarreferencias_da_unidade`, `contrarreferencias_do_paciente` | retornos (nome, desfecho, unidade) | 03/11/2026 |

Na produção, as funções da UBS ainda não tinham dado, porque nenhuma UBS está em uso. As três primeiras são da UPA e alcançavam dado real: nomes de pacientes com documento pendente.

## O conserto

Migration `20270219000001_papel_vazio_nega_acesso.sql`. No corpo de cada função, o teste passa a ser `coalesce(private.papel_na_unidade(x), '') <> ''`, o mesmo das funções de acesso ao prontuário. Assinatura, `SECURITY DEFINER`, `search_path` e grants não mudam.

O teste `supabase/tests/papel_vazio_sem_acesso.sql` verifica três coisas:
- nenhuma função tem o padrão errado. Ele roda no CI, então barra a volta do padrão em migration nova;
- quem é de outra unidade é recusado;
- a própria unidade continua aberta.

**Homologação (03/11/2026):** aplicada duas vezes. O padrão errado caiu de 9 funções para 0, e os grants não mudaram. O rollback volta ao estado anterior, o teste falha sem a migration e, reaplicada, o retrato fica igual (md5 das 9 funções 0e57f444…).

## Lição

O padrão veio de `documentos_porta` (05/10) e foi copiado depois, inclusive nas tarefas 3, 5 e 6 da 5A. Para liberar pelo vínculo, use `coalesce(private.papel_na_unidade(x), '') <> ''` ou `private.tenho_papel(x, papel) IS TRUE`. O teste do CI barra o padrão antigo.
