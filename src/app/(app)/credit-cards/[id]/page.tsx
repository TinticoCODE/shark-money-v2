import { CreditCardDetailView } from "@/features/credit-cards/credit-card-detail-view";

interface CreditCardDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreditCardDetailPage({ params }: CreditCardDetailPageProps) {
  const { id } = await params;
  return <CreditCardDetailView cardId={id} />;
}
