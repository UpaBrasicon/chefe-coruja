# Auditoria de segurança — Chefe Coruja (15/11/2026)

Skill usada: `security-audit` da Cloudflare (github.com/cloudflare/security-audit-skill, commit c1c8a8c), instalada em `~/.claude/skills/security-audit`.

Alvo: commit `d0251b7b` (master), numa cópia separada só para leitura. Nada foi alterado no código e nada foi aplicado.

## Como foi feito

Foram três passadas, e cada uma somou à anterior:

| Passada | Pedido | Escopo | Agentes | Pasta |
|---|---|---|---|---|
| 1 | security audit this codebase | repositório inteiro | 18 | `run-1/` |
| 2 | find security vulnerabilities in ./src | só `src/` | 16 | `run-2/` |
| 3 | do a security review | repositório inteiro, cobrindo o que as anteriores adiaram | 21 | `run-3/` |

Neste repositório ficam o `REPORT.md` e o `NEEDS-VALIDATION.md` de cada passada (`run-N-REPORT.md`, `run-N-NEEDS-VALIDATION.md`). A pasta completa fica fora do git, em `~/audits/my-project/`, onde cada passada tem `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md` e `NEEDS-VALIDATION.md`. Os dois validadores da skill passaram nas três.

**Limite importante.** A skill só chama um achado de "confirmado" quando ele é reproduzido num ambiente isolado (sem rede, sem variáveis de ambiente, com limites de recurso). Este computador Windows não tem esse isolamento, então nenhum código do projeto foi executado. Por isso:

- não há nenhum achado "confirmado";
- todos os 26 achados (`needs_validation`) foram conferidos no código-fonte por um segundo agente independente, que tentou derrubar cada um;
- cada achado depende de um fato que só aparece rodando o sistema, como uma configuração da produção ou um comportamento do Supabase. Cada um traz o teste que decide o caso, para fazer na homologação.

Perfil `quick` (uma rodada de busca por passada): é uma cobertura parcial, não um atestado de que o resto está limpo. Ficaram adiadas 8 áreas, listadas no fim.

## O que está bom

- Todas as funções do banco que um usuário logado pode chamar têm checagem de papel e de unidade no servidor. Foram conferidas 776 funções.
- As travas do navegador (unidade, papel, paciente) são refeitas no servidor.
- As funções do Hermes continuam sem acesso para usuários comuns.
- O gateway de IA retira a identificação do paciente e bloqueia o envio se a checagem falhar.
- O cofre do certificado RNDS está corretamente amarrado a cada credencial.
- No React não há `dangerouslySetInnerHTML`, e a telemetria (Sentry) não envia dado clínico.

## Os achados, por prioridade

### 1. Vínculo e identidade (o ponto mais fraco)

1. **Admin de uma organização vincula qualquer pessoa de qualquer outra, com qualquer papel** (`20260815000003_fase1_rls.sql:137-175`).
   - Não pede consentimento da pessoa.
   - Ignora as regras do convite: papel de rede só por super admin, gestor e admin só por contrato.
   - Com o vínculo, o admin passa a ler o perfil da pessoa e consegue zerar o 2FA dela (`zerar_segundo_fator`).
   - *Melhoria:* vínculo novo só por convite aceito, ou com as mesmas regras de `gerar_convite`; e `zerar_segundo_fator` só por quem gere a unidade principal da pessoa.
2. **Admin de qualquer organização lê CPF, nascimento, e-mail e telefone de todo perfil sem vínculo ativo, da plataforma inteira** (`20260823000002_auditoria_partes_ab.sql:79-100`).
   - *Melhoria:* restringir esse ramo da política à própria organização, ou trocar por uma RPC de busca por CPF que devolva o mínimo.
3. **O código de convite pode ser adivinhado sem limite de tentativas** (`aceitar_convite`, também antes do 2FA). Um acerto dá papel clínico na unidade.
   - *Melhoria:* o mesmo limite e bloqueio de `conferir_convite`, e códigos mais longos.
4. **A adesão ao contrato vale antes de provar que o e-mail é da pessoa.** A checagem do domínio corporativo roda no cadastro, e a confirmação de e-mail está desligada no `config.toml` local. O código `CT-AAAA-NNN` tem só mil valores por ano.
   - *Melhoria:* confirmar o e-mail na produção, aplicar a adesão só depois da confirmação e alongar o código.
5. **Login cruzado (`src/lib/supabase.ts`).** Um link preparado pode logar a vítima na conta do atacante. Se ela aceitar um convite nessa sessão, o vínculo vai para o atacante.
   - *Melhoria:* `flowType: 'pkce'` no `createClient` e recusar troca de sessão quando já há uma ativa.

### 2. 2FA desigual (só pesa quando `exigir_segundo_fator` for ligado; ele vem desligado)

6. **11 tabelas clínicas podem ser lidas sem o segundo fator:** `teleinterconsultas`, `dispensacoes`, `contas`, `pedidos_acesso_prontuario` e outras, além de `chat_mensagens` e das views `vw_censo_unidade` e `vw_indicadores_unidade`.
   - *Melhoria:* aplicar a política restritiva `segundo_fator_ok()` nessas tabelas e um teste em CI que falhe quando uma tabela clínica ficar sem ela.
7. **A função `clinical-search` não confere o 2FA** antes de consultar com a chave de serviço.
   - *Melhoria:* chamar `segundo_fator_valido` no início de toda função de borda que use a chave secreta.
8. **Cadastrar o TOTP com uma sessão só de senha** dispensa o código por e-mail.
   - *Melhoria:* exigir o código por e-mail antes de cadastrar o primeiro TOTP (hook ou RPC).

### 3. Documentos e impressão

9. **O título do termo de consentimento entra sem escape no cabeçalho impresso** (`folhas.ts:245`, nas duas cópias). As janelas de impressão mantêm `window.opener`, e o texto de erro também é escrito cru nelas.
   - *Melhoria:* escapar `sub` e `doc` em `cabecalho()`, escapar o texto de erro e fazer `janela.opener = null` em toda janela de impressão.
10. **Tipos de documento exclusivos podem sair pelos caminhos genéricos:** termo, sumário de óbito, parecer e teleinterconsulta saem por `emitir_documento`, pelo rascunho e pela sincronização. O nome e o CRM do médico vêm do conteúdo enviado. A sincronização emite o laudo de AIH sem `faltas_documento`.
    - *Melhoria:* os caminhos genéricos aceitam só tipos genéricos, e `faltas_documento` roda em todos os caminhos.
11. **O reenvio offline confia no "estava sem conexão" informado pelo navegador.** Aceita registro com até 24 h de atraso, sem conferir com o último contato que o servidor registrou.
    - *Melhoria:* comparar com o contato registrado no servidor e exigir vínculo ativo.

### 4. Arquivos e anexos

12. **Os buckets `atendimento`, `farmacia`, `banners` e `fotos` não limitam o tipo de arquivo.** Um SVG ou HTML anexado abre como página. A política de UPDATE do `atendimento` deixa gestor e plantonista sobrescrever ou mover anexos já registrados, o que fura a guarda de 20 anos.
    - *Melhoria:* definir `allowed_mime_types`, remover `atendimento_update` ou restringi-la ao super admin, baixar anexos como download e guardar o sha256 do anexo.

### 5. API de integração e borda

13. **A lista de IPs da chave usa o primeiro `X-Forwarded-For`, que o cliente controla**, quando `API_BORDA_SEGREDO` não está definido. O mesmo padrão aparece em `private.requisicao_ip` e em `pedir-demonstracao`.
    - *Melhoria:* sempre definir o segredo da borda, ou usar o IP que o gateway enxerga.
    - *Também:* comparações de segredo em tempo constante, limite real de tamanho do corpo (não só o `Content-Length`), limite de taxa com trava e checagem de DNS para endereço privado no webhook.

### 6. Sessão no navegador

14. **Quando o servidor encerra a sessão, a aba guarda as chaves e o cache do usuário anterior.** O 'Sair' limpa tudo; o encerramento pelo servidor, não.
    - *Melhoria:* a mesma limpeza no evento `SIGNED_OUT`.
    - *Também:* limpar o token de dispositivo confiável ao sair num computador compartilhado, e conferir a regra de 12 h do "manter conectado" também com a aba aberta.

### 7. Hermes, VPS e cadeia de dependências

15. **Nomes de paciente reidentificados nas respostas anteriores voltam ao provedor de IA sem passar pelo NER** (`ia-proxy.ts`).
    - *Melhoria:* rodar a desidentificação também no histórico do assistente.
    - *Também:* não registrar em log os argumentos de ferramenta já reidentificados.
16. **Um cron root no VPS constrói e sobe o que estiver em `origin/master`**, incluindo o `docker-compose.yml`, sem conferir assinatura nem CI (`atualizar-rnds.sh`).
    - *Melhoria:* subir só commit com CI verde ou SHA fixado; tirar o usuário `rnds` do grupo docker e da pasta onde fica o script do root.
    - *Também:* `deploy-backend.sh` não deve imprimir `SKILL_API_TOKEN`; a porta 8642 do Nous deve ficar só em `127.0.0.1` (o Docker publica por fora do UFW); a rota `/homolog` da biblioteca não deve usar o `.env` e o Qdrant da produção; a chave da biblioteca deve ser comparada com `hmac.compare_digest`.
17. **Versões sem fixação:** o `supabase-js@2` vem do esm.sh sem `deno.lock`, as actions do CI estão presas por tag e as imagens base usam tag flutuante.
    - *Melhoria:* versão exata, actions presas por SHA e imagens presas por digest.

## Fatos que decidem a maioria dos achados (conferir antes de qualquer correção)

Estes valores estão só na produção e na homologação, não no código:

1. Valor de `configuracao_plataforma.exigir_segundo_fator` na produção. Ele decide os itens 6 a 8.
2. Se o "Confirm email" do Auth está ligado na produção. Ele decide o item 4.
3. Se o gateway do Supabase sobrescreve o `X-Forwarded-For` enviado pelo cliente. Ele decide o item 13.
4. Se o Supabase Storage serve SVG e HTML inline. Ele decide o item 12.
5. Se o `master` tem proteção de branch e quem tem permissão de push. Ele decide o item 16.
6. Qual fluxo de sessão (`flowType`) o supabase-js usa de fato. Ele decide o item 5.

## Áreas que nenhuma passada cobriu (adiadas)

- O serviço de cópia de 20 anos (`infra/guarda`, `scripts/arquivo`). O crítico viu nome de arquivo do Storage virando caminho em disco sem checagem de `..`.
- A rota `/homolog` da biblioteca e a porta 8642 do Nous.
- O reenvio offline de documentos, o cadastro e a recuperação de senha pelo navegador, a geolocalização, o Web Push e a criptografia no navegador. Estes foram cobertos na passada 3, mas o crítico da passada 2 pediu mais profundidade.
- O site `landing/` e as ferramentas de `scripts/`.
