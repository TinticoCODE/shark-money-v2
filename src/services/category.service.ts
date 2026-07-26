import type { CategoryType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeDate } from "@/services/helpers/serialization.helper";

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
}

export interface UpdateCategoryInput {
  id: string;
  name: string;
}

function serializeCategory(category: {
  id: string;
  name: string;
  type: CategoryType;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    isSystem: category.isSystem,
    createdAt: serializeDate(category.createdAt),
    updatedAt: serializeDate(category.updatedAt),
  };
}

export async function listCategories(type?: CategoryType) {
  const categories = await prisma.category.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return categories.map(serializeCategory);
}

export async function createCategory(input: CreateCategoryInput) {
  const category = await prisma.category.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      isSystem: false,
    },
  });

  return serializeCategory(category);
}

export async function updateCategory(input: UpdateCategoryInput) {
  const existing = await prisma.category.findUniqueOrThrow({
    where: { id: input.id },
  });

  if (existing.isSystem) {
    throw new Error("Las categorías del sistema no se pueden renombrar");
  }

  const category = await prisma.category.update({
    where: { id: input.id },
    data: { name: input.name.trim() },
  });

  return serializeCategory(category);
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUniqueOrThrow({ where: { id } });

  if (category.isSystem) {
    throw new Error("Las categorías del sistema no se pueden eliminar");
  }

  const [transaction, budget] = await Promise.all([
    prisma.transaction.findFirst({ where: { categoryId: id }, select: { id: true } }),
    prisma.budget.findFirst({ where: { categoryId: id }, select: { id: true } }),
  ]);

  if (transaction || budget) {
    throw new Error("No se puede eliminar una categoría con transacciones o presupuestos");
  }

  await prisma.category.delete({ where: { id } });
  return { id };
}
