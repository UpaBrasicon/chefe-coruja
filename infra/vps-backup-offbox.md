# VPS: limpeza e cópia do backup no Backblaze (17/11/2026)

Pedido do RT em 17/11/2026: otimizar o VPS e tirar o que não é necessário. Antes de mexer, o levantamento foi só de leitura.

## Estado encontrado

- **Máquina folgada:** 2 vCPU; memória com 4,3 de 7,8 GB em uso (o Ollama da busca ocupa 2 GB, de propósito); disco com 34 de 96 GB (36%); CPU quase parada.
- **Backup off-box parado desde 20/10/2026.**
  - O `/home/hermes/backup.sh` fazia o backup local todo dia, mas a cópia para o Backblaze B2 (`offbox:chefe-coruja-bkp`) falhava com `403 storage_cap_exceeded`.
  - A conta grátis tem 10 GB, e o bucket estava com 9,4 GB: 7,2 GB de arquivos e 2,3 GB de versões escondidas.
  - Duas causas: o `rclone delete --min-age 14d` só rodava depois de uma cópia que desse certo, e, sem `--b2-hard-delete`, o B2 só escondia a versão.
  - A saída ia para `/dev/null`, então o log só dizia "offbox FALHOU".
- **Não é sobra, e ficou:**
  - a imagem `hermes-nous:v2026.8.19-atual` (3,9 GB) é o plano B do `/root/update-agente.sh` (contêiner `rollback-hermes-nous-0.20.5`);
  - os backups `nous-*-2026-10-05*.tgz` (cerca de 0,5 GB) existem só no VPS.
  O RT autorizou apagar os dois em 17/11/2026 ("1 sim, 2 sim"): o contêiner `rollback-hermes-nous-0.20.5` e a imagem foram removidos, junto com os 7 arquivos `nous-*-2026-10-05*.tgz`; o comentário do `update-agente.sh` foi atualizado. Disco foi para 29 de 96 GB (31%), e os 5 agentes do Nous seguem no ar.

## O que foi feito (com o "sim" do RT)

1. **Cache de build do Docker:** `docker builder prune -f` liberou 884 MB.
2. **Backblaze:**
   - `rclone cleanup` tirou as versões escondidas (9,4 GB → 7,2 GB);
   - `rclone delete --min-age 14d --b2-hard-delete` apagou de vez o que passava de 14 dias, que é a regra que o script já tinha (bucket com 0 B);
   - os 14 backups locais ficam como estão.
3. **`/home/hermes/backup.sh`:**
   - limpa antes de copiar, com `--b2-hard-delete` e `rclone cleanup`;
   - grava a saída do rclone em `/home/hermes/backups/offbox.err`;
   - backup do script anterior em `/home/hermes/backup.sh.bak-2026-11-17`.
4. **Reenvio:** logo depois da limpeza, o B2 ainda recusava, porque o limite é recalculado com atraso. Por isso, `/root/b2-reenvio-lg.sh` tenta subir os backups locais a cada hora, por até 30 h, e para no primeiro sucesso. Log em `/home/hermes/backups/b2-reenvio.log`.

## O que conferir

- O `b2-reenvio.log` termina em "ok: N arquivos no B2".
- O `backup.log` das 03:00 seguintes mostra "offbox ok".
- `rclone size --b2-versions offbox:chefe-coruja-bkp` fica perto de 14 × 0,37 GB, abaixo de 10 GB.

## Como reverter

- **Script:** `cp -p /home/hermes/backup.sh.bak-2026-11-17 /home/hermes/backup.sh`.
- **Reenvio:** `pkill -f b2-reenvio-lg.sh`.
- **Arquivos apagados do B2:** não voltam. Eram backups de 20/10 para trás, fora da regra de 14 dias. Os 14 mais novos estão no VPS.

## O que não cobre

- **O cofre da guarda de 20 anos:** é outro sistema (AWS S3 com Object Lock) e não foi tocado.
- **Ollama e Qdrant com a tag `latest`:** a S9 pede versão fixa. Isso fica anotado, mas não foi mexido.
