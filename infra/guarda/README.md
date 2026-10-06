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

## Operação

- Estado: `/var/lib/chefe-coruja-guarda/ultima.json` e `historico.jsonl` (sem dado de paciente, sem credencial).
- Atualizar o código: `git pull` e `docker build …` de novo.
- Trocar a chave: gerar par novo, trocar a pública no VPS. Guardas antigas continuam abrindo com a privada antiga — **não descarte a privada antiga**.
