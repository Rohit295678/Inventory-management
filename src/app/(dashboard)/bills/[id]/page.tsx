"use client";
import { useParams, useRouter } from "next/navigation";
import { TX_COPY } from "@/lib/domain";
import { BillDetail } from "@/components/bills/BillDetail";

// A bill in full, opened in its own tab from the Sales/Purchases list.
// (The sidebar is still here for getting around.)
export default function BillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto">
      <BillDetail id={id} mode="page" onDeleted={(bill) => router.replace(TX_COPY[bill.type].href)} />
    </div>
  );
}
