'use client';

import { Input } from '@/components/ui/input';
import type { QueryFieldMetadata } from '@/lib/query/field-metadata';

type QueryFieldPickerProps = {
  value: string;
  onChange: (value: string) => void;
  fields: QueryFieldMetadata[];
  placeholder: string;
  label: string;
  disabled?: boolean;
  onExactMatch?: (field: QueryFieldMetadata | undefined) => void;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function QueryFieldPicker({
  value,
  onChange,
  fields,
  placeholder,
  label,
  disabled,
  onExactMatch,
}: QueryFieldPickerProps) {
  const listId = `query-field-${slugify(label)}`;
  const uniqueFields = Array.from(
    new Map(fields.map((field) => [field.key, field])).values(),
  );

  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
          onExactMatch?.(uniqueFields.find((field) => field.key === nextValue));
        }}
        placeholder={placeholder}
        list={listId}
        aria-label={label}
        disabled={disabled}
      />
      <datalist id={listId}>
        {uniqueFields.map((field) => (
          <option key={field.key} value={field.key}>
            {field.valueType}
          </option>
        ))}
      </datalist>
      {uniqueFields.length > 0 ? (
        <p className="text-xs text-[#7A7A7A]">
          Suggested fields:{' '}
          {uniqueFields
            .slice(0, 6)
            .map((field) => field.key)
            .join(', ')}
          {uniqueFields.length > 6 ? '…' : ''}
        </p>
      ) : null}
    </div>
  );
}
