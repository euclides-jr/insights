import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[#0A0A0A]">
            {label}
          </label>
        )}
        <textarea
          className={`
            flex min-h-[80px] w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 text-sm
            placeholder:text-[#A3A3A3]
            focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] focus:ring-offset-0
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500' : ''}
            ${className || ''}
          `}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
