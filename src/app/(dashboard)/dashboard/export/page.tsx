"use client";

import { useState } from "react";

type ViewMode = "month" | "year" | "all";

const viewLabels: Record<ViewMode, string> = { month: "Mes", year: "Ano", all: "Todo" };
const btnBase = "px-3 py-1.5 rounded-lg text-sm font-medium transition";
const btnActive = "bg-indigo-600 text-white";
const btnInactive = "bg-white dark:bg-gray-800 border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700";

export default function ExportPage() {
  const now = new Date();
  const [view, setView] = useState<ViewMode>("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  function handleExport() {
    const params = new URLSearchParams({ view, month: String(month), year: String(year) });
    window.open(`/api/expenses/export?${params}`, "_blank");
  }

  function description() {
    if (view === "month") {
      const monthName = new Date(2024, month - 1).toLocaleString("es", { month: "long" });
      return `Se exportaran los gastos de ${monthName} ${year}.`;
    }
    if (view === "year") return `Se exportaran todos los gastos del ano ${year}.`;
    return "Se exportaran todos los gastos registrados.";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Exportar Reportes</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 space-y-5 max-w-lg">
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Exporta tus gastos en formato CSV para declaraciones fiscales o analisis personal.
        </p>

        {/* View mode toggle */}
        <div>
          <label className="text-sm font-medium block mb-2">Periodo</label>
          <div className="flex gap-2">
            {(["month", "year", "all"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`${btnBase} ${view === v ? btnActive : btnInactive}`}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Month/Year selectors */}
        {view !== "all" && (
          <div className="flex gap-4">
            {view === "month" && (
              <div>
                <label className="text-sm font-medium block mb-1">Mes</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleString("es", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1">Ano</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-4 py-2 border dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">{description()}</p>

        <button
          onClick={handleExport}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          Descargar CSV
        </button>
      </div>
    </div>
  );
}
