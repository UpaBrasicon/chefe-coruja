# Trilha de segurança, S10: áreas adiadas — diagnóstico

**Pedido.** Em 16/11/2026 o RT escolheu o S10 ("S10 (áreas adiadas)").

**Origem.** Áreas que as três passadas da auditoria Cloudflare não cobriram (`RESUMO.md`, "Áreas que nenhuma passada cobriu"):
- a cópia guardada por 20 anos;
- o site público (`landing/`);
- `scripts/`.

A rota `/homolog` da biblioteca e a porta 8642 do Nous já foram resolvidas no S8.

**Escopo.** Só diagnóstico, por três revisões de leitura do código. Os achados principais foram conferidos no código. Na produção foi feita só uma contagem: **o Storage tem 0 arquivos**, então nenhum nome perigoso existe hoje. Nada foi alterado.

## 1. Cópia de 20 anos (`infra/guarda/`, `scripts/arquivo/`)

O crítico da auditoria apontou "nome de arquivo virando caminho em disco sem checar `..`". **Procede.**

| Sev. | Onde | Defeito | Cenário |
|---|---|---|---|
| **Alta** | `abrir-guarda.mjs:49` (+ `baixar-guarda.mjs:33-36`) | O caminho de restauração vem do índice da guarda, sem checar `..`. Na guarda automática (CCG2), cifrar só exige a chave **pública**, então o índice pode ser forjado. O download pega a versão **mais recente** do objeto no cofre. | Quem tiver a chave de envio do cofre (fica no VPS) sobe uma versão nova do índice e dos arquivos. Na restauração depois de um incidente, o RT vê "íntegro". Os arquivos são gravados **fora da pasta escolhida**, por exemplo na inicialização do Windows (execução de código), e um prontuário forjado é restaurado. |
| Média | `exportar-guarda.mjs:72-77` | O nome do objeto do Storage vira caminho em disco sem checagem; não confere `r.ok`; a listagem para em 1000 itens sem paginar. | Um usuário logado que consiga gravar um nome com `..` faz a exportação manual sobrescrever arquivos do operador. Uma pasta com mais de 1000 anexos sai incompleta sem aviso, e uma resposta de erro HTTP entra na guarda como se fosse o anexo. |
| Média | `guarda-automatica.mjs:123-133` | O nome não é validado. A assinatura do pedido barra a escrita fora da pasta, mas um nome com `..`, ou dois objetos `x` e `x/y`, derrubam a guarda inteira. | Qualquer pessoa com permissão de envio pode parar a cópia legal de 20 anos, toda noite, até o objeto sair. |
| Baixa | `guarda-automatica.mjs:111-118` | A senha do banco de leitura vai na linha de comando do `pg_dump` (aparece em `ps`). | Um usuário local do VPS lê a senha durante a cópia. |
| Baixa | `baixar-guarda.mjs:35`, `cofre.mjs:52,109` | A conferência pula sem aviso quando não há checksum; o decifrador não fixa o tamanho da tag. | Cópia corrompida passa sem alerta (não explorável sem a chave). |
| Baixa | `chefe-coruja-guarda.service` | A cópia sem cifra fica no `/tmp` da camada do contêiner, em disco. | Se o processo for morto, o arquivo continua recuperável no disco. |

**Já está certo:**
- **Cifra:** AES-256-GCM com IV aleatório; scrypt na CCG1; RSA-4096 OAEP na CCG2. A chave privada nunca vai ao servidor.
- **Execução:** o contêiner não roda como root, e os segredos entram por arquivo, não na linha de comando do `docker`.
- **Logs:** não imprimem credencial.

## 2. Site público (`landing/`, `planos.chefecoruja.com.br`)

| Sev. | Onde | Defeito | Cenário |
|---|---|---|---|
| **Alta** | `landing/app/api/contato/route.ts` | O formulário de contato **não tem CAPTCHA nem limite**; a única barreira é o campo-isca. | Um laço de `curl` manda milhares de e-mails para contato@ e gasta a cota da Resend. Se for a mesma conta do SMTP do Supabase, isso **derruba os e-mails de recuperação de senha e de 2FA do app**. O texto e o `reply_to` são do atacante, o que dá um canal de phishing para a equipe. |
| Média | mesma rota | Aceita POST de outro site sem preflight (corpo `text/plain`) e não confere a `Origin`. | Uma página de terceiros faz cada visitante enviar o formulário, com IP diferente. |
| Baixa | mesma rota | A quebra de linha do nome passa para o assunto. | Assunto deformado; no pior caso, injeção de cabeçalho. |
| Baixa | `next.config.mjs` | A CSP não tem `script-src`; Next 14 está no fim da linha. | Sem efeito hoje (não há XSS); fica para quando aparecer um. |

O formulário do app (`www`) já usa a função `pedir-demonstracao`, endurecida no S6. O de `planos` usa a rota antiga.

## 3. `scripts/`

| Sev. | Onde | Defeito | Cenário |
|---|---|---|---|
| Média (impacto alto) | `scripts/e2e/01_rede_e2e.sql`, `30_…`, `40_…`, e os cenários D | Os SQL do e2e **não têm trava contra a produção** (os da demo têm). O 01 cria um super admin com a senha de teste, e os D desligam o 2FA da plataforma. | Depois de um push na produção, o projeto ligado continua sendo a produção. Rodar o e2e como diz o README cria contas de teste com super admin **na produção** e desliga o 2FA de todos. |
| Média | `observacao/demo-evolucao.ts`, `etl/11_publicar_exemplos.cjs`, ETL e terminologia | Gravam com a chave de serviço sem conferir se o alvo é a produção. O 11 publica uma diluição como se o farmacêutico tivesse revisado. | Com a chave da produção no terminal (a mesma variável que a exportação da guarda pede), um script de demonstração grava exames falsos no prontuário de um paciente real. |
| Média | `biblioteca-sync.mjs` | Publica a biblioteca **direto na produção**, de qualquer branch e com mudança não commitada, sem flag. | Contradiz "nada direto em produção": código não revisado roda na biblioteca da Corujinha. |
| Baixa | `ambiente/migrations-destrutivas.mjs` | A trava do CI não olha dentro de blocos `DO $$…$$` nem pega `DELETE … WHERE true`. | Um DROP dentro de um DO passa pelo CI. |
| Baixa | `ambiente/supabase-alvo.mjs` | O push de produção não confere migration sem commit. | Migration local não revisada vai para a produção. |
| Baixa | `erp-simulador.mjs`, `lis-simulador.mjs` | Recusam a produção só pelo prefixo da chave (`cc_test_`), que o admin escolhe. | Um simulador responde a pedidos reais com laudo "TESTE". |
| Baixa | `terminologia/baixar-sigtap.ts` | Baixa a SIGTAP de um espelho pessoal no GitHub, sem conferir o hash. | Espelho adulterado muda códigos e valores do faturamento. |
| Baixa | `e2e/04_framework_e2e.sql`, `99_limpar_rede_e2e.sql`, `auditoria-fases/scan-segredos.ts` | Função de teste `SECURITY DEFINER` sem `search_path` na homologação; limpeza que deixa linhas órfãs; detector de segredos sem os formatos do projeto. | Higiene. |

**Já está certo:**
- Nenhum segredo versionado no git, inclusive no histórico.
- Comandos de shell com lista de argumentos.
- SQL da demo com trava.
- `powerbi/conferir` recusa a produção.
- Nenhum dado pessoal real nas fixtures.

## Decisões para o RT

**H1. Cópia de 20 anos, no código.**
- **A (recomendada):**
  - confinar todo caminho na pasta de destino (recusar `..`, `.`, `\`, `:`, caminho absoluto);
  - na guarda automática, cada anexo vira um nome seguro, e o nome real fica no manifesto;
  - objeto com nome ruim é pulado com aviso, sem derrubar a guarda;
  - exportação com paginação e `r.ok`;
  - checksum obrigatório e tag de 16 bytes;
  - senha do banco por `PGPASSWORD`;
  - `/tmp` em memória no contêiner.

  Com teste.
- **B:** só o confinamento de caminho.

**H2. Cópia de 20 anos, no cofre.**
- **A (recomendada):**
  - **impedir sobrescrita** no bucket, com uma política que nega gravar em chave que já existe;
  - na restauração, baixar a **versão mais antiga** do objeto e avisar se houver mais de uma;
  - uma chave só de leitura para você restaurar.

  Escrevo a política e o passo a passo, e você aplica no painel do provedor do cofre (ou eu aplico, com o seu ok).
- **B:** só a versão mais antiga na restauração.

**H3. Formulário de contato do site público.**
- **A (recomendada):** o formulário de `planos` passa a usar a função `pedir-demonstracao` (Turnstile, limite de 3 por hora, IP confiável), e a rota `/api/contato` sai.
- **B:** endurecer a rota `/api/contato` com Turnstile, limite, conferência de `Origin` e limpeza do nome.

**H4. Travas nos scripts.**
- **A (recomendada):**
  - a trava "só homologação" (a mesma da demo) nos SQL do e2e;
  - os scripts com chave de serviço recusam a URL da produção sem uma flag explícita;
  - `biblioteca-sync` só roda do `master` limpo e com `--confirmo-producao`;
  - o `etl/11_publicar_exemplos` sai;
  - os simuladores recusam a URL da produção.
- **B:** só o e2e e a biblioteca.

**H5. Travas do CI e do push.**
- **A (recomendada):** a trava de migrations destrutivas passa a olhar dentro dos blocos DO e o `DELETE … WHERE true`. O push de produção recusa migration sem commit.
- **B:** deixar.

**H6. Menores.**
- **A (recomendada):**
  - SIGTAP com hash conferido;
  - detector de segredos com os formatos do projeto;
  - `search_path` na função de teste;
  - limpeza do e2e seguindo as chaves estrangeiras.

  A CSP com `script-src` e o Next 15 no site ficam para o S9 (versões).
- **B:** deixar.

## Riscos

- **H1:**
  - a restauração de guardas antigas continua funcionando, porque o formato do arquivo não muda;
  - o nome seguro vale só para guardas novas;
  - testar com uma guarda de teste antes da próxima noite.
- **H2:** a política do bucket é configuração do provedor. Errar a política pode bloquear o envio da noite, então o teste vem antes e a volta fica escrita.
- **H3:** o site público passa a depender da função do Supabase e do Turnstile, como o formulário do app já depende.
- **H4:** quem roda os scripts passa a precisar da flag para a produção; é o efeito pretendido.

## Critérios de aceite

1. Teste de unidade da guarda: um índice com `../` é recusado, e um nome ruim no Storage é pulado com aviso.
2. Formulário de `planos` com Turnstile e limite, conferido na homologação.
3. SQL do e2e recusa rodar fora da homologação, conferido no banco local.
4. CI verde.

## Decisão do RT e implementação (16/11/2026)

H1 a H6 = A ("Todas A").

- **H1:**
  - `scripts/arquivo/caminho.mjs` confina todo caminho;
  - a guarda automática grava cada anexo como `storage/anexo-NNNNN`, com o nome real no manifesto cifrado, e pula nome ruim com aviso;
  - exportação paginada com `r.ok`;
  - checksum obrigatório;
  - tag de 16 bytes;
  - senha do banco por `PGPASSWORD`;
  - contêiner com `/tmp` em memória, `--cap-drop ALL` e `no-new-privileges`.

  Guardas antigas continuam abrindo.
- **H2:** no código, todo envio ao cofre com `If-None-Match: *`, e a restauração pela versão mais antiga, com aviso se houver mais de uma. Na AWS, o passo a passo está em `infra/seguranca-s10-cofre.md` (política do bucket e chave só de leitura).
- **H3:** o formulário de `planos` usa a função `pedir-demonstracao` (Turnstile e limite), e a rota `/api/contato` saiu. A função aceita a origem `planos.chefecoruja.com.br`.
- **H4:** helper `scripts/ambiente/alvo-seguro.mjs` (os scripts com chave de serviço recusam a produção sem `--confirmo-producao`). Os simuladores recusam a produção sempre. `etl/11_publicar_exemplos.cjs` saiu. `biblioteca-sync` exige o `master` limpo e a flag.
- **H5:** a trava de migrations olha dentro dos blocos DO e pega `DELETE … WHERE true`. O push de produção recusa migration sem commit.
- **H6:**
  - SIGTAP com `--sha256` obrigatório;
  - detector de segredos com os formatos do projeto;
  - `e2e.disc` com `search_path`;
  - limpeza do e2e seguindo as chaves estrangeiras.

**Achado na conferência:** a produção tem uma rede fictícia, "Rede de Homologação (fictícia)", com a UPA `31000000-…-0001`, criada em 05/10/2026, com 4 setores e 4 pacientes fictícios. A trava antiga da demo ("a UPA Homologação existe") passaria na produção.

Decisão do RT, "Marca de ambiente":
- as travas da demo, do e2e e dos SQL da homologação passam a exigir a chave `ambiente_teste` = `true` em `configuracao_plataforma`;
- a homologação foi marcada em 16/11/2026, e o seed local também liga a marca;
- na produção a marca não existe, então a trava recusa;
- o seed da homologação recusa onde a marca estiver `false`;
- gravar `false` na produção espera a liberação de permissão do RT;
- a rede fictícia da produção fica como está, a decidir depois.
