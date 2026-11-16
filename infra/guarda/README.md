# Guarda automática de 20 anos (Fase 0, tarefa 8)

Todo dia às 03:30 (Brasília) o VPS exporta o banco e os anexos da produção, cifra tudo **no próprio servidor** com a chave pública do responsável e envia ao cofre S3 (São Paulo, Object Lock em conformidade por 20 anos). A cópia sem cifra só existe dentro do container e é apagada no fim. Às 12:00 um vigia confere se houve guarda com sucesso nas últimas 36 h. Falha ou atraso: e-mail.

```
VPS (container chefe-coruja-guarda)            Supabase (produção)        AWS S3 sa-east-1
  pg_dump  ── conta guarda_leitura (só lê) ──▶  banco
  GET      ── chave S3 do Storage ───────────▶  anexos
  cifra com a chave PÚBLICA (CCG2) ─────────────────────────────────────▶  cofre (trava 20 anos)
  e-mail de falha/atraso (Resend)
```

**Quem tem o quê**

| Peça | Onde fica | Se vazar |
|---|---|---|
| Chave **pública** | VPS | nada: só cifra |
| Chave **privada** | Bitwarden (nota segura própria) + uma cópia offline (pen drive ou papel) | sozinha não abre nada (está cifrada pela frase) |
| Frase da chave privada | Bitwarden, **em outro item** que não o da chave | com a chave, abre as guardas — por isso nenhuma das duas vai ao servidor |
| Senha da `guarda_leitura` | `/etc/chefe-coruja/guarda.env` (VPS) | lê o banco (não grava) |
| Chave do IAM `guarda-envio` | idem | grava no cofre; não apaga (Object Lock) |
| Chave S3 do Storage | idem | lê/grava anexos |
| Chave do Resend (só envio) | idem | manda e-mail pelo domínio |

## Instalação (feita pelo responsável)

1. **Par de chaves** — no seu computador, na raiz do repositório:
   ```bash
   node scripts/arquivo/gerar-chaves-guarda.mjs --saida <pasta-no-pen-drive>
   ```
   Use como frase a senha criada no Bitwarden (16+ caracteres). Guarde o texto de `guarda-privada.pem` numa **nota segura do Bitwarden separada da frase** e numa cópia offline (pen drive ou papel); anote a impressão digital nos dois itens; apague o `.pem` privado do computador. A `guarda-publica.pem` vai para o VPS. A chave privada e a frase **nunca** vão para o VPS nem para banco nenhum.
2. **Conta de leitura na produção** — SQL Editor da produção (depois do merge e da migration `20261025000001`), com uma senha forte sua:
   ```sql
   ALTER ROLE guarda_leitura WITH LOGIN PASSWORD '<senha forte>';
   ```
   Endereço: painel → **Connect** → *Session pooler*; troque o usuário `postgres.<ref>` por `guarda_leitura.<ref>`.
3. **Chave S3 do Storage** — painel → Storage → Settings → *S3 Connection* → *New access key*.
4. **Chave do Resend** — Resend → API Keys → *Sending access*, só o domínio `chefecoruja.com.br`.
5. **No VPS** (SSH, como root):
   ```bash
   mkdir -p /etc/chefe-coruja /var/lib/chefe-coruja-guarda
   chown 70:70 /var/lib/chefe-coruja-guarda        # usuário postgres do container
   # copiar guarda-publica.pem para /etc/chefe-coruja/ (scp)
   # criar /etc/chefe-coruja/guarda.env a partir de guarda.env.example
   chmod 600 /etc/chefe-coruja/guarda.env
   # no clone do repositório:
   docker build -f infra/guarda/Dockerfile -t chefe-coruja-guarda .
   cp infra/guarda/chefe-coruja-guarda*.service infra/guarda/chefe-coruja-guarda*.timer /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now chefe-coruja-guarda.timer chefe-coruja-guarda-vigia.timer
   ```
6. **Primeira guarda e alerta, na mão:**
   ```bash
   docker run --rm --env-file /etc/chefe-coruja/guarda.env chefe-coruja-guarda --testar-alerta
   systemctl start chefe-coruja-guarda.service && journalctl -u chefe-coruja-guarda.service -n 20
   cat /var/lib/chefe-coruja-guarda/ultima.json
   ```
   Tem que aparecer `✔ guarda auto-…: N objeto(s) … travados até 2046-…`.

## Abrir uma guarda (restauração)

1. No console do S3, pedir a restauração dos objetos da pasta `auto-AAAAMMDD-HHMM/` (Deep Archive: 12 a 48 h) e baixar os `.ccg` e o `indice.ccg`.
2. `node scripts/arquivo/abrir-guarda.mjs <pasta-com-os-ccg> --destino <pasta> --chave-privada <guarda-privada.pem>` (pede a frase).
3. `banco.dump` restaura com `pg_restore` (roteiro e evidência em `produto/docs/fase0/T8-T9-guarda.md`).

## Endurecimento do S10 (H1 e H2, 16/11/2026)

**O que mudou.**

| Onde | Mudança |
|---|---|
| `chefe-coruja-guarda.service` | `--tmpfs /tmp` (2 GB, em memória): a cópia sem cifra não toca o disco do VPS. `--cap-drop ALL` e `--security-opt no-new-privileges`. |
| `Dockerfile` | Copia também `scripts/arquivo/caminho.mjs`. |
| `guarda-automatica.mjs` | Senha do banco por `PGPASSWORD` só no processo filho (não aparece no `ps`). Cada anexo vai com nome seguro (`storage/anexo-00001`), e o nome real fica no manifesto cifrado (`anexos`). Nome inválido (`..`, `\`, `:`, controle, absoluto) ou colisão arquivo×pasta é **pulado**: o log mostra o bucket e um resumo (tamanho e sha256 do nome, nunca o nome), e sai um e-mail "Guarda com anexos PULADOS". A guarda não cai. |
| `cofre.mjs` | Tag GCM fixa em 16 bytes, e arquivo truncado é recusado (CCG1 e CCG2). Todo envio manda `If-None-Match: *`: o cofre recusa gravar por cima de objeto que já existe (HTTP 412, "objeto já existe no cofre"). |
| `abrir-guarda.mjs` | Todo caminho do índice fica confinado em `--destino`. O que for recusado é pulado e conta como falha (saída 1). Anexo de guarda nova volta ao nome real se o nome passar na checagem; senão, fica com o nome seguro. |
| `baixar-guarda.mjs` | Baixa a versão **mais antiga** de cada objeto e avisa em destaque se houver mais de uma. Falha se o cofre não devolver o checksum. |
| `exportar-guarda.mjs` (manual) | Pagina a lista do Storage, aborta em erro HTTP e codifica a URL. Pula nome inválido. No Windows, o caminho vai entre aspas para o `cmd`. |

**Compatibilidade.** O formato `.ccg` não mudou. Guardas antigas, sem a lista `anexos`, abrem como antes. A exceção é um caminho com `:`, `\` ou caractere de controle: ele agora é recusado. No Windows esse caminho já gravaria errado, porque `:` vira fluxo alternativo do NTFS. Até 16/11/2026 o Storage da produção não tinha nenhum arquivo.

**Permissão nova no IAM.** O `baixar-guarda` usa `s3:ListBucketVersions` e `s3:GetObjectVersion`. A chave usada na restauração precisa dessas duas permissões, além de `s3:GetObject`.

**Antes da próxima noite.** No VPS:
1. `git pull`.
2. `docker build -f infra/guarda/Dockerfile -t chefe-coruja-guarda .`
3. `cp infra/guarda/chefe-coruja-guarda.service /etc/systemd/system/ && systemctl daemon-reload`.
4. `systemctl start chefe-coruja-guarda.service`.
5. Conferir `journalctl -u chefe-coruja-guarda.service -n 20` e `free -h` (o tmpfs de 2 GB precisa caber na RAM livre, ou no swap).

**Como reverter.**
- Container: tirar as linhas `--tmpfs`, `--cap-drop` e `--security-opt` do `.service`, copiar de novo para `/etc/systemd/system/` e rodar `systemctl daemon-reload`.
- Código: `git revert` do PR e `docker build` de novo.

Guardas feitas com o código novo continuam abrindo com o `abrir-guarda` antigo. Os anexos saem com o nome seguro, e o nome real está no `MANIFESTO.json` restaurado.

## Operação

- Estado: `/var/lib/chefe-coruja-guarda/ultima.json` e `historico.jsonl` (sem dado de paciente, sem credencial).
- Atualizar o código: `git pull` e `docker build …` de novo.
- Trocar a chave: gerar par novo, trocar a pública no VPS. Guardas antigas continuam abrindo com a privada antiga — **não descarte a privada antiga**.
