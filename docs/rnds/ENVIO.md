# Envio à RNDS — o banco (5C-5.3a)

Migration `20270205000001_rnds_envio_banco.sql`. O serviço de envio (5.3b, no
VPS na 5.3c) não lê tabela: chama três funções com a chave de serviço.
Nenhum documento sai do banco sem o serviço.

## As três funções

| Função | O que faz |
|---|---|
| `rnds_pegar_lote(limite)` | Devolve até 100 itens `pendente` ou `retido` cuja hora chegou, só de unidade com o envio ligado e sem pausa. Trava cada item por 5 min, e outro pedido não os pega. |
| `rnds_dados_documento(item)` | A carga. `dados` vem no formato de `src/interop/fhir/tipos.ts` (RAC, SA) ou é o retrato MIRA (5.1). `envio` traz o ambiente, a UF da unidade, o identificador do solicitante, o id RNDS do último documento aceito (para substituí-lo) e o CNS de quem assina. Falta de configuração vira erro com o prefixo `retido:`. |
| `rnds_registrar_resultado(item, resultado, …)` | Grava o que a RNDS respondeu. Os resultados estão na tabela abaixo. |

| Resultado | Quando | O que acontece |
|---|---|---|
| `enviado` | 201 | Grava o id RNDS, a hora, o Bundle enviado e a resposta. |
| `retido` | falta dado (o mapper ou a carga recusaram com `retido:`) | Grava o motivo. O item volta a ser tentado de hora em hora, até o dado ser corrigido. |
| `reenviar` | rede ou 5xx | Tenta de novo depois de 1, 2, 4… minutos, no máximo 1 h. Na 30ª tentativa (cerca de 24 h) vira `erro`. |
| `erro` | 422 (recusa definitiva) | Grava o `OperationOutcome` e não tenta de novo. Volta só à mão (painel da 5.4). |
| `credencial` | 401, ERR882–884 | O item volta à fila e a unidade **pausa**, com o motivo, até alguém olhar. |

## Configuração por unidade (`rnds_config_unidade`)

- Ambiente: homologação ou produção.
- Identificador do solicitante: o que a RNDS dá na aprovação da credencial.
- Financiamento padrão (`BRFinanciamento`; 07 = Municipal SUS).
- Envio ligado.
- A pausa, quando a credencial é recusada.

A configuração nasce com o envio desligado. Só o gestor e o super admin a leem.
Pela API ninguém grava: a tela é a 5.4, e até lá a configuração é ajustada por SQL na homologação.

## De onde vem cada dado

| Dado | RAC (porta) | SA (internação ou observação) |
|---|---|---|
| Início e fim | `chegada_em` → hora do desfecho (`desfecho_detalhes.alta_em`, se retroativa) | `data_admissao` → `data_alta` |
| Profissional | o médico do atendimento; na falta, quem deu o desfecho | quem deu a alta |
| Diagnóstico | `diagnosticos_episodio` ativos (o primário é o principal); na falta, o CID da alta | `diagnosticos_episodio` da internação; na falta, `cid_alta` ou `cid_principal` |
| Procedimento | `procedimentos_realizados` do episódio; na falta, a conta | a conta da internação; na falta, o que foi lançado no episódio depois da admissão |
| Medidas | a última PAS, PAD, peso e estatura do episódio | — |
| Resumo | — | o último `resumos_clinicos` da internação |

Um procedimento repetido no mesmo dia vai uma vez só, com a quantidade somada, porque a RNDS recusa a repetição (ERR789).

## Códigos (CodeSystems oficiais, definições de 07/2026)

| Campo | Regra |
|---|---|
| Modalidade | porta e observação **06**; internação **04** |
| Caráter | eletiva **01**; o resto **02** (a 06 não aceita eletivo, ERR784) |
| Procedência | internação vinda de outra unidade **12**; o resto **99** (informação ausente) |
| Desfecho | alta e alta após medicação **01**; a pedido **02**; evasão **04**; óbito **06**; transferência **09** |

## Quem assina (header `Authorization`)

- **RAC e SA:** o profissional do documento.
- **MIRA:** quem mudou o status. Se a mudança veio de uma rotina, sem usuário, assina o autor do último evento da solicitação.

Sem CNS, o serviço deixa o item retido (5.3b).

## Conferência noturna

Roda às 01:00 de Brasília (`rnds-conferencia-noturna`). Pega o que mudou no dia anterior e não está na fila, e põe na fila:
- as solicitações com evento no dia;
- os atendimentos da porta encerrados sem internar;
- as altas.

Item com erro não volta. O resultado de cada dia fica em `private.rnds_conferencias`.

## Rollback

Está no cabeçalho da migration e foi testado na homologação.
- **Sai:** as funções, a configuração, a conferência e o LOINC das quatro medidas. O que estava retido volta a pendente.
- **Fica:** as colunas novas da fila (nulas, sem uso) e o enfileiramento novo, que funciona sem o resto.

---

# O serviço de envio (5C-5.3b)

O código está em `services/rnds-envio/`. O serviço roda no VPS (5.3c), num contêiner próprio, separado do Hermes. A instalação, as chaves e a reversão estão em `infra/rnds-envio.md`.

| Arquivo | O que faz |
|---|---|
| `src/ciclo.ts` | Um lote, item a item: carga → o que o envio exige → documento → envio → resultado. |
| `src/cliente-rnds.ts` | Pede o token com TLS mútuo, envia o Bundle e converte a resposta num resultado da fila. |
| `src/fila-supabase.ts` | As três funções da 5.3a, com a chave de serviço. |
| `src/certificados.ts` | O `.pfx` e a senha de cada unidade, numa pasta do servidor. Desde a 5.4b é só a reserva do cofre. |
| `src/main.ts` | O laço: um lote a cada `RNDS_INTERVALO_S` segundos (60), seguindo enquanto o lote vier cheio. |
| `simulador/simulador.ts` | O simulador da RNDS, com a CA de teste. |

## O que fica retido antes de sair

Nada disto chega à RNDS. O item volta a ser tentado de hora em hora.
- A carga retida (`retido:` do banco).
- Produção desligada. Nesta etapa o serviço só envia à homologação e ao simulador; a produção pede `RNDS_PERMITIR_PRODUCAO=sim`.
- A unidade sem o identificador do solicitante ou, na produção, sem UF.
- O profissional sem CNS, que vai no header `Authorization`.
- O documento retido pelo mapper: sem procedimento, sem CBO e os outros casos da 5.2.
- A unidade sem certificado.

## A resposta da RNDS

| Resposta | Resultado na fila |
|---|---|
| 201 com `Location` | `enviado`, com o id da RNDS |
| 201 sem `Location` | `erro`: sem o id não há como substituir, e reenviar duplicaria |
| 401 no envio | pede um token novo e tenta uma vez; se repetir, `credencial` |
| 401/403 no EHR Auth, TLS recusado, ERR881–884, ERR930–932, ERR989 | `credencial`: a unidade pausa |
| 429, 5xx, sem resposta | `reenviar` |
| 422 e os outros 4xx | `erro`, com a mensagem do `OperationOutcome` (ex.: ERR906) |

- **Token:** o serviço tenta GET e, se a RNDS responder 405, POST, porque os manuais divergem no método.
- **Validade do token:** 30 minutos, com 1 minuto de folga. O token fica guardado por unidade e ambiente.
- **Log:** só o id do item, o tipo e o resultado. Os números de CPF e CNS saem do motivo.

## O simulador

```bash
npm run rnds:simulador -- --porta 8443 --certs <pasta>
```

- **Certificados:** na primeira vez, gera na pasta, com o openssl, a CA de teste, o certificado do servidor e um `unidade.pfx` (senha `teste-simulador`).
- **EHR Auth:** só aceita certificado de cliente assinado por essa CA. Sem ele, responde 401 ERR882.
- **Envio:** confere token, CNS, tipo `document`, `timestamp` próximo da hora atual, `identifier` BRRNDS e a substituição de um id conhecido. Responde 201 com o id no `Location`.
- **Cenários para os testes:** profissional sem CBO (422 ERR906), respostas forçadas (500, 429, 401) e token vencido.
- **Para apontar o serviço ao simulador:** `RNDS_AUTH_URL`, `RNDS_EHR_URL` e `RNDS_CA_EXTRA` (a `ca.crt` da pasta).

O simulador não é a RNDS: confere só o que os manuais descrevem. A prova contra a RNDS é a 5.5.

## Testes

`services/rnds-envio/tests/envio.test.ts` roda no `npm run test:interop` (CI). São 18 casos contra o simulador, com TLS mútuo de verdade:
- RAC, SA e MIRA enviados com um token só;
- os headers;
- a substituição;
- o token vencido;
- ERR906, 500, 429 e 401 repetido;
- o certificado de outra cadeia;
- a RNDS fora do ar;
- cada retenção.

---

# Cofre, vencimento, bloqueio e painel — o banco (5C-5.4a)

Migration `20270206000001_rnds_cofre_banco.sql`.

## Credencial

`rnds_credenciais` segue o modelo do DATASUS: um certificado A1, um identificador do solicitante e um ambiente, cobrindo a unidade principal e as filhas da mesma UF.
- Cada unidade aponta a credencial em `rnds_config_unidade.credencial_id`.
- A credencial nasce na homologação. Passar para a produção é só com o super admin (`rnds_definir_ambiente`).
- A carga usa o ambiente e o identificador da credencial. Os da configuração antiga ficam só como reserva.

## Cofre

O certificado nunca fica legível fora do VPS.
1. O serviço no VPS publica a chave pública (`rnds_registrar_chave_publica`). A chave privada fica só no VPS.
2. O navegador cifra o `.pfx` e a senha (RSA-OAEP-256 + AES-256-GCM) e manda só o cifrado (`rnds_enviar_certificado`): `{versao: 1, chave_id, chave, iv, dados}`, em base64.
3. O serviço busca o cifrado (`rnds_certificado_da_unidade`) e o abre. Depois grava o que leu (`rnds_registrar_certificado`): titular, CNPJ/CPF, validade, impressão digital e situação.

| Situação | O que acontece |
|---|---|
| `aguardando` | o certificado acabou de chegar e espera a leitura do serviço |
| `valido` | segue enviando |
| `senha_incorreta` | aviso aos gestores |
| `invalido` | aviso aos gestores |
| `vencido` | as unidades da credencial pausam, com aviso |
| `chave_trocada` | o serviço trocou de chave; o gestor envia o certificado de novo |

## Avisos (sino, tipos `rnds_…`)

- Certificado a 30, 15, 7 e 1 dia do vencimento: cron `rnds-avisos-certificado`, às 08:00 de Brasília.
- Certificado vencido, com senha errada, ilegível ou com a chave trocada.
- Profissional bloqueado.
- Credencial recusada pela RNDS: a unidade pausa.

## Bloqueio por CBO

- A recusa ERR906 ou ERR879 bloqueia o CNS do profissional. A ERR906 vale para todas as unidades da credencial; a ERR879, só para a unidade.
- Os documentos seguintes dele ficam retidos ("profissional bloqueado pela RNDS").
- O gestor desbloqueia no painel depois de acertar o CNES. O documento que causou o bloqueio volta à fila e os retidos tentam na hora.

## Funções do painel

Todas pedem 2FA e ficam na auditoria. Só o gestor das próprias unidades ou o super admin usa.

| Função | O que faz |
|---|---|
| `rnds_painel` | configuração, credencial (sem o cifrado), contagem da fila e bloqueios |
| `rnds_itens` | a fila da unidade, filtrável por situação |
| `rnds_reenviar` | erro volta à fila; retido tenta agora |
| `rnds_salvar_config` | financiamento e envio ligado (exige credencial e financiamento) |
| `rnds_retomar` | tira a pausa |
| `rnds_salvar_credencial` | a principal e as filhas: mesma UF, todas do gestor |
| `rnds_enviar_certificado` | recebe o certificado cifrado |
| `rnds_desbloquear` | tira o bloqueio |
| `rnds_chave_publica` | a chave ativa, para o navegador cifrar |

---

# O serviço abre o cofre (5C-5.4b)

## Formato do cofre

`src/interop/rnds/cofre.ts` define o formato e é o mesmo código dos dois lados. Usa só a WebCrypto, que existe no navegador e no Node 24.

- O conteúdo cifrado é `{"pfx": base64, "senha": "..."}`. Uma chave AES-256-GCM nova a cada envio o cifra.
- A chave AES vai cifrada com RSA-OAEP-256 e a chave pública do serviço.
- O dado adicional do GCM é `rnds-cofre:1:<credencial_id>`. O cifrado de uma credencial copiado para outra não abre.
- O `chave_id` é a impressão da chave pública (RFC 7638), calculada igual no navegador e no serviço.

## O que o serviço faz

`services/rnds-envio/src/cofre.ts`:
1. **Ao subir:** lê a chave privada (`RNDS_CHAVE_COFRE`) e publica a pública (`rnds_registrar_chave_publica`). Sem o arquivo, o serviço não sobe.
2. **A cada ciclo:** lê os certificados que acabaram de chegar (`rnds_certificados_aguardando`, migration `20270207000001`). Assim o painel mostra se o certificado abriu, mesmo com o envio desligado.
3. **A cada documento:** busca o certificado da unidade (`rnds_certificado_da_unidade`). O certificado aberto fica na memória até o cifrado mudar.
4. **A leitura do .pfx:** o `openssl` lê o arquivo. Se o .pfx usa cifras antigas (RC2, comum nos A1 emitidos há anos), tenta de novo com `-legacy`. O serviço grava o que leu (`rnds_registrar_certificado`):
   - o titular e o CNPJ ou CPF, tirados do CN no padrão da ICP-Brasil ("NOME:CNPJ");
   - a validade;
   - a impressão SHA-256;
   - a situação.
5. **O TLS mútuo** usa a chave e a cadeia em PEM, não o `.pfx`, porque o Node não abre `.pfx` com cifra antiga.

O `.pfx` aberto e a senha ficam só na memória do serviço. A senha passa ao `openssl` por uma variável só daquele processo. Nada vai ao disco nem ao log.

| O que o serviço encontra | Situação gravada | O documento |
|---|---|---|
| abriu e está na validade | `valido` | sai |
| a senha não abre o .pfx | `senha_incorreta` | retido, com o motivo |
| não é um .pfx, não tem chave ou ainda não vale | `invalido` | retido |
| o cifrado não abre com a chave do serviço | `invalido` | retido |
| cifrado com outra chave do serviço | `chave_trocada` | retido |
| venceu (na leitura ou com o serviço rodando) | `vencido`: o banco pausa as unidades | retido |

Unidade sem certificado no cofre usa a pasta (`RNDS_CERTIFICADOS_DIR`), que fica para o simulador e o teste ponta a ponta.

## Testes

`services/rnds-envio/tests/cofre.test.ts`, no `npm run test:interop`, roda contra o simulador:
- a cifra e a abertura, inclusive com outra credencial e outra chave;
- a leitura de um A1 no padrão ICP-Brasil e de um com RC2;
- a senha errada, o arquivo que não é .pfx e o vencido;
- o envio com o certificado do cofre;
- a chave trocada;
- o vencimento com o serviço rodando;
- o certificado novo;
- a reserva da pasta.

O teste ponta a ponta no VPS está em `evidencia/5.4b-cofre-vps.txt`.

---

# A aba RNDS em Integrações (5C-5.4c)

Escolhas do RT de 29/10/2026 ("todas a"): desenho A, com o estado no topo. Referências do Refero em `docs/frontend/revisao-visual/app/PLANO.md`.

| Parte | O que mostra |
|---|---|
| Faixa do topo | Só o que pede ação, do mais grave ao mais leve, cada um com o botão: envio pausado ("Retomar o envio"), certificado vencido, com a senha errada, ilegível ou com a chave trocada ("Enviar certificado"), vencimento em até 30 dias, profissionais bloqueados ("Ver bloqueios"), envio desligado e unidade sem credencial ("Montar credencial"). |
| Números | Validade do certificado, na fila, retidos, com erro e enviados. |
| Credencial | Nome, ambiente, identificador, unidades com o CNES, situação do certificado, titular, CNPJ/CPF e validade. Botões "Editar", "Enviar certificado" e, só para o super admin, "Passar para a produção". |
| Envio desta unidade | Financiamento e envio ligado. |
| Profissionais bloqueados | Código, mensagem da RNDS e "Tirar o bloqueio". |
| Fila | Os 50 mais recentes, com filtro por situação; "Reenviar" no erro e "Tentar agora" no retido. |

- **O certificado** é cifrado no navegador (`src/interop/rnds/cofre.ts`) antes de sair do computador. A tela pede o `.pfx` (ou `.p12`, até 100 KB) e a senha.
- **A produção** só passa depois de o super admin digitar o nome da credencial.
- **O sino** ganha a categoria "RNDS": os avisos `rnds_…` levam à aba (`/integracoes?aba=rnds`).
- **O financiamento** lista os códigos 01 a 08 de `BRFinanciamento`. Só 01 (SUS federal) e 07 (SUS municipal) têm o nome conferido. Os outros aparecem só pelo código, até a conferência com a tabela oficial.

---

# Homologação oficial: o que fica pronto antes da credencial (5C-5.5a)

Decisões do RT de 29/10/2026 ("todas a"). A credencial é pedida pelo gestor, com RAC e Sumário de Alta na primeira leva.

## Simulador só para a unidade de teste

`RNDS_SIMULADOR_UNIDADES` lista as unidades que vão ao simulador. As outras vão aos endereços oficiais da RNDS, pelo ambiente da credencial.
- No VPS, a lista tem só a "UPA RNDS E2E (teste)".
- Sem a lista, todas as unidades vão ao simulador. É o lado seguro: nada chega à RNDS de verdade.
- A produção da RNDS segue desligada no código (`RNDS_PERMITIR_PRODUCAO`).

## A resposta guarda os headers

O item enviado guarda o status, o `Location` e os headers da resposta da RNDS (menos `set-cookie`). Os headers entram na evidência.

## Evidência para a produção

`npm run rnds:evidencia -- --item <uuid> [--saida <pasta>]` monta o PDF que o DATASUS pede, até 10 MB, a partir de um item já enviado:
1. o validador local oficial sem erro: o `fhir:validar` roda no Bundle gravado, e só o resultado entra, sem a carga das definições;
2. o status e os headers da resposta 201;
3. o Bundle enviado.

Detalhes:
- Lê o item pelo projeto ligado (`npm run db:alvo`).
- Recusa o item se a resposta não for 201 ou se o validador apontar erro.
- Precisa de Docker, JDK e Edge ou Chrome.
- O Bundle leva os dados do paciente do teste: só pacientes fictícios.

## Formulário da credencial e chamado ao DATASUS

- `FORMULARIO-CREDENCIAL.md`: os campos que o gestor copia no Portal de Serviços. Os números da unidade saem de `volumes-unidade.sql`, que devolve só contagens.
- `CHAMADO-DATASUS.md`: o texto do chamado no WEB Atendimento. Traz as perguntas da seção 8 do `CHECKLIST.md` e mais três:
  - CPF de teste;
  - portfólio do MIRA;
  - quem envia o MIRA.
