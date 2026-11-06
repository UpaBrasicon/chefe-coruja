# Recarregar a página sem conexão: diagnóstico

Este é o achado guardado de 09/10/2026, do teste da Fase 2, tarefa 7. O RT o abriu em 05/11/2026 como item 3 do lote de segurança.

## O problema

A fila sem conexão não se perde, porque fica no IndexedDB, cifrada. Mas, se a enfermagem recarrega a página durante uma queda, cai no login e fica sem o sistema até a rede voltar. Até agora, o plano de contingência só diz para não recarregar durante a queda.

## O que acontece hoje numa recarga sem conexão

Mapeei o caminho da carga em 05/11/2026, na ordem em que ele roda:

1. **A casca do app.** O `public/sw.js` serve o último `index.html` e os arquivos de `/assets` que já foram baixados. Ele não guarda nada de antemão: uma tela que não foi aberta desde o último deploy (são cerca de 90 telas carregadas sob demanda) não abre sem conexão. O login também é uma delas.
2. **A sessão.** Com o token vencido (ele dura 15 min), o `getSession()` tenta renová-lo por uns 30 s e devolve "sem sessão". O token continua guardado, mas o `AuthContext` trata isso como sessão encerrada e **apaga os rascunhos cifrados e a chave do cofre**.
3. **O perfil.** O `loadPerfil` falha. O perfil fica vazio, e o `RequireAuth` manda para o `/login`.
4. **Os vínculos.** Mesmo passando do perfil, a lista de vínculos falha, e a tela vai para "Aguardando liberação", que é enganosa e não tem saída.
5. **O segundo fator.** A consulta falha e o portão fica aberto na tela. Mas o servidor recusa tudo depois que a rede volta, então isso não é falha de segurança.
6. **O plantão.** O `usePlantao` já sabe entrar no modo sem conexão, com as regras de 2 h e 20 min guardadas em `cc-relogio-servidor`. Para isso, precisa da unidade ativa, que depende dos vínculos.
7. **Os dados das telas.** Nada do que as telas leram fica guardado. Mesmo que a casca e a sessão voltem, a lista de leitos e pacientes aparece vazia.

### Três defeitos que valem já, com ou sem conexão

- **D1. "Sair" sem conexão deixa o token no navegador.** O supabase-js não apaga o token quando o pedido de saída falha por falta de rede. A tela volta para o login e apaga os rascunhos, mas o token (`sb-*`) fica guardado. Num computador compartilhado, quando a rede volta, a próxima pessoa pode encontrar a sessão de quem saiu. **É falha de segurança.**
- **D2. A chave do cofre não volta sem conexão.** O `useChaveRascunho` só usa a cópia da chave na aba (`chaveDaAba()`) quando o segundo fator respondeu. Sem conexão, ele declara "pronto" sem restaurar a chave. Os rascunhos ficam ilegíveis e os novos não são gravados, mesmo na mesma aba.
- **D3. Falha de rede é tratada como sessão encerrada.** É o item 2 da lista acima: os rascunhos e a chave são apagados só porque a renovação do token não alcançou o servidor.

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| N1 | Ordem | Em três partes, cada uma com PR próprio: **parte 1** corrige D1 a D3; **parte 2** faz a carga sem conexão (sessão, perfil, vínculos, segundo fator e as telas da enfermagem guardadas de antemão); **parte 3** guarda os dados das telas de enfermagem para mostrar depois da recarga. | Tudo de uma vez. |
| N2 | Onde guardar o perfil, os vínculos e os dados das telas | Cifrados com a chave da sessão (o mesmo cofre dos rascunhos). Valem na **mesma aba**: fechar a aba ou o navegador apaga tudo, e só a próxima pessoa com login novo vê algo. | Cifrados com uma chave do aparelho no IndexedDB: valem também numa aba nova e depois de fechar o navegador. É mais cômodo e mais exposto em computador compartilhado. |
| N3 | Até quando a carga sem conexão vale | Com as regras do modo sem conexão: até 2 h sem contato com o servidor e até 20 min depois do fim do plantão, pelo `cc-relogio-servidor`. Passou disso, vai para o login. | Sem limite próprio, até a sessão vencer. |
| N4 | Bloqueio por ociosidade sem conexão | Continua igual: 10 min de inatividade bloqueia a tela e 30 min encerra a sessão. Desbloquear exige rede, porque a senha é conferida no servidor. A fila não se perde. | Desbloquear sem rede com um PIN local. Pede uma decisão de segurança à parte. |
| N5 | Quais telas ficam guardadas de antemão (parte 2) | Login, casca, triagem, painel de cuidados da enfermagem (sinais vitais, anotação e escalas), checagem e evolução. | Todas as telas: o primeiro carregamento fica mais pesado. |

## Plano com A em tudo

- **Parte 1, sem migration. Testes antes do código:**
  - `signOut` e `encerrarLocal` apagam o `sb-*` mesmo se o pedido falhar;
  - `useChaveRascunho` chama `chaveDaAba()` quando não há resposta;
  - o `AuthContext` só apaga os rascunhos e a chave quando a sessão realmente não existe, e não quando a renovação falhou por rede.
  - Conferir na homologação desligando a rede no Chrome.
- **Parte 2:**
  - um `src/lib/offline/sessaoLocal.ts` guarda, cifrados, o perfil (só os campos usados), os vínculos com a situação de super administrador e o estado do segundo fator com a hora;
  - o `AuthContext` e o `UnidadeContext` usam esse cache quando a rede falha, dentro da regra N3;
  - o `sw.js` guarda as telas do N5 de antemão (lista gerada no build).
- **Parte 3:** as consultas das telas de enfermagem, com leitos, pacientes e prescrições do dia, ficam guardadas cifradas e são mostradas com o aviso "Dados das HH:MM, sem conexão".

## Riscos

- **Dado de paciente guardado no aparelho (parte 3).** Fica cifrado com a chave da sessão, só na mesma aba, e é apagado ao sair. O aviso com a hora deixa claro que pode estar desatualizado.
- **Relógio do aparelho atrasado.** O `horaServidor` já recusa um relógio que voltou para trás.
- **O login continua impossível sem conexão.** A Turnstile e o servidor de autenticação precisam de rede, e isso não muda.
