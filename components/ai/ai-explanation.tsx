'use client';

interface AIExplanationProps {
  explanation: string | null;
}

export function AIExplanation({ explanation }: AIExplanationProps) {
  if (!explanation) return null;

  return (
    <div className="border border-[#E8E8E8] bg-[#FAFAFA] px-6 py-4">
      <p className="text-sm font-medium text-[#0D0D0D] mb-2">AI Summary</p>
      <p className="text-sm text-[#3D3D3D] leading-relaxed">{explanation}</p>
    </div>
  );
}
