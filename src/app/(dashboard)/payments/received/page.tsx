import { PaymentsView } from "@/components/payments/PaymentsView";

// Money customers paid me, against sale bills.
export default function PaymentsReceivedPage() {
  return <PaymentsView type="SALE" />;
}
