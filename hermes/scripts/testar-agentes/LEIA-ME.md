# Testar os agentes do Hermes com gatilhos

Situações fictícias, marcadas `GATILHO-HERMES`, que os agentes **devem** detectar.

| Gatilho | Quem deve pegar |
|---|---|
| Sinal vital com aferição no futuro | Cérbero (dados) e Falcão (Argos) |
| Mensagem com prompt injection no log do Hermes | Cérbero (Hermes) |

1. `npx supabase db query --linked -f hermes/scripts/testar-agentes/1-criar-gatilhos.sql` (na pasta chefe-coruja)
2. Na VPS: `sh 2-disparar.sh`
3. Conferir em `cerbero_incidentes` os incidentes novos (3 esperados)
4. `npx supabase db query --linked -f hermes/scripts/testar-agentes/3-limpar.sql` — apaga os gatilhos e os incidentes que eles geraram

Resultado em 27/09/2026: os 3 incidentes esperados apareceram em segundos; limpeza devolveu a tabela ao estado anterior.
