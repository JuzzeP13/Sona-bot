import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function AdminDashboardPage() {
  const stats = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard
  });

  if (stats.isLoading) {
    return <div className="text-slate-300">Загрузка статистики...</div>;
  }

  if (stats.isError || !stats.data) {
    return <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-rose-200">Не удалось загрузить статистику</div>;
  }

  const cards = [
    ["Всего заявок", stats.data.totals.total],
    ["Новых", stats.data.totals.new],
    ["В работе", stats.data.totals.in_work],
    ["Успешных", stats.data.totals.success],
    ["Отказов", stats.data.totals.failed],
    ["Без менеджера", stats.data.totals.unassigned],
    ["Сегодня", stats.data.totals.today],
    ["За неделю", stats.data.totals.week],
    ["За месяц", stats.data.totals.month]
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Сводка по заявкам, менеджерам и моделям диванов.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="font-semibold">Статистика по менеджерам</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-4 py-3">Всего</th>
                  <th className="px-4 py-3">В работе</th>
                  <th className="px-4 py-3">Успешно</th>
                  <th className="px-4 py-3">Отказы</th>
                  <th className="px-4 py-3">Конверсия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.data.managers.map((item) => (
                  <tr key={item.manager.id}>
                    <td className="px-4 py-3 font-medium">{item.manager.name}</td>
                    <td className="px-4 py-3">{item.totalAssigned}</td>
                    <td className="px-4 py-3">{item.inWork}</td>
                    <td className="px-4 py-3">{item.success}</td>
                    <td className="px-4 py-3">{item.failed}</td>
                    <td className="px-4 py-3">{item.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="font-semibold">Популярность моделей</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {stats.data.models.map((model) => (
              <div key={model.model} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{model.label}</span>
                <span className="rounded-md bg-slate-800 px-2.5 py-1 text-sm font-semibold text-slate-100">{model.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
