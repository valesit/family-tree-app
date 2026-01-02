import { redirect } from 'next/navigation';

export default function FamilyIdRedirectPage({ params }: { params: { familyId: string } }) {
  // Keep backwards compatibility for old /tree/[familyId] links, but render the unified Tree UI.
  redirect(`/tree?rootId=${encodeURIComponent(params.familyId)}`);
}

