import { AccountDetailView } from "@/features/accounts/account-detail-view";

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;
  return <AccountDetailView accountId={id} />;
}
