---
name: chefe-coruja-operacional
description: Dados operacionais do Chefe Coruja (Supabase) — setores, unidades, profissionais, indicadores agregados, censo de ocupação, alertas de escala e notificações. NUNCA dados de paciente. Use quando o usuário perguntar sobre a operação da unidade/hospital.
version: 1.1.0
author: Chefe Coruja
license: MIT
platforms: [linux]
prerequisites:
  env_vars: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]
  commands: [curl]
metadata:
  hermes:
    tags: [ChefeCoruja, Operação, Indicadores, Censo, Escala, Saúde]
---

# Chefe Coruja — Dados Operacionais

Consulta dados OPERACIONAIS da plataforma Chefe Coruja (gestão hospitalar
multi-tenant) via Supabase REST. **NUNCA** consulta dado clínico de paciente.

## When to Use
- "quais os setores da unidade?" / "quantas unidades existem?"
- "quem são os profissionais da unidade?" (nome + papel)
- "como estão os indicadores da unidade?" (agregados)
- "qual o censo de ocupação hoje?" (agregado, sem paciente)
- "tem alertas de escala?" / "tem notificações?" (gestor/admin)

## Quick Reference

Script: `operacional.sh` (na pasta `scripts/` desta skill).

| Comando | Args | Retorna |
|---|---|---|
| `setores` | `<unidade_id>` | setores da unidade |
| `unidades` | `[organizacao_id]` | unidades ativas |
| `profissionais` | `<unidade_id>` | vínculos ativos (nome, papel) |
| `indicadores` | `<unidade_id>` | totais agregados (NUNCA nomes) |
| `censo` | `<unidade_id>` | ocupação agregada por dia/turno |
| `alertas_escala` | `<unidade_id> [status]` | alertas do Sentinela |
| `notificacoes` | `<unidade_id> [dias]` | avisos recentes da unidade |

## Procedure

1. Resolva a `unidade_id`/`organizacao_id` do contexto do usuário (nunca
   invente — se não souber, pergunte).
2. Execute: `bash <caminho>/operacional.sh <comando> <args...>`.
3. O resultado vem em JSON — formate em texto simples e amigável.

## Regras de Ouro (INVIOLÁVEIS)

1. **NUNCA** consulte ou responda com dado de PACIENTE: nomes, sintomas,
   exames, prescrições, prontuário, internação individual. Se o usuário
   perguntar algo de paciente, responda: "isso é tratado na plataforma Chefe
   Coruja — não posso acessar dados de paciente por aqui." 
2. **NUNCA** invente números — se a consulta não retornar, diga que não
   encontrou.
3. **Cross-tenant**: só responda sobre a unidade do usuário. Nunca misture
   unidades/organizações.
4. **Guarda de papel**:
   - Plantonista: só dados da própria unidade, e não vê alertas de escala.
   - Gestor/admin: veem alertas de escala, indicadores e censo.
5. Alertas de escala e indicadores são visíveis SOMENTE a gestor/admin —
   plantonista que perguntar sobre colegas recebe só o próprio contexto.
6. Indicadores/censo são AGREGADOS (números) — nunca detalhes individuais.

## Verification
Confirme que o JSON retornado tem os campos esperados antes de responder. Se
vier vazio, diga "não encontrei dados para isso nesse período".
