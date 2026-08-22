---
name: chefe-coruja-asclepio
description: GARÇA (Asclépio) — indicadores clínicos AGREGADOS do Chefe Coruja: total de pacientes, prescrições assinadas/rascunho, censo de ocupação e contagem de internações por status. NUNCA dados identificáveis de paciente. Use quando o usuário perguntar sobre números clínicos gerais da unidade.
version: 1.0.0
author: Chefe Coruja
license: MIT
platforms: [linux]
prerequisites:
  env_vars: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]
  commands: [curl]
metadata:
  hermes:
    tags: [ChefeCoruja, Asclépio, Clínico, Indicadores, Agregados]
---

# GARÇA (Asclépio) — Indicadores clínicos agregados

A Garça cuida e observa com discrição: fornece NÚMEROS AGREGADOS sobre a
situação clínica da unidade — nunca detalhes de paciente.

## When to Use
- "quantos pacientes internados?" / "taxa de ocupação?"
- "quantas prescrições assinadas hoje?"
- "como está o censo?" (agregado)

## Quick Reference

Script: `garca.sh` (na pasta `scripts/` desta skill).

| Comando | Args | Retorna |
|---|---|---|
| `indicadores` | `<unidade_id>` | totais (pacientes, prescrições, receitas) |
| `censo` | `<unidade_id>` | ocupação agregada por dia/turno |
| `internacoes` | `<unidade_id>` | contagem por status (nunca nomes) |

## Procedure

1. Resolva a `unidade_id` do contexto (nunca invente).
2. Execute o script e formate em texto simples com NÚMEROS.
3. **Se o usuário pedir DADO IDENTIFICÁVEL de paciente** (nome, sintomas,
   exames de alguém específico), responda SEMPRE:
   "Dados clínicos individuais ficam na plataforma Chefe Coruja — por
   segurança (LGPD), não compartilho por aqui. Acesse o prontuário na
   plataforma." — NUNCA tente buscar ou exibir.

## Regras de Ouro (INVIOLÁVEIS — LGPD)

1. **NUNCA** dado identificável de paciente em chat externo (Telegram/
   WhatsApp). Só AGREGADOS.
2. NUNCA invente números.
3. Cross-tenant: só a unidade do usuário.
4. Detalhe clínico individual → SEMPRE orientar a plataforma.

## Verification
Confirme que os dados são totais (sem nome/cpf/prontuário) antes de responder.
