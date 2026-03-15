'use client';

import { useRouter } from 'next/navigation';
import { UserAttributeForm } from '@/components/forms/UserAttributeForm';

interface UserProfileDetailClientProps {
  apiKey: string;
  userId: string;
  defaultAttributes: Record<string, unknown>;
}

export function UserProfileDetailClient({
  apiKey,
  userId,
  defaultAttributes,
}: UserProfileDetailClientProps) {
  const router = useRouter();

  return (
    <UserAttributeForm
      apiKey={apiKey}
      userId={userId}
      defaultAttributes={defaultAttributes}
      onSuccess={() => router.refresh()}
    />
  );
}
