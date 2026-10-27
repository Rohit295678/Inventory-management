import { PaymentsView } from "@/components/payments/PaymentsView";

// Money I paid suppliers, against purchase bills.
export default function PaymentsMadePage() {
  return <PaymentsView type="PURCHASE" />;
}
