"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCategoryAction,
  deleteCategoryAction,
  listCategoriesAction,
  updateCategoryAction,
} from "@/actions/categories.actions";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  isSystem: boolean;
};

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterType, setFilterType] = useState<"" | "INCOME" | "EXPENSE">("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formType, setFormType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [isPending, startTransition] = useTransition();

  const loadCategories = useCallback(() => {
    startTransition(async () => {
      const result = await listCategoriesAction(filterType || undefined);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCategories(result.data as Category[]);
    });
  }, [filterType]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function openCreate(type: "INCOME" | "EXPENSE") {
    setEditing(null);
    setFormType(type);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setFormType(category.type);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const name = String(formData.get("name") ?? "");

      if (editing) {
        const result = await updateCategoryAction({ id: editing.id, name });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Categoría actualizada");
      } else {
        const result = await createCategoryAction({ name, type: formType });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Categoría creada");
      }

      setDialogOpen(false);
      loadCategories();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Categoría eliminada");
      loadCategories();
    });
  }

  return (
    <AppShell currentPath="/categories">
      <PageHeader
        title="Categorías"
        description="Personaliza categorías de ingresos y gastos."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" variant="outline" onClick={() => openCreate("INCOME")}>
              Ingreso
            </Button>
            <Button size="sm" onClick={() => openCreate("EXPENSE")}>
              Gasto
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(["", "EXPENSE", "INCOME"] as const).map((type) => (
          <Button
            key={type || "all"}
            size="sm"
            variant={filterType === type ? "default" : "outline"}
            onClick={() => setFilterType(type)}
          >
            {type === "" ? "Todas" : type === "EXPENSE" ? "Gastos" : "Ingresos"}
          </Button>
        ))}
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="Sin categorías"
          description="Crea categorías personalizadas además de las del sistema."
          action={<Button onClick={() => openCreate("EXPENSE")}>Crear categoría</Button>}
        />
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{category.name}</p>
                    <Badge variant={category.type === "INCOME" ? "success" : "secondary"}>
                      {category.type === "INCOME" ? "Ingreso" : "Gasto"}
                    </Badge>
                    {category.isSystem ? <Badge variant="warning">Sistema</Badge> : null}
                  </div>
                </div>
                {!category.isSystem ? (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id)}>
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar categoría" : `Nueva categoría de ${formType === "INCOME" ? "ingreso" : "gasto"}`}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
