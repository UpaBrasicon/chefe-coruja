# Serviço de envio à RNDS no VPS (Fase 5C, tarefa 5, etapas 5.3c e 5.4b)

O serviço (`services/rnds-envio`, 5.3b) e o simulador da RNDS sobem no VPS `179.199.128.141`, separados do Hermes. Nesta etapa eles estão ligados à **homologação** do Supabase e ao **simulador**; a RNDS de verdade é a 5.5.

## O que cobre

- **Dois contêineres** (`docker compose`, projeto `rnds`):
  - `rnds-envio`, o serviço;
  - `rnds-simulador`, o EHR Auth e o EHR Services de mentira.
- **Proteções dos contêineres:** nenhuma porta publicada no host, sistema de arquivos só leitura, sem privilégios e usuário `node`.
- **Usuário e pasta próprios:** `rnds`, em `/home/rnds`. Nada é compartilhado com o Hermes além do clone `/opt/chefe-coruja`, que é só lido (`git fetch` e `git archive`, sem mexer no HEAD).
- **Atualização às 04:10:**
  - `atualizar-rnds.sh` só sobe quando muda `services/rnds-envio`, `src/interop/fhir` ou `src/interop/rnds` no master;
  - o teste de saúde passa quando o serviço completa um ciclo com a fila;
  - se falhar, volta à imagem e ao código anteriores.
- **Saúde:** `GET /saude` dentro do contêiner, que responde 200 só depois de um ciclo que falou com a fila.
- **Teste ponta a ponta:** a fila da homologação passa pelo serviço e pelo simulador, e o `id_rnds` volta gravado.
- **Cofre (5.4b):**
  - a chave privada do cofre fica só no VPS e é montada só para leitura;
  - o serviço publica a chave pública ao subir e abre o certificado cifrado que vem do banco (`docs/rnds/ENVIO.md`);
  - a chave entra no backup diário do VPS.

## O que não cobre

- **RNDS de verdade:** o envio à produção fica desligado no código (`RNDS_PERMITIR_PRODUCAO`), e os endereços apontam para o simulador. O envio à homologação oficial é a 5.5, com a credencial.
- **A tela do cofre e o painel:** são a 5.4c. Até lá, o certificado chega ao cofre só pelo teste ponta a ponta (`e2e-cofre-homolog.sql`). Os avisos de vencimento e o bloqueio por CBO estão no banco (5.4a).
- **Backup cifrado:** o backup do VPS vai ao Backblaze B2 sem cifra própria, como o `.env.prod` do Hermes, que já vai nele. Quem tiver o backup e o banco abre os certificados. Cifrar o backup é uma melhoria à parte.
- **Supabase de produção:** o `.env.rnds` aponta para a homologação.
- **Alerta:** se o serviço parar, ninguém é avisado; isso entra com o painel da 5.4. Até lá, olhar `docker ps` e o log.

## Chaves envolvidas

| Chave | Onde | Quem põe |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` da **homologação** | `/home/rnds/deploy/.env.rnds` (600, root) | o RT, à mão. Nunca no git nem no chat |
| Certificado de teste da unidade (`.pfx` e senha) | `/home/rnds/deploy/certificados/<unidade_id>.pfx` e `.senha` (uid 1000, 600) | copiado do simulador (passo 4) |
| CA de teste do simulador | volume `rnds_sim-certs` | o simulador gera na primeira subida |
| Chave privada do cofre (RSA 3072) | `/home/rnds/deploy/cofre/chave.pem` (pasta 700, arquivo 400, uid 1000), montada em `/cofre` só para leitura | o `instalar-rnds.sh`, uma vez. Nunca sai do VPS, a não ser no backup |

## Instalação (uma vez, como root no VPS)

1. **Instalador.** Ele cria o usuário `rnds`, as pastas, o `.env.rnds` em branco e o cron:
   ```bash
   cd /opt/chefe-coruja && git fetch origin master
   git show origin/master:services/rnds-envio/deploy/instalar-rnds.sh | bash
   ```
2. **Chave.** Preencher a `SUPABASE_SERVICE_ROLE_KEY` da homologação em `/home/rnds/deploy/.env.rnds`, pelo painel do Supabase: projeto `chefe-coruja-homolog` → Settings → API.
3. **Primeira subida.** O script constrói a imagem (baixa o `node:24-alpine`) e sobe os dois contêineres:
   ```bash
   /home/rnds/deploy/atualizar-rnds.sh --forcar
   ```
   O resultado esperado é "ok: … saudável".
4. **Dados de teste e certificado.**
   1. No computador do projeto, rodar na homologação:
      ```bash
      npm run db:alvo
      npx supabase db query --linked -f services/rnds-envio/deploy/e2e-homolog.sql
      ```
      O `npm run db:alvo` tem de responder `homolog`.

      O script cria a "Rede RNDS E2E (teste)": a unidade `…e502`, um médico e um paciente fictícios, um atendimento com alta, uma observação com alta e uma regulação. Ele liga o envio só dessa unidade e põe os três documentos na fila.
   2. No VPS, copiar o certificado de teste:
      ```bash
      cd /home/rnds/deploy
      docker cp rnds-simulador:/certs-sim/unidade.pfx certificados/00000000-0000-4000-8000-00000000e502.pfx
      echo teste-simulador > certificados/00000000-0000-4000-8000-00000000e502.senha
      chown 1000:1000 certificados/* && chmod 600 certificados/*
      ```
5. **Conferir.** Em 1 ou 2 minutos, rodar o `SELECT` do fim do `e2e-homolog.sql`. Os três itens (`rac`, `sumario_alta`, `regulacao`) devem estar `enviado`, com `tem_id_rnds`. O log mostra o mesmo:
   ```bash
   docker logs rnds-envio --tail 20
   ```

## Cofre (5.4b), uma vez, como root no VPS

1. **A chave.** Rodar de novo o instalador (passo 1 acima). Ele gera `cofre/chave.pem` se ainda não existe e nunca a substitui.
2. **O backup.** O `/home/hermes/backup.sh` leva `/home/rnds/deploy/.env.rnds` e `cofre/chave.pem` (duas linhas `cp`, depois de `recriar-agente.sh`).
3. **A subida.** `atualizar-rnds.sh --forcar`. No log do serviço, `"cofre":true` e o evento `chave_publicada`.
4. **O teste ponta a ponta**, na homologação:
   1. Rodar `services/rnds-envio/deploy/e2e-cofre-homolog.sql`. Ele cria a credencial da UPA E2E, põe um atendimento novo na fila e devolve a chave pública.
   2. No VPS, cifrar o `.pfx` do simulador:
      ```bash
      docker exec -e RNDS_CHAVE_PUBLICA='<o JSON chave_publica>' -e RNDS_PFX_SENHA=teste-simulador rnds-envio node services/rnds-envio/simulador/cifrar.ts --pfx /certs-sim/unidade.pfx --credencial 00000000-0000-4000-8000-00000000e511
      ```
   3. Gravar o cifrado na credencial com situação `aguardando`.
   4. Esperar 1 minuto. A credencial fica `valido`, com o titular e a validade, e o RAC sai `enviado`.

   Resultado de 29/10/2026 em `docs/rnds/evidencia/5.4b-cofre-vps.txt`.

**Trocar a chave** (se vazar) obriga a enviar todos os certificados de novo. O serviço publica a chave nova, o banco marca os certificados como `chave_trocada` e os gestores os enviam de novo. Para trocar: apagar `cofre/chave.pem`, rodar o instalador e o `atualizar-rnds.sh --forcar`.

## Operação

| O quê | Comando |
|---|---|
| Estado | `docker ps --filter name=rnds-` |
| Log | `docker logs rnds-envio --tail 50`. O log tem uma linha por item, só com o id do item, o tipo e o resultado. |
| Atualizar agora | `/home/rnds/deploy/atualizar-rnds.sh --forcar` |
| Log da atualização | `/home/rnds/logs/atualizar.log` |
| Parar o envio | `docker compose -f /home/rnds/deploy/docker-compose.yml --project-directory /home/rnds/deploy stop envio` |
| Desligar uma unidade | `UPDATE rnds_config_unidade SET envio_ligado = false WHERE unidade_id = …` (na homologação) |
| Quem vai ao simulador | `RNDS_SIMULADOR_UNIDADES` no `docker-compose.yml` (5.5a): hoje só a UPA RNDS E2E. As outras unidades com credencial vão à homologação oficial da RNDS |

## Como reverter

1. Tirar a linha `atualizar-rnds.sh` do cron do root (`crontab -e`).
2. Desligar os contêineres e apagar a imagem e o volume:
   ```bash
   docker compose -f /home/rnds/deploy/docker-compose.yml --project-directory /home/rnds/deploy down -v
   docker image rm rnds-envio:latest rnds-envio:anterior
   ```
3. Apagar o usuário e a pasta. Isso leva a chave do Supabase, a chave do cofre e o certificado de teste:
   ```bash
   userdel -r rnds
   ```
4. Na homologação, desligar a unidade de teste:
   ```sql
   UPDATE rnds_config_unidade SET envio_ligado = false WHERE unidade_id = '00000000-0000-4000-8000-00000000e502';
   ```
   Os registros clínicos fictícios ficam, porque a guarda não deixa apagar.

Para reverter só o cofre (5.4b):
- voltar ao código anterior com o `atualizar-rnds.sh` ou à imagem `rnds-envio:anterior`. Sem `RNDS_CHAVE_COFRE`, o serviço usa só a pasta;
- tirar as duas linhas `rnds` do `/home/hermes/backup.sh` (a cópia anterior está em `backup.sh.antes-rnds-cofre`);
- na homologação, rodar `DROP FUNCTION IF EXISTS public.rnds_certificados_aguardando(integer);`.

Nada disso mexe no Hermes, no banco da produção nem no app.
