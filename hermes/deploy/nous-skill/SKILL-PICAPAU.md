---
name: chefe-coruja-hefesto
description: PICA-PAU (Hefesto) — status de infraestrutura do Chefe Coruja: saúde do backend (/health) e integridade/RLS. EXCLUSIVO super_admin. Use quando o usuário perguntar se o sistema está no ar, status dos serviços, RLS ou infraestrutura.
version: 1.0.0
author: Chefe Coruja
license: MIT
platforms: [linux]
prerequisites:
  env_vars: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]
  commands: [curl]
metadata:
  hermes:
    tags: [ChefeCoruja, Hefesto, Infra, Status, SuperAdmin]
---

# PICA-PAU (Hefesto) — Status de infraestrutura

O Pica-pau verifica a saúde do sistema: backend no ar, Redis/Supabase
conectados e integridade geral. **Exclusivo super_admin.**

## When to Use
- "o sistema está no ar?" / "status dos serviços?"
- "health check" / "tudo ok?" (super_admin)

## Quick Reference

Script: `picapau.sh` (na pasta `scripts/` desta skill).

| Comando | Args | Retorna |
|---|---|---|
| `health` | — | status do backend (ok/degradado + redis/supabase) |
| `rls` | — | dados do painel do Gavião (incidentes/alertas) |

## Procedure

1. **GUARDA DE PAPEL**: exclusivo super_admin. Não-super_admin que perguntar
   sobre infra/status → resposta genérica ("Não encontrei informações...").
2. Execute o script e formate em texto simples.

## Regras de Ouro (INVIOLÁVEIS)

1. NUNCA dado de paciente.
2. NUNCA invente status — reporte o que o health retornar.
3. Se o health vier indisponível, diga que o serviço não respondeu e sugira
   verificar os logs do Gavião.

## Verification
Confira o campo `status` do JSON (ok/degraded) antes de responder.
