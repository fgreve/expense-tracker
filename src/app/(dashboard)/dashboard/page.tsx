"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  CartesianGrid, Legend,
} from "recharts";

type ViewMode = "month" | "year" | "all";

interface RecentExpense {
  id: string;
  amount: number;
  description: string;
  date: string;
  receipt: string | null;
  category: { name: string; color: string };
}

interface Stats {
  total: number;
  prevTotal: number;
  count: number;
  byCategory: { name: string; color: string; total: number; count: number }[];
  timeSeries: { date: string; amount: number; cumulative: number }[];
  weeklyTotals: { week: string; amount: number }[];
  alerts: { category: string; budget: number; spent: number; percentage: number }[];
  recentExpenses: RecentExpense[];
  topExpense: { amount: number; description: string; category: string } | null;
  allTimeRecent: RecentExpense[];
  view: ViewMode;
}

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const viewLabels: Record<ViewMode, string> = { month: "Mes", year: "Ano", all: "Todo" };
const tooltipStyle = { backgroundColor: "var(--tooltip-bg, #fff)", border: "1px solid var(--tooltip-border, #e5e7eb)", borderRadius: "8px" };
const btnBase = "px-3 py-1.5 rounded-lg text-sm font-medium transition";
const btnActive = "bg-indigo-600 text-white";
const btnInactive = "bg-white dark:bg-gray-800 border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const now = new Date();
  const [view, setView] = useState<ViewMode>("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    const params = new URLSearchParams({ view, month: String(month), year: String(year) });
    fetch(`/api/expenses/stats?${params}`)
      .then((r) => r.json())
      .then(setStats);
  }, [view, month, year]);

  if (!stats) return <div className="animate-pulse text-gray-400 p-8">Cargando estadisticas...</div>;

  const periodDiff = stats.prevTotal > 0
    ? Math.round(((stats.total - stats.prevTotal) / stats.prevTotal) * 100)
    : null;

  function periodLabel() {
    if (view === "month") return `Total de ${monthNames[month - 1]} ${year}`;
    if (view === "year") return `Total de ${year}`;
    return "Total Historico";
  }

  function prevLabel() {
    if (view === "month") return "vs mes anterior";
    if (view === "year") return "vs ano anterior";
    return "";
  }

  function navigatePrev() {
    if (view === "month") {
      if (month === 1) { setMonth(12); setYear(year - 1); }
      else setMonth(month - 1);
    } else if (view === "year") {
      setYear(year - 1);
    }
  }

  function navigateNext() {
    if (view === "month") {
      if (month === 12) { setMonth(1); setYear(year + 1); }
      else setMonth(month + 1);
    } else if (view === "year") {
      setYear(year + 1);
    }
  }

  function currentLabel() {
    if (view === "month") return `${monthNames[month - 1]} ${year}`;
    if (view === "year") return String(year);
    return "Todo el historial";
  }

  // Chart labels
  const timeSeriesTitle = view === "month" ? "Gasto Acumulado del Mes" : view === "year" ? "Gasto Acumulado del Ano" : "Gasto Acumulado Historico";
  const barTitle = view === "month" ? "Gastos por Dia" : view === "year" ? "Gastos por Mes" : "Gastos por Mes";

  return (
    <div className="space-y-6">
      {/* Header with view mode and navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          {(["month", "year", "all"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`${btnBase} ${view === v ? btnActive : btnInactive}`}
            >
              {viewLabels[v]}
            </button>
          ))}

          {/* Navigation arrows (not for "all") */}
          {view !== "all" && (
            <div className="flex items-center gap-1 ml-2">
              <button onClick={navigatePrev} className={`${btnBase} ${btnInactive}`}>&larr;</button>
              <span className="text-sm font-medium px-3 py-1.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg min-w-[120px] text-center">
                {currentLabel()}
              </span>
              <button onClick={navigateNext} className={`${btnBase} ${btnInactive}`}>&rarr;</button>
            </div>
          )}
        </div>
      </div>

      {/* Budget alerts */}
      {stats.alerts.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((a) => (
            <div
              key={a.category}
              className={`p-3 rounded-lg text-sm font-medium ${
                a.percentage >= 100
                  ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
              }`}
            >
              {a.percentage >= 100 ? "Excedido" : "Alerta"}: {a.category} - Gastado ${fmt(a.spent)} de ${fmt(a.budget)} ({a.percentage}%)
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{periodLabel()}</p>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">${fmt(stats.total)}</p>
          {periodDiff !== null && view !== "all" && (
            <p className={`text-xs mt-1 font-medium ${periodDiff > 0 ? "text-red-500 dark:text-red-400" : "text-green-500 dark:text-green-400"}`}>
              {periodDiff > 0 ? "+" : ""}{periodDiff}% {prevLabel()}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Transacciones</p>
          <p className="text-3xl font-bold">{stats.count}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.byCategory.length} categorias</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Promedio por Gasto</p>
          <p className="text-3xl font-bold">${stats.count ? fmt(stats.total / stats.count) : "0"}</p>
          <p className="text-xs text-gray-400 mt-1">por transaccion</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Mayor Gasto</p>
          {stats.topExpense ? (
            <>
              <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">${fmt(stats.topExpense.amount)}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{stats.topExpense.description}</p>
            </>
          ) : (
            <p className="text-3xl font-bold text-gray-300 dark:text-gray-600">-</p>
          )}
        </div>
      </div>

      {/* Charts row 1: Cumulative area + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
          <h2 className="font-semibold mb-4">{timeSeriesTitle}</h2>
          {stats.timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.timeSeries}>
                <defs>
                  <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => view === "month" ? v.slice(8) : v} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  formatter={(v) => [`$${fmt(Number(v))}`, "Acumulado"]}
                  contentStyle={tooltipStyle}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} fill="url(#colorCumulative)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No hay datos para este periodo</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
          <h2 className="font-semibold mb-4">{barTitle}</h2>
          {stats.timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => view === "month" ? v.slice(8) : v} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  formatter={(v) => [`$${fmt(Number(v))}`, "Monto"]}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No hay datos para este periodo</p>
          )}
        </div>
      </div>

      {/* Charts row 2: Pie + Horizontal bars by category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
          <h2 className="font-semibold mb-4">Distribucion por Categoria</h2>
          {stats.byCategory.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.byCategory}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    strokeWidth={2}
                  >
                    {stats.byCategory.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${fmt(Number(v))}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm flex-1">
                {stats.byCategory.map((c) => {
                  const pct = stats.total > 0 ? Math.round((c.total / stats.total) * 100) : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">${fmt(c.total)}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No hay datos para este periodo</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
          <h2 className="font-semibold mb-4">Comparativa por Categoria</h2>
          {stats.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  formatter={(v) => [`$${fmt(Number(v))}`, "Total"]}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {stats.byCategory.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No hay datos para este periodo</p>
          )}
        </div>
      </div>

      {/* Weekly comparison */}
      {stats.weeklyTotals.some((w) => w.amount > 0) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
          <h2 className="font-semibold mb-4">Gastos por Semana</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.weeklyTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
              <Tooltip
                formatter={(v) => [`$${fmt(Number(v))}`, "Total"]}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar dataKey="amount" name="Gasto semanal" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent expenses */}
      {(() => {
        const expensesToShow = stats.recentExpenses.length > 0
          ? stats.recentExpenses
          : stats.allTimeRecent;
        const isAllTime = stats.recentExpenses.length === 0 && stats.allTimeRecent.length > 0;

        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold">
                {isAllTime ? "Ultimos Gastos (todos los periodos)" : `Gastos del Periodo`}
              </h2>
              {isAllTime && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">
                  No hay gastos en {currentLabel()}
                </span>
              )}
            </div>
            {expensesToShow.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">No hay gastos registrados. Ve a Gastos o Escanear para agregar.</p>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {expensesToShow.map((exp) => (
                  <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      {exp.receipt ? (
                        <a href={exp.receipt} target="_blank" rel="noopener noreferrer">
                          <img src={exp.receipt} alt="Recibo" className="w-9 h-9 rounded object-cover border dark:border-gray-600" />
                        </a>
                      ) : (
                        <div className="w-9 h-9 rounded flex items-center justify-center" style={{ backgroundColor: exp.category.color + "20" }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: exp.category.color }} />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{exp.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {exp.category.name} - {new Date(exp.date).toLocaleDateString("es")}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold">${fmt(exp.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
