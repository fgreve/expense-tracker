import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "month"; // "month" | "year" | "all"
  const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  // Build date filter
  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  let prevDateFilter: { gte?: Date; lt?: Date } | undefined;

  if (view === "month") {
    dateFilter = {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
    prevDateFilter = {
      gte: new Date(Date.UTC(year, month - 2, 1)),
      lt: new Date(Date.UTC(year, month - 1, 1)),
    };
  } else if (view === "year") {
    dateFilter = {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
    prevDateFilter = {
      gte: new Date(Date.UTC(year - 1, 0, 1)),
      lt: new Date(Date.UTC(year, 0, 1)),
    };
  }
  // view === "all" → no dateFilter

  // Current period expenses
  const where: Record<string, unknown> = { userId: session.id };
  if (dateFilter) where.date = dateFilter;

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
  });

  // Previous period for comparison
  let prevTotal = 0;
  if (prevDateFilter) {
    const prevExpenses = await prisma.expense.findMany({
      where: { userId: session.id, date: prevDateFilter },
    });
    prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // By category
  const byCategory = expenses.reduce<Record<string, { name: string; color: string; total: number; count: number }>>((acc, e) => {
    const key = e.category.name;
    if (!acc[key]) acc[key] = { name: key, color: e.category.color, total: 0, count: 0 };
    acc[key].total += e.amount;
    acc[key].count += 1;
    return acc;
  }, {});

  // Time series data - adapts to view mode
  let timeSeries: { date: string; amount: number; cumulative: number }[] = [];

  if (view === "month") {
    // Daily totals for the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const maxDay = (year === today.getFullYear() && month === today.getMonth() + 1)
      ? today.getDate()
      : daysInMonth;

    const dailyMap = expenses.reduce<Record<string, number>>((acc, e) => {
      const day = e.date.toISOString().split("T")[0];
      acc[day] = (acc[day] || 0) + e.amount;
      return acc;
    }, {});

    let cumulative = 0;
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const amount = dailyMap[dateStr] || 0;
      cumulative += amount;
      timeSeries.push({ date: dateStr, amount, cumulative });
    }
  } else if (view === "year") {
    // Monthly totals for the year
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyMap: Record<number, number> = {};
    for (const e of expenses) {
      const m = e.date.getMonth();
      monthlyMap[m] = (monthlyMap[m] || 0) + e.amount;
    }
    let cumulative = 0;
    const today = new Date();
    const maxMonth = year === today.getFullYear() ? today.getMonth() : 11;
    for (let m = 0; m <= maxMonth; m++) {
      const amount = monthlyMap[m] || 0;
      cumulative += amount;
      timeSeries.push({ date: monthNames[m], amount, cumulative });
    }
  } else {
    // Monthly totals across all time
    const monthlyMap: Record<string, number> = {};
    for (const e of expenses) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + e.amount;
    }
    const sortedKeys = Object.keys(monthlyMap).sort();
    let cumulative = 0;
    for (const key of sortedKeys) {
      const amount = monthlyMap[key];
      cumulative += amount;
      timeSeries.push({ date: key, amount, cumulative });
    }
  }

  // Weekly totals (last 4 weeks of the period)
  const today = new Date();
  const weeklyTotals: { week: string; amount: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const wEnd = new Date(today);
    wEnd.setDate(today.getDate() - w * 7);
    const wStart = new Date(wEnd);
    wStart.setDate(wEnd.getDate() - 6);
    const weekAmount = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d >= wStart && d <= wEnd;
      })
      .reduce((s, e) => s + e.amount, 0);
    const label = `${wStart.getDate()}/${wStart.getMonth() + 1}-${wEnd.getDate()}/${wEnd.getMonth() + 1}`;
    weeklyTotals.push({ week: label, amount: weekAmount });
  }

  // Budgets and alerts (only for month view)
  let alerts: { category: string; budget: number; spent: number; percentage: number }[] = [];
  if (view === "month") {
    const budgets = await prisma.budget.findMany({
      where: { userId: session.id, month, year },
      include: { category: true },
    });
    alerts = budgets
      .map((b) => {
        const spent = byCategory[b.category.name]?.total || 0;
        const pct = (spent / b.amount) * 100;
        return { category: b.category.name, budget: b.amount, spent, percentage: Math.round(pct) };
      })
      .filter((a) => a.percentage >= 80);
  }

  // Recent expenses (last 10)
  const recentExpenses = expenses.slice(0, 10).map((e) => ({
    id: e.id,
    amount: e.amount,
    description: e.description,
    date: e.date.toISOString(),
    receipt: e.receipt,
    category: { name: e.category.name, color: e.category.color },
  }));

  // Top expense
  const topExpense = expenses.length
    ? expenses.reduce((max, e) => (e.amount > max.amount ? e : max))
    : null;

  // All-time recent fallback
  let allTimeRecent: typeof recentExpenses = [];
  if (expenses.length === 0) {
    const latest = await prisma.expense.findMany({
      where: { userId: session.id },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 10,
    });
    allTimeRecent = latest.map((e) => ({
      id: e.id,
      amount: e.amount,
      description: e.description,
      date: e.date.toISOString(),
      receipt: e.receipt,
      category: { name: e.category.name, color: e.category.color },
    }));
  }

  return NextResponse.json({
    total,
    prevTotal,
    count: expenses.length,
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    timeSeries,
    weeklyTotals,
    alerts,
    recentExpenses,
    topExpense: topExpense
      ? { amount: topExpense.amount, description: topExpense.description, category: topExpense.category.name }
      : null,
    allTimeRecent,
    view,
  });
}
