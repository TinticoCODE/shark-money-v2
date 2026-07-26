"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as categoryService from "@/services/category.service";
import { categoryTypeSchema, idSchema } from "@/validators/common";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  type: categoryTypeSchema,
});

const updateCategorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "El nombre es obligatorio"),
});

export async function listCategoriesAction(
  type?: "INCOME" | "EXPENSE",
): Promise<ActionResult<Awaited<ReturnType<typeof categoryService.listCategories>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return categoryService.listCategories(type);
  });
}

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof categoryService.createCategory>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createCategorySchema.parse(input);
    return categoryService.createCategory(parsed);
  });
}

export async function updateCategoryAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof categoryService.updateCategory>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateCategorySchema.parse(input);
    return categoryService.updateCategory(parsed);
  });
}

export async function deleteCategoryAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return categoryService.deleteCategory(id);
  });
}
