# Fechamento de fases — auditoria e pendências

> Atualizado na revisão de fechamento da Fase 4A e no fechamento da varredura Strix
> (VULN-0001 e VULN-0002 corrigidas — ver `docs/seguranca/strix-fechamento.md`).

## Status das fases

| Fase | Tema | Status |
|---|---|---|
| 1 | Terminologias (CID-10, SIGTAP, CBO, CMED, LOINC pt-BR) | ✅ Concluída — 157k linhas no Supabase |
| 2 | Modelo conceito + observação (OpenMRS/FHIR) | ✅ Concluída — schema, gráfico, flowsheet |
| 3.0 | VIDaaS PSC (prova de conceito isolada) | ⏸️ **Bloqueada** — aguarda manual oficial em `docs/vidaas/` e credenciais de homologação |
| 4A | Camada FHIR + outbox (sem envio) | ✅ Concluída — mappers, outbox, gatilho, validação local |

## Auditoria de segurança (revisão de fechamento 4A)

- **RLS**: 57/57 tabelas com RLS habilitado; 0 sem.
- **Políticas `using (true)`**: todas com papel qualificado (`TO authenticated` para dados públicos de terminologia; `TO service_role` para escrita) — nenhuma sem qualificação.
- **SECURITY DEFINER**: 0 funções sem `SET search_path` (todas fixas).
- **Segredos**: scan limpo — nenhuma chave/token/certificado no repositório; `.env.local` não rastreado; `spikes/vidaas/saida/` no gitignore.
- **Migrations destrutivas**: todas com bloco `DOWN` documentado (00003, 00005, 00008, 00010 têm DROP TABLE + down; 00011/00012 têm drop de trigger/função/revoke).

## Correção das vulnerabilidades Strix (VULN-0001 e VULN-0002)

Varredura com Strix (Anthropic `claude-sonnet-4-6`, run `chefe-coruja_e27a`) encontrou 2
achados HIGH, ambos **corrigidos e verificados**:

| Achado | Severidade | Correção | Verificação |
|---|---|---|---|
| VULN-0001 — bucket `atendimento` sem escopo por unidade (CWE-862, cross-tenant PHI) | HIGH (CVSS 7.1) | `20260817000013_fix_atendimento_bucket_rls.sql`: policies `atendimento_upload/read/update/delete` exigem primeiro segmento do path = `unidade_id` com vínculo gestor/plantonista ativo (ou super), via `private.unidades_gestor_plantonista()` | Aplicada no remoto (saqjrjtrkzkswsxxvdxn); dump do schema `storage` confirma as 4 policies com escopo por path |
| VULN-0002 — XSS armazenado nos 8 fluxos de impressão (CWE-79, `document.write` com dados do paciente) | HIGH (CVSS 8.7) | `escapeHtml()` de `src/lib/utils.ts` aplicado em todos os campos interpolados nos 8 arquivos | typecheck/lint/build limpos; testes 43/43 |

Arquivos corrigidos na VULN-0002: `ReceituarioMedico.tsx`, `Encaminhamento.tsx`, `PedidoExames.tsx`,
`AtestadoMedico.tsx`, `PrescricaoTab.tsx`, `EvolucaoTab.tsx`, `ExamesTab.tsx`, `InternacaoTab.tsx`.

> **Ação recomendada**: as chaves Anthropic usadas na varredura foram coladas no chat — rotacione-as
> no console da Anthropic após o uso.

## Pendências abertas

| # | Pendência | Fase | Bloqueia? |
|---|---|---|---|
| 1 | Manual VIDaaS PSC + credenciais de homologação | 3.0 | Sim (não roda sem) |
| 2 | IG oficial da RNDS (`docs/rnds/` vazio) — confirmar `system` de CID-10/CBO/CNES/CPF e perfil de Sumário de Alta | 4A/4B | Parcial (TODOs marcados no código) |
| 3 | Validador Java da RNDS em `tools/rnds/validador-rnds.jar` | 4A | Critério de aceite (validação local) |
| 4 | CBO do profissional (carregador usa null) | 4A | Parcial (enriquecer perfil) |
| 5 | Descrição do CID no carregador (busca null) | 4A | Baixa (display) |
| 6 | Proxy de saída com IP fixo + mTLS p/ dispatch RNDS (Supabase/Vercel não servem) | 4B | **Sim (crítico)** — ver `docs/rnds/RESTRICOES-INFRA.md` |

## Notas

- Dados de demo das Fases 1/2 foram removidos do Supabase (0 observações, 0 internações de teste).
- O warning de lint `react-hooks/exhaustive-deps` em `PrescricaoTab.tsx:83` é pré-existente (não relacionado às fases).
