// Fechamentos de competência (BPA e APAC) de cada unidade da chave.
// Esta lista não é paginada: vem inteira numa resposta.
let
    PorUnidade = List.Transform(Unidades[id], (u) =>
        let
            Resposta = Json.Document(Web.Contents(CorujaBase, [
                RelativePath = "v1/producao/fechamentos",
                Query = [unidade_id = u],
                Headers = [Authorization = "Bearer " & CorujaChave, Accept = "application/json"]
            ]))
        in
            List.Transform(Resposta[dados], (r) => Record.AddField(r, "unidade_id", u))),
    Tabela = Table.FromRecords(List.Combine(PorUnidade),
        {"unidade_id", "instrumento", "competencia", "situacao", "linhas", "linhas_bpa_c", "apacs", "controle", "fechado_em", "reaberto_em"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"unidade_id", type text}, {"instrumento", type text}, {"competencia", type text}, {"situacao", type text},
        {"linhas", Int64.Type}, {"linhas_bpa_c", Int64.Type}, {"apacs", Int64.Type}, {"controle", Int64.Type},
        {"fechado_em", type datetimezone}, {"reaberto_em", type datetimezone}})
in
    Tipos
