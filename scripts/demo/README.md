# Unidade de demonstração (pedido 8, J4)

Roteiros da "Rede de Demonstração": a UPA 24h Jardim Primavera, com equipe e pacientes fictícios, para as telas da página de entrada e para a demonstração ao vivo. Diagnóstico e decisões do RT (G1–G4, 12/11/2026): `docs/landing/J4-UNIDADE-DEMONSTRACAO-DIAGNOSTICO.md`.

**Só na homologação. Nunca na produção.** Todo roteiro começa com uma trava: se o banco não tiver a "UPA Homologação" (`31000000-…-0001`), ele para sem gravar nada.

## Ordem

| Arquivo | O que faz | Quando |
|---|---|---|
| `01_rede_demonstracao.sql` | Organização, unidade, setores, leitos, 24 pessoas fictícias sem senha, vínculos e a escala 12x36 do mês corrente e do seguinte, publicada pela coordenadora | Uma vez, e de novo quando virar o mês |
| `02_plantao_agora.sql` | Apaga os pacientes da unidade, faz o check-in dos plantões já começados e cria o plantão de agora pelas funções do banco, como cada pessoa de plantão | Antes de cada captura ou apresentação |
| `03_acesso_conta.sql` | Dá à conta indicada os papéis gestor e plantonista na unidade e a escala de hoje no Pronto Socorro | Uma vez por conta (troque o e-mail antes) |
| `99_limpar_rede_demonstracao.sql` | Apaga a rede inteira, inclusive os acessos dados pelo 03 | Só quando a unidade não for mais usada |

## Como rodar

1. Confira que o projeto ligado é a homologação (`kswurfyxxvfydpjfrivy`). Num worktree, copie antes a pasta `supabase/.temp` do checkout principal.
2. Rode cada arquivo pelo CLI:

   ```bash
   npx supabase db query --linked -f scripts/demo/01_rede_demonstracao.sql
   npx supabase db query --linked -f scripts/demo/02_plantao_agora.sql
   ```

3. No `03`, troque `TROQUE-PELO-SEU-EMAIL@exemplo.com` pelo e-mail da conta numa cópia local (não suba o e-mail no git) e rode a cópia do mesmo jeito.

Os arquivos não usam comandos do psql (`\set`) nem senha. Por isso não passam pelo `scripts/e2e/homolog/preparar.mjs`.

## O que fica na unidade

- **Equipe:** coordenadora (gestor), farmacêutica e quatro equipes 12x36 (dia e noite, dias pares e ímpares). Cada equipe tem recepção, enfermagem da classificação, técnico da Observação Adulto, médico do Pronto Socorro e médico da Sala Vermelha. Dois pediatras cobrem o diurno da Observação Pediátrica.
- **Contas da equipe:** e-mail `@demo.local`, senha vazia e conta bloqueada até 2999. Ninguém entra com elas.
- **Plantão do `02`:** 17 pacientes (13 adultos e 4 crianças) e 4 altas de mais cedo.
  - Porta: 2 aguardando triagem, 5 aguardando médico, 1 em atendimento e 1 em reavaliação.
  - Leitos: Observação Adulto 4 de 6, Observação Pediátrica 2 de 3, Sala Vermelha 2 de 2. São 8 de 11 leitos ocupados (73%).
  - Cada passo passa pelas funções do banco, com RLS: `registrar_ficha`, `classificar_risco`, `iniciar_atendimento`, `registrar_soap`, `pedir_exames_atendimento`, `aguardar_reavaliacao` e `registrar_desfecho`. Depois, os horários são recuados para esperas plausíveis.

## Limites

- **Sem prescrição.** A prescrição exige dose, via e frequência escritas, e o roteiro não inventa dose. O indicador "medicação pendente" fica em 0.
- **Autoria.** Tudo sai em nome da equipe de plantão na hora em que o `02` roda, inclusive as altas "de mais cedo". É assim porque as funções só aceitam quem está de plantão agora.
- **Check-in da conta do `03`.** Fica para quem entra, como em `supabase/homolog/demo-preparar.sql`. Sem ele, depois de 30 min a porta do médico fecha. As telas do gestor não dependem da escala.
- **`session_replication_role = replica`.** O `02` e o `99` usam esse modo para limpar e recuar horários, como `scripts/e2e/99_limpar_rede_e2e.sql`, porque as tabelas clínicas são só de inserção. A limpeza segue as chaves estrangeiras pelo catálogo.
- **Auditoria.** O `99` apaga a auditoria da unidade, e a cadeia de hash da homologação fica sem essas linhas, como na limpeza da rede E2E.

## Dependências na homologação

- Protocolo de classificação carregado (`supabase/dados/protocolo_aparecida_2025.sql`). O `01` para se não houver nenhum.
- CID-10 do DATASUS (`terminologia.cid10`). Os CIDs do `02` são os que os roteiros e2e já usaram.
- Não usa o catálogo de medicamentos, o esquema `e2e` nem os utilitários do framework e2e.
