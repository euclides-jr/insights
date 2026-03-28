"use client";

interface AIExplanationProps {
  explanation: string | null;
  recoverySuggestions?: string[];
}

export function AIExplanation({
  explanation,
  recoverySuggestions = [],
}: AIExplanationProps) {
  if (!explanation && recoverySuggestions.length === 0) return null;

  return (
    <div className="border border-[#E8E8E8] bg-[#FAFAFA] px-6 py-4">
      {explanation && (
        <>
          <p className="text-sm font-medium text-[#0D0D0D] mb-2">AI Summary</p>
          <p className="text-sm text-[#3D3D3D] leading-relaxed">
            {explanation}
          </p>
        </>
      )}
      {recoverySuggestions.length > 0 && (
        <div className={explanation ? "mt-4" : undefined}>
          <p className="text-sm font-medium text-[#0D0D0D] mb-2">
            Suggested Next Steps
          </p>
          <ul className="space-y-2">
            {recoverySuggestions.map((suggestion) => (
              <li key={suggestion} className="text-sm text-[#3D3D3D]">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
