---
name: chefe-coruja-sentinela
description: Sentinela de Escala do Chefe Coruja — alertas de outliers de escala (médicos fora do padrão estatístico da unidade) e relatório semanal do Gavião. Visível SOMENTE a gestor/admin. Use quando o usuário perguntar sobre padrão de escala, repasses, faltas, alertas de plantão ou o relatório semanal.
version: 1.0.0
author: Chefe Coruja
license: MIT
platforms: [linux]
prerequisites:
  env_vars: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]
  commands: [curl]
metadata:
  hermes:
    tags: [ChefeCoruja, Sentinela, Escala, Outliers, Gestor]
---

# Chefe Coruja — Sentinela de Escala

Consulta alertas de outliers de escala (médicos cujo comportamento de repasses/
faltas/trocas foge do padrão estatístico da unidade) e o relatório semanal do
Gavião. **Visível SOMENTE a gestor/admin.**

## When to Use
- "tem alertas de escala na minha unidade?" (gestor/admin)
- "qual o relatório semanal do Gavião?"
- "algum médico fora do padrão de repasses?"

## Quick Reference

Script: `sentinela.sh` (na pasta `scripts/` desta skill).

| Comando | Args | Retorna |
|---|---|---|
| `alertas` | `[status] [unidade_id]` (status default: novo) | alertas do Sentinela |
| `relatorio` | — | relatório semanal mais recente |

## Procedure

1. **GUARDA DE PAPEL**: dados de sentinela são visíveis SOMENTE a
   gestor/admin. Plantonista que perguntar sobre colegas → responda apenas
   com dados do próprio usuário (ou diga que não tem acesso).
2. Execute o script e formate em texto simples com NÚMEROS e mediana.
3. Use linguagem NEUTRA: "fora do padrão estatístico da unidade", nunca
   termos acusatórios. Nunca especule motivo, caráter ou desempenho clínico.

## Regras de Ouro (INVIOLÁVEIS)

1. Relate APENAS fatos e números (repasses, faltas, datas, contagens).
2. NUNCA invente — se a consulta não retornar, diga que não encontrou.
3. NUNCA exponha dado de paciente.
4. Plantonista NUNCA recebe dados de colegas.

## Verification
Confirme que o JSON tem os campos esperados (metrica, valor, mediana_unidade)
antes de responder.
