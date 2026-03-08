import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { name: "Alimentacion", icon: "utensils", color: "#ef4444" },
  { name: "Transporte", icon: "car", color: "#f97316" },
  { name: "Entretenimiento", icon: "gamepad", color: "#a855f7" },
  { name: "Salud", icon: "heart", color: "#ec4899" },
  { name: "Educacion", icon: "book", color: "#3b82f6" },
  { name: "Servicios", icon: "zap", color: "#eab308" },
  { name: "Compras", icon: "shopping-bag", color: "#14b8a6" },
  { name: "Otros", icon: "tag", color: "#6b7280" },
];

async function main() {
  // Seed categories
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("Seed: categories created");

  // Seed admin user
  const adminEmail = "admin@expense.com";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashed,
        name: "Administrador",
        role: "admin",
      },
    });
    console.log("Seed: admin user created (admin@expense.com / admin123)");
  } else {
    console.log("Seed: admin user already exists");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
