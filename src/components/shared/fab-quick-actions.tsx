"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FabQuickActionsProps {
  onIncome: () => void;
  onExpense: () => void;
  onPayCreditCard: () => void;
}

export function FabQuickActions({
  onIncome,
  onExpense,
  onPayCreditCard,
}: FabQuickActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-3 z-40 flex flex-col items-end gap-3 sm:bottom-20 sm:right-4">
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
            >
              <Button
                className="shadow-lg"
                onClick={() => {
                  setOpen(false);
                  onIncome();
                }}
              >
                <TrendingUp className="h-4 w-4" />
                Registrar ingreso
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ delay: 0.03 }}
            >
              <Button
                variant="secondary"
                className="shadow-lg"
                onClick={() => {
                  setOpen(false);
                  onExpense();
                }}
              >
                <TrendingDown className="h-4 w-4" />
                Registrar gasto
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ delay: 0.06 }}
            >
              <Button
                variant="outline"
                className="shadow-lg bg-background"
                onClick={() => {
                  setOpen(false);
                  onPayCreditCard();
                }}
              >
                <CreditCard className="h-4 w-4" />
                Pagar tarjeta
              </Button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl"
        aria-label="Acciones rápidas"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }}>
          <Plus className="h-6 w-6" />
        </motion.span>
      </motion.button>
    </div>
  );
}
