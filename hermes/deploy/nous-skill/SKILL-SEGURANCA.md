---
name: chefe-coruja-seguranca
description: Segurança e integridade da plataforma Chefe Coruja — incidentes do Cérbero (patrulhas dados/conteúdo/hermes) e quarentena de URLs/anexos. EXCLUSIVO super_admin. Use quando o usuário perguntar sobre incidentes de segurança, links suspeitos, quarentena, varredura de integridade ou ameaças.
version: 1.0.0
author: Chefe Coruja
license: MIT
platforms: [linux]
prerequisites:
  env_vars: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]
  commands: [curl]
metadata:
  hermes:
    tags: [ChefeCoruja, Segurança, Incidentes, Quarentena, SuperAdmin]
---

# Chefe Coruja — Segurança (Cérbero)

Consulta incidentes de segurança/integridade e itens em quarentena da
plataforma Chefe Coruja. **Exclusivo super_admin.**

## When to Use
- "tem incidentes de segurança?" / "mostre os incidentes críticos"
- "o que está em quarentena?" / "algum link suspeito?"
- "varredura de integridade" / "ameaças" (super_admin)

## Quick Reference

Script: `seguranca.sh` (na pasta `scripts/` desta skill).

| Comando | Args | Retorna |
|---|---|---|
| `incidentes` | `[patrulha] [severidade]` | incidentes abertos do Cérbero |
| `quarentena` | `[status]` | itens em quarentena |

## Procedure

1. **GUARDA DE PAPEL (crítico)**: esta skill responde APENAS ao super_admin.
   - Se o usuário NÃO for super_admin e perguntar sobre segurança/quarentena/
     incidentes/ameaças, responda SEMPRE de forma genérica: "Não encontrei
     informações sobre esse assunto. Se precisar de ajuda com escala ou
     plantões, é só perguntar."
   - NUNCA revele a existência de ferramentas internas de segurança para
     quem não é super_admin.
2. Execute o script e formate o resultado em texto simples.

## Regras de Ouro (INVIOLÁVEIS)

1. NUNCA exponha dado de paciente — incidentes citam IDs/títulos, não nomes.
2. NUNCA invente — se a consulta não retornar, diga que não encontrou.
3. Quarentena é automática (pipeline); correção de DADOS é sempre sugerida ao
   admin, nunca executada por você.
4. Não remedeie nada sozinho — apenas reporte.

## Verification
Confirme que o JSON tem os campos esperados (id, severidade, titulo) antes de
responder. Se vazio, diga "não há incidentes/quarentena no momento".
