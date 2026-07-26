import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const expenseCategories = [
  "Comida",
  "Transporte",
  "Vivienda",
  "Entretenimiento",
  "Salud",
  "Servicios",
  "Educación",
  "Ropa",
  "Otros gastos",
];

const incomeCategories = [
  "Salario",
  "Ingresos extra",
  "Reembolsos",
  "Otros ingresos",
];

async function main() {
  const existingSettings = await prisma.userSettings.findFirst();

  if (!existingSettings) {
    await prisma.userSettings.create({
      data: {
        timezone: "America/Bogota",
        currency: "COP",
      },
    });
  }

  for (const name of expenseCategories) {
    await prisma.category.upsert({
      where: {
        name_type: {
          name,
          type: "EXPENSE",
        },
      },
      update: {},
      create: {
        name,
        type: "EXPENSE",
        isSystem: true,
      },
    });
  }

  for (const name of incomeCategories) {
    await prisma.category.upsert({
      where: {
        name_type: {
          name,
          type: "INCOME",
        },
      },
      update: {},
      create: {
        name,
        type: "INCOME",
        isSystem: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
