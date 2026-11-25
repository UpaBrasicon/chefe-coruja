# Teste de fluxo A: UBS → UPA (homologação, 25/11/2026)

Dez pacientes fictícios ("Teste Fluxo A01" a "A10") da recepção da UBS Homologação até o atendimento médico na UPA Homologação, com o login `teste.homolog` (JWT simulado, `role authenticated`) chamando as mesmas RPCs das telas.

Só homologação (cada arquivo confere `configuracao_plataforma.ambiente_teste`). Os passos gravam; os caminhos errados que passam sem erro são desfeitos e marcados `ok: false`.

| Arquivo | O que faz |
| --- | --- |
| `00_preparo_ubs.sql` | cria a UBS Homologação, setores, vínculos, escala e presença do dia |
| `50` | recepção da UBS: `registrar_ficha` |
| `51` | técnico (`registrar_sinais_aps`) e enfermeiro (`registrar_escuta_aps`) |
| `52` | médico da UBS: `iniciar_atendimento`, `registrar_soap`, `encaminhar_upa`, `registrar_conduta_aps` |
| `53` | UPA: painel Vindo da UBS, `registrar_ficha` na porta, chegada automática e à mão |
| `54`, `54b` | enfermeiro da UPA: `classificar_risco` |
| `55`, `55b` | médico da UPA: SOAP, reclassificação, `registrar_desfecho`; contrarreferência à UBS |
| `59` | perfil errado e fora do plantão. Termina em `ROLLBACK`: nunca grava |
| `60` | leitura (só SELECT) com contas de papel único da rede Fase 5 |

Ensaio de qualquer arquivo: troque a linha `--FIM` por `DO $$ BEGIN RAISE EXCEPTION 'FIM ok'; END $$;`.

Rodar: `npx supabase db query --linked -f scripts/e2e/fluxo-a/<arquivo>.sql`. A escala e a presença são do dia 25/11/2026; em outro dia, refaça o passo 5 e 6 do preparo.
