# Item 33: abrir a conexão com o Supabase antes do JavaScript

Pedido avulso do RT em 23/11/2026 (latência de `/plataformas`). Decisão do RT: só a opção C, prioridade P2, e "faz agora".

## O que muda

Uma linha no `<head>` do `index.html`:

```html
<link rel="preconnect" href="%VITE_SUPABASE_URL%" crossorigin />
```

- O Vite troca `%VITE_SUPABASE_URL%` no build. A produção aponta para `saqjrjtrkzkswsxxvdxn` e a homologação para `kswurfyxxvfydpjfrivy`, sem endereço fixo no arquivo.
- `crossorigin` (anônimo) porque o `supabase-js` chama sem cookie. Sem ele, o navegador abriria uma conexão que o `fetch` não reaproveita.
- O CSP já permite `https://*.supabase.co`.
- Não muda o número do cartão "Latência daqui": ele já usa a mediana de 3 leituras, que descarta a abertura da conexão.

## Teste

`src/lib/preconnectSupabase.test.ts` (roda no passo "src/lib" do CI):

- confere o `preconnect` com `%VITE_SUPABASE_URL%` e `crossorigin` no `<head>`;
- confere que o `index.html` não tem endereço fixo de projeto Supabase.

Falha no master ("falta <link rel=\"preconnect\" ...>") e passa na branch. Suíte `src/lib` inteira: 706 aprovados, 0 falhas.

## Build

`npm run build` com o ambiente da homologação gera em `dist/index.html`:

```html
<link rel="preconnect" href="https://kswurfyxxvfydpjfrivy.supabase.co" crossorigin />
```

Nenhum `%VITE` sobra no HTML.

## Medição antes e depois (23/11/2026, PC do RT, por cabo)

`vite preview` do build da homologação, no navegador do app. Dois endereços da mesma máquina (`[::1]` e `localhost`), para cada página começar sem conexão aberta com o Supabase. Dois segundos depois de abrir a página, um `fetch` a `/auth/v1/health` da homologação, como a primeira chamada do app depois do login:

| Página | preconnect | Primeira chamada |
|---|---|---|
| `http://[::1]:4183/sem.html` (cópia sem a linha) | não | 409 ms |
| `http://localhost:4183/` | sim | 97 ms |

Os 409 ms somam DNS, TCP, TLS, a checagem prévia do CORS e a resposta. Com o `preconnect`, só sobram a checagem prévia do CORS e a resposta. É uma medida só de cada lado, em rede de casa. O tamanho do ganho varia com a rede, mas a ordem de grandeza bate com a de 23/11 por `curl`: abrir a conexão custou de 120 a 230 ms (até 436 ms na primeira vez do dia).

O Supabase não manda `Timing-Allow-Origin`, então o navegador não separa DNS, TCP e TLS nas chamadas para outro domínio. Por isso a tabela traz só o total.

## Como reverter

Apagar a linha do `index.html` e o teste. Só frontend: sem migration, sem chave e sem mudança no Supabase.
