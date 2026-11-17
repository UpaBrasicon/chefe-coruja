# LG1, LG2, LG3 e LG5: peças da LGPD (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios. As quatro peças andam juntas, porque se apoiam umas nas outras:

| Item | Peça |
|---|---|
| LG1 | Contrato de operador (DPA) |
| LG2 | Encarregado (DPO) |
| LG3 | Relatório de impacto (RIPD) |
| LG5 | Plano de resposta a incidente |

**Decisão do RT, 17/11/2026: "Todas A"** (J1–J4, E1–E2, R1, P1–P3). Os rascunhos seguem em `docs/regulatorio/juridico/`.

- **Não é parecer jurídico.** É o mapa técnico e as decisões para o RT. Depois delas, cada peça sai como rascunho em `docs/regulatorio/juridico/`, para o advogado revisar.
- **Nada vai ao site** sem o ok do RT.

## Papéis (a base das quatro peças)

- **Controlador:** o hospital, a UPA ou a secretaria que contrata o sistema. É ele quem decide tratar o dado do paciente (LGPD, art. 5º, VI).
- **Operador:** o Chefe Coruja. Trata o dado em nome do cliente, segundo as instruções dele (art. 5º, VII, e art. 39).
- **Exceção:** para o cadastro e o login dos profissionais, a cobrança e o site, o Chefe Coruja é controlador.

## Como está hoje

### O que já existe

- **Política de Privacidade no site** (`landing/app/privacidade/page.tsx`). Ela mesma avisa: "modelo e deve ser revisada pelo jurídico". Pontos fracos:
  - fala como se o Chefe Coruja fosse o controlador do dado de saúde;
  - não nomeia o encarregado;
  - não lista fornecedores nem a transferência internacional;
  - cita a base legal "art. 11, II, a" (obrigação legal) onde cabe a "f" (tutela da saúde).
- **Documento de segurança para o cliente** (`produto/docs/seguranca-lgpd.md`). Traz a tabela de fornecedores, atualizada com a IA em 17/11, e as responsabilidades da unidade. Diz que a unidade deve ter o seu encarregado, mas não diz quem é o do Chefe Coruja.
- **Controles técnicos que viram cláusula:**
  - RLS por papel e por plantão;
  - auditoria encadeada por hash;
  - 2FA;
  - guarda de 20 anos cifrada no cofre da AWS em São Paulo, com Object Lock;
  - backup do VPS cifrado desde 17/11;
  - gateway e NER da IA;
  - texto da IA apagado em 30 dias (LG6).

### O que não existe

- contrato de operador;
- encarregado nomeado e canal próprio;
- RIPD;
- plano de incidente;
- lista de suboperadores para o cliente.

### Suboperadores (quem recebe dado, e onde)

| Fornecedor | Para quê | Dado | Onde |
|---|---|---|---|
| Supabase | banco, login, anexos, funções | todo o dado clínico | São Paulo |
| AWS S3 (conta do cofre) | guarda de 20 anos | cópia cifrada, sem a chave | São Paulo |
| Hostinger (VPS) | IA, biblioteca, envio à RNDS, backups | dado em trânsito; backups locais | datacenter no Brasil (IP brasileiro; conferir no contrato) |
| Backblaze B2 | cópia off-box do backup do VPS | **cifrado** desde 17/11 (antes ia aberto) | EUA |
| DeepSeek | IA (até a troca do LG6) | texto pseudonimizado | China |
| AWS Bedrock (conta da IA) | IA (depois da troca) | texto pseudonimizado | São Paulo, só In-Region |
| Vercel | entrega do site | nenhum dado clínico | global |
| Cloudflare | DNS, WAF, CAPTCHA, roteamento de e-mail | tráfego do site | global |
| Sentry | erros técnicos | mensagem higienizada | União Europeia |
| Resend | e-mail do código de 2FA e avisos | e-mail do profissional | EUA |
| Telegram | agentes do Nous (Corujinha e outros) | conversa da equipe, que pode ter dado digitado | global |

### Transferência internacional

| Destino | Situação |
|---|---|
| DeepSeek (China) | resolvido pelo LG6 |
| Backblaze (EUA) | o arquivo vai cifrado e só nós temos a chave. É argumento forte, mas o advogado decide se ainda conta como transferência |
| Resend (EUA) e Telegram (global) | dado pessoal do profissional, sem dado de paciente esperado. Precisam de base: contrato com cláusulas ou outra hipótese do art. 33 |
| Sentry (UE) | a UE tem adequação reconhecida pela ANPD (Resolução CD/ANPD 32/2026) |

## O que a norma pede (leitura técnica, para o advogado confirmar)

- **LG1, contrato de operador:** o operador segue as instruções do controlador (art. 39) e responde junto com ele se descumprir a lei ou as instruções (art. 42).
  - O contrato define:
    - objeto e duração;
    - natureza e finalidade;
    - tipos de dado;
    - segurança (art. 46);
    - suboperadores;
    - aviso de incidente;
    - apoio aos direitos do titular;
    - auditoria;
    - fim do contrato e o destino dos dados (arts. 15 e 16).
  - **O prontuário tem guarda de 20 anos** (Lei 13.787/2018). O dever é do controlador, mas o cofre com Object Lock **não deixa apagar** antes do prazo. O contrato precisa dizer isso.
- **LG2, encarregado:** o controlador indica o encarregado (art. 41). Para o operador, a indicação é **opcional**, mas recomendada pela ANPD (Resolução CD/ANPD 18/2024). O agente de pequeno porte tem regras próprias (Resolução CD/ANPD 2/2022), e o advogado confirma se elas se aplicam, já que o dado é de saúde. Na prática, hospital contratante pede o contato do encarregado do fornecedor.
- **LG3, RIPD:** é do controlador (art. 5º, XVII, e art. 38), e a ANPD pode exigi-lo quando há dado sensível. O operador costuma entregar a parte da plataforma, para o cliente completar com o contexto dele.
- **LG5, incidente:** Resolução CD/ANPD 15/2024.
  - O controlador comunica à ANPD e ao titular, em 3 dias úteis, o incidente que possa causar risco ou dano relevante.
  - O operador avisa o controlador e o apoia.
  - Todo incidente vai para um registro, guardado por 5 anos.

## Decisões para o RT

### LG1. Contrato de operador

**J1. Forma**
- **A (recomendada):** um anexo padrão ao contrato do SaaS, igual para todos os clientes.
  - Ele cita a política de segurança e a lista de suboperadores.
  - Mudança no texto vale para todos, com aviso prévio.
- **B:** contrato negociado cliente a cliente.

**J2. Suboperadores**
- **A (recomendada):** lista versionada no anexo (e no site, se o RT aprovar).
  - Fornecedor novo entra com aviso de 30 dias, e o cliente pode se opor.
  - Para trocar a IA (LG6), o aviso já sai com o fornecedor novo.
- **B:** autorização caso a caso, por escrito.

**J3. Fim do contrato**
- **A (recomendada):**
  - em até 30 dias, o cliente recebe a exportação completa: dados em formato aberto (FHIR e CSV) e os anexos;
  - o prontuário segue no cofre até completar 20 anos, porque o Object Lock não deixa apagar antes;
  - o contrato diz isso e oferece a custódia, ou a entrega da chave de leitura ao cliente;
  - o resto (banco ativo e cópias de trabalho) é apagado depois que o cliente confirmar o recebimento.
- **B:** exportar e apagar em 90 dias. Não combina com o Object Lock nem com a Lei 13.787.

**J4. Backblaze (EUA)**
- **A (recomendada):** levar o bucket para a região da União Europeia do Backblaze, que tem adequação, e manter a cifra. A troca é de configuração, sem custo relevante.
- **B:** manter nos EUA, com a cifra, e deixar o advogado avaliar.

### LG2. Encarregado

**E1. Quem**
- **A (recomendada):** o RT como encarregado do Chefe Coruja, com um canal só para isso: `encarregado@chefecoruja.com.br`, pelo roteamento da Cloudflare para o Gmail, como o `contato@`.
- **B:** um encarregado terceirizado (escritório ou consultoria).

**E2. Onde publicar**
- **A (recomendada):** na Política de Privacidade do site, com o nome, o canal e o prazo de resposta de 15 dias (art. 19). Também no anexo do LG1 e no documento de segurança.
  - A política é revista junto: papéis de controlador e operador, base legal "f", suboperadores, transferência internacional e encarregado.
  - Vai ao site só com o ok do RT, depois do advogado.
- **B:** só no contrato, sem mexer no site.

### LG3. Relatório de impacto

**R1. Forma**
- **A (recomendada):** um RIPD da plataforma, na parte do operador, que cada cliente completa com o seu contexto.
  - Ele cobre: tipos de dado, fluxo, quem acessa, suboperadores, controles e riscos com a nota de cada um.
  - Riscos: acesso indevido, vazamento, IA fora do Brasil até o I1 do LG6, regra clínica sem aprovação (resolvida pelo LG10), indisponibilidade, retenção e o modo sem conexão.
  - Revisão a cada mudança grande e uma vez por ano.
- **B:** escrever só quando um cliente pedir.

### LG5. Plano de incidente

**P1. Papéis e prazos**
- **A (recomendada):**
  - o RT decide e comunica, com um suplente técnico nomeado;
  - o cliente controlador recebe o aviso em até 24 h da confirmação do incidente;
  - o Chefe Coruja entrega ao controlador o que ele precisa para avisar a ANPD e os titulares em 3 dias úteis;
  - todo incidente vai para um registro, guardado por 5 anos, inclusive os que não forem comunicados.
- **B:** aviso ao cliente em até 48 h.

**P2. Peças prontas**
- **A (recomendada):**
  - roteiro técnico: conter, preservar a evidência, avaliar o risco e corrigir;
  - modelo de aviso ao cliente;
  - roteiro do formulário da ANPD;
  - modelo de aviso ao titular;
  - registro de incidentes.
  - Usa o que já existe: auditoria, o Cérbero e a Sentinela do Hermes, e o Sentry.
- **B:** só o roteiro técnico.

**P3. Simulado**
- **A (recomendada):** um simulado por ano, com registro (por exemplo, "chave da produção exposta"). O primeiro pode reaproveitar o caso real do backup aberto no B2, de 17/11.
- **B:** sem simulado.

## Achado para o registro de incidentes (LG5)

Até 20/10/2026, o backup diário do VPS foi ao Backblaze (EUA) **sem cifra**. Ele levava as chaves da produção, a chave do cofre da RNDS e as pastas do Nous, com as conversas da equipe.

- **O que foi feito:** os arquivos foram apagados do B2 em 17/11, e o backup passou a subir cifrado no mesmo dia (`infra/vps-backup-offbox.md`).
- **O que não há:** nenhum sinal de acesso indevido. O bucket é privado, e a chave do B2 só abre esse bucket.
- **O que o advogado avalia:** se isso é incidente comunicável. A minha leitura técnica é que o risco foi baixo, pelo bucket privado e pelo piloto sem paciente real na produção.
- **Recomendação:**
  - registrar no livro de incidentes do P1;
  - trocar as chaves que estavam no arquivo: Supabase, DeepSeek, biblioteca, RNDS e Telegram. É um passo de segurança à parte, com o ok do RT.

## Plano depois das decisões

| Peça | Arquivo (rascunho, para o advogado) |
|---|---|
| LG1 | `docs/regulatorio/juridico/LG1-ANEXO-OPERADOR.md`, com a lista de suboperadores e o fim do contrato |
| LG2 | nomeação do encarregado, canal na Cloudflare, rascunho da nova Política de Privacidade (o site só muda com o ok do RT) |
| LG3 | `docs/regulatorio/juridico/LG3-RIPD-PLATAFORMA.md` |
| LG5 | `docs/regulatorio/juridico/LG5-PLANO-INCIDENTE.md`, com os modelos e o registro de incidentes; primeira entrada: o backup aberto |
| J4 | troca do bucket para a UE, em `infra/vps-backup-offbox.md` |
