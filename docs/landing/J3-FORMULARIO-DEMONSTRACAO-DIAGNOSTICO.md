# J3: formulário "Agendar demonstração" na página do app — diagnóstico

**Pedido.** Pedido 8 do RT, caminho C, decisão D1 de 11/11/2026: o botão "Agendar demonstração" da página de entrada do app (www.chefecoruja.com.br) abre um formulário dentro do próprio app.

**Escopo.** Este documento é só diagnóstico. Nenhum código, função ou segredo muda aqui.

## Como está hoje

- **Página de entrada do app** (`src/pages/landing/Landing.tsx`): não tem formulário nem caminho de venda. Os botões são só "Entrar" e "Primeiro acesso".
- **Formulário pronto na `landing/`** (`landing/app/api/contato/route.ts`, PR #528, testado de ponta a ponta em 09/11/2026):
  - campos: nome, e-mail, telefone, unidade e cargo, e mensagem;
  - anti-robô: só um campo-isca escondido. Se o robô preenche, recebe "ok" e nada é enviado;
  - validação: nome com 2 letras ou mais, e-mail válido e telefone com 10 dígitos ou mais;
  - envio pela Resend para `contato@chefecoruja.com.br`, com o e-mail do visitante em "responder para". O corpo é texto puro, e o JSON vai só com ASCII (correção dos acentos de 09/11);
  - não grava nem registra no log o que a pessoa escreve;
  - a chave `RESEND_API_KEY` fica só na Vercel do projeto `landing/`.
- **Funções no servidor do app** (`supabase/functions/`): `enviar-codigo-2fa` já envia e-mail pela Resend com o segredo `RESEND_API_KEY` do Supabase. O remetente é `nao-responda@chefecoruja.com.br`, com limite de 10 s, e o erro é registrado por `relatarErro`. **O segredo da Resend já existe no Supabase.**
- **Anti-robô do app:** o login e o cadastro usam o Turnstile da Cloudflare (`src/components/seguranca/TurnstileWidget.tsx`), e a CSP do `vercel.json` já libera `challenges.cloudflare.com`. A conferência do Turnstile é feita pelo Supabase Auth. **Uma função nova precisaria do segredo do Turnstile nas variáveis dela.** Hoje ele não está lá.

## O que muda

Um formulário aberto a qualquer pessoa, sem login, no endereço principal da marca, é alvo certo de spam. O cuidado está no anti-robô e no limite de envios.

## Opções

**A. Função nova `pedir-demonstracao`, com Turnstile (recomendada)**
- Função no servidor (Supabase Edge), sem login. Ela:
  1. confere o Turnstile, com o segredo novo `TURNSTILE_SECRET` que o RT copia da Cloudflare para os segredos das funções, na homologação e na produção;
  2. confere o campo-isca;
  3. aplica um limite por endereço de rede, com uma tabela pequena de contagem por hora que guarda só o resumo (hash) do endereço, sem os dados da pessoa;
  4. envia pela Resend, com o segredo que já existe, as mesmas regras de texto puro e JSON em ASCII.
- Na tela: o formulário abre numa janela na própria página, com os mesmos campos da `landing/`, o Turnstile e a mensagem de "recebido" só depois do envio confirmado.
- Não grava o conteúdo do pedido. O e-mail para `contato@` é o registro.
- Precisa de migration, só da tabela de contagem. Passa pela homologação e pelo "ok produção".

**B. A mesma função, sem Turnstile**
- Campo-isca e limite por endereço de rede.
- Não precisa de segredo novo, mas fica mais exposta a robôs que preenchem formulário.

**C. O app chama a rota pronta da `landing/`**
- É o caminho mais rápido, mas depende do subdomínio da D3 já no ar.
- Também exige liberar esse endereço no `connect-src` da CSP do app e o CORS na `landing/`.
- Liga as duas páginas: se a `landing/` cair, o botão do app quebra.

## Decisão do RT

| # | Pergunta | Recomendação | Decisão do RT |
|---|---|---|---|
| F1 | Caminho do formulário | A | |
| F2 | Gravar o pedido no banco, além do e-mail | Não. O e-mail basta e evita guardar dado pessoal de quem ainda não é cliente | |
| F3 | Limite de envios | 3 por endereço de rede por hora | |

## Impacto se o RT escolher A

- **Código:**
  - função nova em `supabase/functions/pedir-demonstracao/`;
  - migration com a tabela de contagem e uma regra de limpeza diária;
  - componente do formulário em `src/pages/landing/`;
  - botões "Agendar demonstração" no topo e no fim da página.
- **Com o RT:**
  - segredo `TURNSTILE_SECRET` na homologação e na produção;
  - conferir que `RESEND_API_KEY` também está na homologação;
  - "ok produção" da migration e da função.
- **Teste:** envio real na homologação, com o e-mail chegando ao Gmail do contato, como foi feito em 09/11/2026.

## Não conferido

1. Se `RESEND_API_KEY` está configurado também na homologação, ou só na produção.
2. Onde o RT guarda o segredo do Turnstile hoje (painel da Cloudflare ou só na configuração do Auth do Supabase).
