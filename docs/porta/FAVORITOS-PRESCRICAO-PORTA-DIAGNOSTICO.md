# Favoritos de prescrição na porta: diagnóstico

Este é o achado guardado de 07/10/2026, do ensaio da demo, que o RT abriu em 06/11/2026 como item 3 da frente "Achados guardados".

## O problema

As "Minhas preferências de prescrição" (`/preferencias-prescricao`) aparecem só no Receituário da alta, em "Meus favoritos". A prescrição do PS não oferece os favoritos, então o médico redigita o mesmo medicamento, a mesma dose e a mesma via a cada paciente.

## O que já existe

- **Tabela `preferencias_prescricao`** (migration `20261002000001`). Cada linha guarda um favorito do próprio médico: `medicamento_id`, `dose`, `via`, `posologia`, `quantidade`, `classe_alergenica` e `receita_padrao`.
  - O RLS só deixa o dono ler e gravar. O gestor não vê os favoritos de ninguém.
  - Tudo é escrito pelo médico, e o sistema não sugere dose.
- **Receituário** (`ReceituarioMedico.tsx`):
  - os favoritos aparecem como chips;
  - o chip fica travado quando o paciente tem alergia ao medicamento (`useTravas`) e marcado quando o item já está na receita;
  - o paciente pediátrico não recebe favoritos (`pediatrico ? []`).
- **Porta** (`PrescricaoEstruturada.tsx`): o "Novo item" tem medicamento, dose, via (`VIAS_PORTA`) e "Quando". Pelo item 2, o "Quando" agora tem Agora, Se necessário, 4/4h a 24/24h e Outra.
- **Não precisa de migration.** A leitura é a mesma do Receituário, e a prescrição continua pela `prescrever`.

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| G1 | Onde aparecem | Chips "Meus favoritos" acima do "Novo item" na prescrição da porta, só na porta por enquanto | Também na prescrição do leito |
| G2 | O que o clique faz | Preenche o "Novo item": medicamento, dose, via e frequência. O médico confere e clica em Prescrever; nada é prescrito direto | Prescreve direto ao clicar |
| G3 | Frequência do favorito | Se a frequência do favorito é uma que o sistema entende (ex.: "8/8h", "a cada 6 horas"), marca o botão correspondente ou "Outra" com o texto. Se não entende (ex.: um texto de receita como "1 cp de 8/8h por 5 dias, se dor"), o "Quando" fica em branco para o médico escolher | Copia sempre o texto em "Outra" |
| G4 | Via do favorito fora das vias da porta | A via aparece como lembrete, mas o médico escolhe entre as vias da porta | Ignorar a via do favorito |
| G5 | Paciente pediátrico | Sem favoritos, como no Receituário: dose de criança não vem de favorito | Com favoritos |

Ficam como no Receituário, sem decisão: o chip travado quando há alergia ao medicamento e o link "Editar" para as preferências.

## Plano com A em tudo
1. **Testes antes.** Uma função pura `deFavoritoParaPorta(favorito)` → `{ medicamento, dose, via, quando }`, com os casos da G3 e da G4, e um teste de fonte da tela.
2. **`PrescricaoEstruturada.tsx` (modo porta).**
   - Os chips leem `preferencias_prescricao` com a mesma consulta do Receituário.
   - Pediatria e alergia seguem a regra do Receituário.
   - O clique preenche o formulário.
3. **Homologação.**
   - No Chrome, como médico de teste: cadastrar um favorito, abrir a porta, clicar no chip e conferir o formulário preenchido antes de prescrever.
   - Conferir também que a alergia trava o chip.

## Riscos
- **Dose de receita aplicada à porta.** Uma dose pensada para casa pode não servir para o PS. Por isso a G2 só preenche o formulário: o médico confere e o envio é dele.
