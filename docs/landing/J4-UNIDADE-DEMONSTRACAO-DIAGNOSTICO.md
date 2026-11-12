# J4: unidade de demonstração e telas reais na página de entrada — diagnóstico

**Pedido.** Pedido 8 do RT, caminho C, decisão D2 de 11/11/2026: as telas da página de entrada do app (www.chefecoruja.com.br) vêm de uma unidade de demonstração na homologação, com nomes realistas e números coerentes, e não das capturas de teste com nomes "F5".

**Escopo.** Este documento é só diagnóstico. Nada muda no banco, no código ou na página aqui.

## Como está hoje

- **Página de entrada do app** (`src/pages/landing/Landing.tsx`): não mostra nenhuma tela real.
  - A "Escala de hoje · Sala amarela" é um desenho em código com valores ilustrativos. A própria página avisa isso.
  - A única imagem é o mascote (`/landing/coruja.webp`).
- **Demo local** (branch local `demo/landing-propostas`, sem push):
  - a seção "Um plantão no Chefe Coruja" (`landing/components/UmPlantao.tsx`, em Next) troca três telas pela rolagem: porta, painel do gestor e escala;
  - as três capturas foram tiradas na homologação com o login de gestor da rede de teste da Fase 5. Por isso aparecem nomes como "Médico UPA F5" e "UPA Fase 5 24h", que não servem para a página pública.
- **Dados de teste na homologação** (`scripts/e2e/`):
  - cada rodada cria uma rede própria (por exemplo "Rede E2E Fase 5"), com CNES fictícios, uma conta por papel e a escala;
  - os pacientes passam pelo fluxo chamando as funções do banco como cada papel, com RLS ligado, em `10_` a `16_` e `32_` a `34_`;
  - as contas recebem o hash da senha de teste, que não fica no repositório (`scripts/e2e/homolog/preparar.mjs`).
- **Demo ao gestor** (`supabase/homolog/demo-preparar.sql`): põe na escala o usuário de quem apresenta, na "UPA Homologação", hoje e amanhã. Não cria pacientes.
- **Troca de unidade:** o app já tem seletor de unidade (`src/pages/SeletorUnidade.tsx`). Um usuário pode ter papéis em várias unidades e ver uma de cada vez.

## O que muda

Uma rede nova e separada na homologação: a "rede de demonstração". Ela tem:

- **Unidade:** uma UPA 24h com nome fictício e endereço genérico.
- **Setores e leitos:** Pronto Socorro, Observação Adulto, Observação Pediátrica e Sala Vermelha, com leitos.
- **Equipe:** cerca de 20 pessoas com nomes fictícios realistas (médicos, enfermagem, recepção, farmácia), na escala do mês. As de agora já fizeram check-in.
- **Contas da equipe sem senha:** ninguém consegue entrar com elas. Existem só para o nome aparecer na escala e no prontuário.
- **Pacientes:** fictícios, com nomes realistas, no meio do plantão. Ficam espalhados pela porta (triagem, médico, medicação, reavaliação), pela observação e pela sala vermelha, com classificações de risco variadas.
- **Ocupação:** perto de 70%.
- **Coerência:** os números do painel do gestor batem com o que a porta e os leitos mostram, porque tudo nasce pelas funções do banco, como nas rodadas de teste.
- **Um roteiro que renova o cenário:** rodado de novo, ele traz o plantão para o dia e a hora de agora. Assim a unidade serve também para demonstração ao vivo para clientes.

Com as telas novas, a página de entrada do app ganha a seção "Um plantão". É o mesmo comportamento da demo local, refeito em React com Vite, sem Next:
- a tela fica parada enquanto a pessoa rola, e cada trecho da rolagem mostra uma tela;
- há botões para ir direto a cada tela;
- para quem pede menos movimento, as telas trocam sem animação;
- a legenda avisa "Telas reais do sistema, com pacientes e equipe fictícios".

## Subtarefas

1. **Banco (só homologação):** roteiro `scripts/demo/01_rede_demonstracao.sql`, que cria a organização, a unidade, os setores, os leitos, a equipe sem senha e a escala do mês.
2. **Cenário:** roteiro `scripts/demo/02_plantao_agora.sql`. Ele limpa os pacientes da rede de demonstração e cria o plantão de agora pelas funções do banco: recepção, triagem, atendimento, prescrição, observação, check-in.
3. **Acesso para capturar:** dar à conta escolhida em G2 os papéis de gestor e médico na unidade de demonstração.
4. **Capturas:** o RT entra, troca para a unidade de demonstração e eu tiro as telas pelo navegador. Tamanho 1424 × 749, em JPG, sem nada de outra rede à vista.
5. **Página:**
   - seção "Um plantão" em `src/pages/landing/`, com as imagens em `public/landing/telas/`;
   - teste do componente: troca de tela, botões e menos movimento;
   - conferência em 375 px e em 1280 px.
6. **Limpeza:** roteiro `scripts/demo/99_limpar_rede_demonstracao.sql`, que apaga a rede de demonstração inteira.

## Banco, funções e permissões

- **Sem migration:** nada muda na estrutura do banco. São só dados na homologação, como nas rodadas de teste.
- **Nunca na produção:** os roteiros começam com a mesma trava do `seed-homolog.sql`, que recusa rodar se o banco não for a homologação.
- **Pacientes pelas funções do banco:** os pacientes entram chamando as funções como cada papel, com RLS ligado. Assim a demonstração também prova que o fluxo funciona.
- **Auditoria:** as ações ficam na auditoria normal da homologação, em nome das contas da equipe fictícia.

## Testes e critérios de aceite (com evidência)

- Os roteiros rodam duas vezes seguidas sem erro, porque são repetíveis.
- O painel do gestor e a porta mostram os mesmos números de pacientes e de ocupação.
- Nenhuma tela capturada mostra "E2E", "F5", "teste" ou nome de pessoa real.
- Na página de entrada:
  - as três telas trocam pela rolagem e pelos botões;
  - sem animação para quem pede menos movimento;
  - nada passa da largura em 375 px;
  - o título e o botão de entrar aparecem no primeiro olhar em 1280 × 800.
- A evidência fica em `docs/landing/j4-evidencia/`, com as capturas e o resultado das conferências.

## Riscos

- **Nome igual ao de unidade real:** o nome fictício pode coincidir com uma UPA que existe. Antes de usar, confiro numa busca. A legenda deixa claro que os dados são fictícios.
- **Nome igual ao de pessoa conhecida:** os nomes saem de combinações comuns de nome e sobrenome. Nenhum nome de pessoa pública.
- **Tela desatualizada:** quando a tela do app mudar, a captura fica velha. O roteiro de renovação permite capturar de novo em minutos.
- **Imagens pesadas:** cada JPG precisa ficar abaixo de 250 KB, com carregamento sob demanda fora do primeiro olhar.

## Decisões do RT

| # | Pergunta | Opções | Recomendação | Decisão do RT |
|---|---|---|---|---|
| G1 | Nome da unidade | a) nome fictício realista, conferido numa busca, por exemplo "UPA 24h Jardim Primavera"; b) o RT escolhe o nome | a | a: "UPA 24h Jardim Primavera", organização "Rede de Demonstração" (12/11/2026) |
| G2 | Conta para capturar | a) a conta do próprio RT recebe gestor e médico na unidade de demonstração, sem conta nova nem senha nova; b) uma conta nova de demonstração, com senha de teste, que precisa do ok do RT para o hash | a | a: a conta do próprio RT, sem conta nova nem senha (12/11/2026) |
| G3 | Quais telas | a) as três da demo local: porta, painel do gestor e escala; b) as três e mais o leito, com prescrição e evolução | a, e o leito depois | a: porta, painel do gestor e escala (12/11/2026) |
| G4 | A unidade fica na homologação | a) fica, com o roteiro de renovação, e serve para demonstração ao vivo; b) apagada depois das capturas | a | a: fica, com o roteiro de renovação (12/11/2026) |

## Ordem

G1–G4 → roteiros 01 e 02 na homologação → acesso da conta do G2 → capturas, com o RT logado → seção na página, em PR próprio → conferência na homologação → ok do RT → mesclar.

## Demonstração comercial

A mesma unidade serve para a demonstração ao vivo do formulário J3. Antes de cada apresentação, o roteiro 02 põe o plantão na hora certa.
