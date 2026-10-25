import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions/TransactionsView";

export default function SalesPage() {
  return (
    <Suspense>
      <TransactionsView type="SALE" />
    </Suspense>
  );
}
