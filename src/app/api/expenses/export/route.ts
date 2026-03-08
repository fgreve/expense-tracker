import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "month";
  const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  // Build date filter
  const where: Record<string, unknown> = { userId: session.id };
  let filename: string;

  if (view === "month") {
    where.date = {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
    filename = `gastos-${year}-${String(month).padStart(2, "0")}.csv`;
  } else if (view === "year") {
    where.date = {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
    filename = `gastos-${year}.csv`;
  } else {
    filename = `gastos-historico.csv`;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const header = "Fecha,Descripcion,Categoria,Monto\n";
  const rows = expenses
    .map((e) => {
      const date = e.date.toISOString().split("T")[0];
      const desc = e.description.replace(/,/g, ";");
      return `${date},${desc},${e.category.name},${Math.round(e.amount)}`;
    })
    .join("\n");

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const footer = `\n\nTotal,,,${Math.round(total)}`;

  return new NextResponse(header + rows + footer, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
