"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface ScannedExpense {
  id: string;
  amount: number;
  description: string;
  date: string;
  receipt: string | null;
  ocrText: string | null;
  category: { name: string; color: string };
}

export default function ScanPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", description: "", categoryId: "", date: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [scannedExpenses, setScannedExpenses] = useState<ScannedExpense[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadScannedExpenses() {
    fetch("/api/expenses?scanned=true")
      .then((r) => r.json())
      .then(setScannedExpenses);
  }

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
    loadScannedExpenses();
  }, []);

  const processFile = useCallback(async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
    setPreview(isPdf ? "pdf" : URL.createObjectURL(file));
    setProcessing(true);
    setOcrText("");
    setSaved(false);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar");
        return;
      }

      setOcrText(data.ocrText || "");
      setImageUrl(data.imageUrl || null);

      const catMatch = categories.find((c) => c.name === data.category);

      setForm({
        amount: data.amount ? String(data.amount) : "",
        description: data.description || "Recibo escaneado",
        categoryId: catMatch?.id || "",
        date: data.date || new Date().toISOString().split("T")[0],
      });
    } catch (err) {
      console.error(err);
      setError("Error al conectar con el servidor");
    } finally {
      setProcessing(false);
    }
  }, [categories]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      processFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, ocrText, receipt: imageUrl }),
        });
        if (res.ok) {
          setSaved(true);
          setForm({ amount: "", description: "", categoryId: "", date: "" });
          setOcrText("");
          setPreview(null);
          setImageUrl(null);
          loadScannedExpenses();
        }
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Escanear Recibo (OCR con IA)</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
            dragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
              : "dark:border-gray-600 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20"
          }`}
        >
          {preview ? (
            preview === "pdf" ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-5xl">&#128196;</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">PDF cargado</p>
              </div>
            ) : (
              <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
            )
          ) : (
            <div>
              <div className="text-4xl text-gray-300 dark:text-gray-600 mb-2">&#128247;</div>
              <p className="text-gray-500 dark:text-gray-400">
                {dragging ? "Suelta el archivo aqui" : "Click o arrastra una imagen o PDF de recibo"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG, PNG, PDF - Tickets, facturas, recibos</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2">Procesado con GPT-4o Vision / OCR</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />

        {processing && (
          <div className="mt-4 flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Analizando imagen con IA...</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
        )}
      </div>

      {ocrText && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
            <h2 className="font-semibold mb-3">Texto Detectado por IA</h2>
            <pre className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap max-h-64 overflow-auto">
              {ocrText}
            </pre>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
            <h2 className="font-semibold mb-3">Crear Gasto</h2>
            {saved ? (
              <div className="text-green-600 dark:text-green-400 font-medium p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                Gasto guardado correctamente!
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Monto (detectado por IA)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descripcion</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Categoria (sugerida por IA)</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                    required
                  >
                    <option value="">Seleccionar</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <button type="submit" disabled={saving} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                  {saving ? "Guardando..." : "Guardar Gasto"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Charts de gastos escaneados */}
      {scannedExpenses.length > 0 && (() => {
        const total = scannedExpenses.reduce((s, e) => s + e.amount, 0);
        const byCat: Record<string, { name: string; color: string; total: number; count: number }> = {};
        const byMonth: Record<string, number> = {};

        for (const exp of scannedExpenses) {
          const cat = exp.category.name;
          if (!byCat[cat]) byCat[cat] = { name: cat, color: exp.category.color, total: 0, count: 0 };
          byCat[cat].total += exp.amount;
          byCat[cat].count += 1;

          const m = exp.date.slice(0, 7);
          byMonth[m] = (byMonth[m] || 0) + exp.amount;
        }

        const catData = Object.values(byCat).sort((a, b) => b.total - a.total);
        const monthData = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, amount]) => ({ month, amount }));

        return (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Escaneado</p>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">${fmt(total)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">Recibos Escaneados</p>
                <p className="text-3xl font-bold">{scannedExpenses.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">Promedio por Recibo</p>
                <p className="text-3xl font-bold">${fmt(total / scannedExpenses.length)}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                <h2 className="font-semibold mb-4">Escaneos por Categoria</h2>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={220}>
                    <PieChart>
                      <Pie data={catData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} strokeWidth={2}>
                        {catData.map((c) => <Cell key={c.name} fill={c.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`$${fmt(Number(v))}`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 text-sm flex-1">
                    {catData.map((c) => {
                      const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
                      return (
                        <div key={c.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="flex-1">{c.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 tabular-nums">{c.count}</span>
                          <span className="text-gray-400 dark:text-gray-500 text-xs w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                <h2 className="font-semibold mb-4">Escaneos por Mes</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                    <Tooltip
                      formatter={(v) => [`$${fmt(Number(v))}`, "Total"]}
                      contentStyle={{ backgroundColor: "var(--tooltip-bg, #fff)", border: "1px solid var(--tooltip-border, #e5e7eb)", borderRadius: "8px" }}
                    />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lista de gastos escaneados */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
              <div className="p-4 border-b dark:border-gray-700">
                <h2 className="font-semibold">Historial de Recibos Escaneados</h2>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {scannedExpenses.map((exp) => (
                  <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      {exp.receipt ? (
                        <a href={exp.receipt} target="_blank" rel="noopener noreferrer">
                          <img src={exp.receipt} alt="Recibo" className="w-10 h-10 rounded object-cover border dark:border-gray-600" />
                        </a>
                      ) : (
                        <div className="w-10 h-10 rounded flex items-center justify-center" style={{ backgroundColor: exp.category.color + "20" }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: exp.category.color }} />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{exp.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {exp.category.name} &middot; {new Date(exp.date).toLocaleDateString("es")}
                        </p>
                        {exp.ocrText && (
                          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 truncate max-w-xs">
                            OCR: {exp.ocrText.slice(0, 60)}...
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold">${fmt(exp.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
