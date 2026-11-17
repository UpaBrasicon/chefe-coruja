# Registro de incidentes de segurança

Guarda: 5 anos (Resolução CD/ANPD 15/2024). O registro não leva dado pessoal: só tipos, números e medidas. O roteiro está em `LG5-PLANO-INCIDENTE.md`.

## 1. Backup do servidor (VPS) enviado sem cifra ao Backblaze (EUA)

| Campo | Registro |
|---|---|
| Ciência | 17/11/2026, ao preparar o diagnóstico do LG1 (sessão de obrigatórios legais) |
| Período | desde a ligação do backup off-box (01/10/2026) até 20/10/2026, quando a cópia parou por limite de espaço |
| O que aconteceu | o arquivo diário do VPS ia ao bucket privado `chefe-coruja-bkp` do Backblaze B2, região EUA, sem cifra |
| Dados envolvidos | chaves e senhas da produção (arquivos `.env`), chave do cofre do envio à RNDS, pastas dos agentes do Nous (conversas da equipe pelo Telegram), Redis e índice da biblioteca. Não havia banco de prontuário: ele está no Supabase e vai cifrado ao cofre da AWS |
| Titulares | profissionais da equipe, nas conversas dos agentes. Dado de paciente: não esperado, mas possível em texto digitado nas conversas |
| Cifra | não |
| Sinal de acesso indevido | nenhum. O bucket era privado, e a chave do B2 abria só esse bucket |
| Contexto | piloto, com a produção sem paciente real (só o RT na UPA Centro desde 31/10/2026) |
| Contenção | arquivos apagados do B2 de vez em 17/11/2026 (`--b2-hard-delete` e `rclone cleanup`). Desde 17/11, só sobe cifrado com a chave pública do cofre (`infra/vps-backup-offbox.md`) |
| Avaliação técnica | risco baixo. O advogado decide se é comunicável. Como não há cliente com dado real, não há controlador a avisar |
| Pendente | troca das chaves em 5 fases (`docs/seguranca/TROCA-CHAVES-2026-11.md`): fases 1, 2, 3 e 5 concluídas em 17/11/2026 (tokens internos, senhas do Postgres, 5 bots do Telegram, chave da Edge e WhatsApp), conferidas com a chave antiga recusada; falta a chave do DeepSeek, que o RT apaga quando o Bedrock entrar. Levar o bucket para a UE (J4) |
| Decisão do RT | [ ] |
