// CorujaLista: busca uma lista da API do Chefe Coruja, página por página.
// - Segue o proximo_cursor até o fim.
// - No limite por minuto (429), espera o Retry-After e repete a mesma página,
//   até 5 vezes.
// - O endereço base é fixo (CorujaBase) e o caminho vai em RelativePath. Só
//   assim a atualização agendada do Power BI aceita a fonte.
// A mesma lógica, com testes, está em scripts/powerbi/coruja.mjs.
(caminho as text, filtros as record) as list =>
let
    Pagina = (cursor as nullable text, tentativa as number) as record =>
        let
            Query = if cursor = null then filtros else Record.AddField(filtros, "cursor", cursor),
            Resposta = Web.Contents(CorujaBase, [
                RelativePath = "v1/" & caminho,
                Query = Query,
                Headers = [Authorization = "Bearer " & CorujaChave, Accept = "application/json"],
                ManualStatusHandling = {429},
                IsRetry = tentativa > 0
            ]),
            Status = Value.Metadata(Resposta)[Response.Status],
            Espera = try Number.From(Value.Metadata(Resposta)[Headers][#"Retry-After"]) otherwise 60,
            Resultado =
                if Status = 429 and tentativa < 4 then
                    Function.InvokeAfter(() => @Pagina(cursor, tentativa + 1), #duration(0, 0, 0, Espera))
                else if Status = 429 then
                    error Error.Record("Chefe Coruja", caminho & ": limite por minuto da chave excedido 5 vezes seguidas.")
                else
                    Json.Document(Resposta)
        in
            Resultado,
    Paginas = List.Generate(
        () => [p = Pagina(null, 0)],
        each [p] <> null,
        each if [p][proximo_cursor] = null then [p = null] else [p = Pagina([p][proximo_cursor], 0)],
        each [p][dados]
    ),
    Dados = List.Combine(Paginas)
in
    Dados
