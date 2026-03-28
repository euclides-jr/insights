export const AI_ERROR_MESSAGES: Record<string, string> = {
  no_schemas:
    "No active event schemas found for this application. Add event schemas before using AI analytics.",
  generation_failed:
    "I couldn't generate a valid query for that question. Try rephrasing or being more specific.",
  clarification_required:
    "I couldn't confidently resolve the requested time range. Try making the date window more explicit.",
  rate_limited:
    "The AI service is busy right now. Please try again in a moment.",
  validation_error:
    "The request was invalid. Please check your inputs and try again.",
  internal_error: "Something went wrong. Please try again.",
};

export function getAIErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) return AI_ERROR_MESSAGES.internal_error;
  return AI_ERROR_MESSAGES[errorCode] ?? AI_ERROR_MESSAGES.internal_error;
}
