import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions/TransactionsView";

export default function PurchasesPage() {
  return (
    <Suspense>
      <TransactionsView type="PURCHASE" />
    </Suspense>
  );
}
