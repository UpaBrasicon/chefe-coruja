// Atendimentos da porta nos últimos DiasParaTras dias, de cada unidade da chave.
// - A API aceita no máximo 31 dias por consulta. O período é dividido em
//   janelas de até 31 dias, e o "ate" de cada janela é exclusivo.
// - Do paciente fica só o id (pseudônimo). O painel conta atendimentos e não
//   precisa de nome nem de CNS.
let
    Fim = DateTimeZone.SwitchZone(DateTimeZone.FixedUtcNow(), 0),
    Inicio = Fim - #duration(DiasParaTras, 0, 0, 0),
    Iso = (d as datetimezone) as text => DateTimeZone.ToText(DateTimeZone.SwitchZone(d, 0), [Format = "yyyy-MM-dd'T'HH:mm:ss'Z'"]),
    Janelas = List.Generate(
        () => Inicio,
        each _ < Fim,
        each _ + #duration(31, 0, 0, 0),
        each [desde = Iso(_), ate = Iso(List.Min({_ + #duration(31, 0, 0, 0), Fim}))]
    ),
    Registros = List.Combine(List.Transform(Unidades[id], (u) =>
        List.Combine(List.Transform(Janelas, (j) =>
            CorujaLista("atendimentos", [unidade_id = u, desde = j[desde], ate = j[ate], limite = "100"]))))),
    Planos = List.Transform(Registros, (r) => [
        id = r[id], unidade_id = r[unidade_id],
        paciente_id = try r[paciente][id] otherwise null,
        setor = r[setor], chegada_em = r[chegada_em], situacao = r[situacao],
        cor = try r[classificacao][cor] otherwise null,
        classificada_em = try r[classificacao][classificada_em] otherwise null,
        atendimento_medico_em = r[atendimento_medico_em], cid_principal = r[cid_principal],
        desfecho = r[desfecho], desfecho_em = r[desfecho_em]
    ]),
    Colunas = {"id", "unidade_id", "paciente_id", "setor", "chegada_em", "situacao", "cor", "classificada_em",
               "atendimento_medico_em", "cid_principal", "desfecho", "desfecho_em"},
    Tabela = Table.FromRecords(Planos, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"id", type text}, {"unidade_id", type text}, {"paciente_id", type text}, {"setor", type text},
        {"chegada_em", type datetimezone}, {"situacao", type text}, {"cor", type text}, {"classificada_em", type datetimezone},
        {"atendimento_medico_em", type datetimezone}, {"cid_principal", type text}, {"desfecho", type text}, {"desfecho_em", type datetimezone}})
in
    Tipos
