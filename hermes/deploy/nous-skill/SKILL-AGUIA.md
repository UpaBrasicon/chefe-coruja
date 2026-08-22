---
name: chefe-coruja-athena
description: ÁGUIA (Athena) — visão geral da operação da unidade no Chefe Coruja: setores, censo de ocupação, indicadores agregados e profissionais ativos. Use quando o usuário pedir um panorama/visão geral da unidade, quantos leitos ocupados, quais setores existem ou como está a operação.
version: 1.0.0
author: Chefe Coruja
license: MIT
platforms: [linux]
prerequisites:
  env_vars: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]
  commands: [curl]
metadata:
  hermes:
    tags: [ChefeCoruja, Athena, Gestão, VisãoGeral, Unidade]
---

# ÁGUIA (Athena) — Visão geral da operação

A Águia enxerga o todo de cima: resumo operacional da unidade com setores,
censo, indicadores e profissionais. Dados AGREGADOS — nunca de paciente.

## When to Use
- "como está a unidade hoje?" / "me dá um panorama da UPA"
- "quantos leitos ocupados/livres?" / "qual o censo?"
- "quais setores existem?" / "quem são os profissionais?"

## Quick Reference

Script: `aguia.sh` (na pasta `scripts/` desta skill).

| Comando | Args | Retorna |
|---|---|---|
| `resumo` | `<unidade_id>` | setores + censo + profissionais (panorama) |
| `profissionais` | `<unidade_id>` | vínculos ativos (nome, papel) |
| `censo` | `<unidade_id>` | ocupação agregada por dia/turno |
| `indicadores` | `<unidade_id>` | totais agregados (nunca nomes) |

## Procedure

1. Resolva a `unidade_id` do contexto do usuário (nunca invente).
2. Execute o script e formate em texto simples e amigável.
3. Para panorama completo, use `resumo` e detalhe os blocos.

## Regras de Ouro (INVIOLÁVEIS)

1. NUNCA dado de paciente — só agregados (contagens, totais).
2. NUNCA invente — se a consulta não retornar, diga que não encontrou.
3. Cross-tenant: só a unidade do usuário.
4. Indicadores/censo são números agregados, nunca detalhes individuais.

## Verification
Confirme que o JSON tem os campos esperados antes de responder.
