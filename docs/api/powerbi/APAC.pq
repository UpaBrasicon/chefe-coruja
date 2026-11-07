// APAC de cada unidade da chave. Do paciente fica só o id.
let
    Registros = List.Combine(List.Transform(Unidades[id], (u) => CorujaLista("producao/apac", [unidade_id = u, limite = "100"]))),
    Planos = List.Transform(Registros, (r) => [
        id = r[id], unidade_id = r[unidade_id], paciente_id = try r[paciente][id] otherwise null,
        status = r[status], tipo = r[tipo], numero = r[numero],
        validade_inicio = r[validade_inicio], validade_fim = r[validade_fim],
        procedimento = r[procedimento], cid_principal = r[cid_principal],
        competencias_executadas = Text.Combine(List.Transform(r[competencias_executadas], Text.From), ", "),
        solicitada_em = r[solicitada_em], decidida_em = r[decidida_em]
    ]),
    Colunas = {"id", "unidade_id", "paciente_id", "status", "tipo", "numero", "validade_inicio", "validade_fim",
               "procedimento", "cid_principal", "competencias_executadas", "solicitada_em", "decidida_em"},
    Tabela = Table.FromRecords(Planos, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"id", type text}, {"unidade_id", type text}, {"paciente_id", type text}, {"status", type text}, {"tipo", type text},
        {"numero", type text}, {"validade_inicio", type date}, {"validade_fim", type date}, {"procedimento", type text},
        {"cid_principal", type text}, {"competencias_executadas", type text}, {"solicitada_em", type datetimezone}, {"decidida_em", type datetimezone}})
in
    Tipos
