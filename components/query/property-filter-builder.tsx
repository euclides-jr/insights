'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryFieldPicker } from '@/components/query/query-field-picker';
import { selectChevronStyle, selectInputClass } from '@/components/ui/select';
import type { QueryFieldMetadata } from '@/lib/query/field-metadata';
import type { PropertyFilter } from '@/lib/validations/query-schemas';

type EditablePropertyFilter = Omit<PropertyFilter, 'value'> & {
  id: string;
  value?: string | number | boolean | string[] | number[];
  secondValue?: number;
};

type PropertyFilterBuilderProps = {
  filters: EditablePropertyFilter[];
  availableFields: QueryFieldMetadata[];
  onChange: (filters: EditablePropertyFilter[]) => void;
};

const OPERATOR_OPTIONS = {
  string: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'in', label: 'in list' },
    { value: 'not_in', label: 'not in list' },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'between', label: 'between' },
    { value: 'in', label: 'in list' },
    { value: 'not_in', label: 'not in list' },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
  boolean: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
} as const;

function nextOperatorForType(valueType: EditablePropertyFilter['valueType']) {
  return OPERATOR_OPTIONS[valueType][0].value as EditablePropertyFilter['operator'];
}

function makeEmptyFilter(index: number): EditablePropertyFilter {
  return {
    id: `filter_${Date.now()}_${index}`,
    key: '',
    valueType: 'string',
    operator: 'eq',
    value: '',
    ...(index > 0 ? { logic: 'and' as const } : {}),
  };
}

export function PropertyFilterBuilder({
  filters,
  availableFields,
  onChange,
}: PropertyFilterBuilderProps) {
  const updateFilter = (
    id: string,
    patch: Partial<EditablePropertyFilter>,
  ) => {
    onChange(filters.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const addFilter = () => {
    onChange([...filters, makeEmptyFilter(filters.length)]);
  };

  const removeFilter = (id: string) => {
    const next = filters.filter((filter) => filter.id !== id);
    onChange(
      next.map((filter, index) => ({
        ...filter,
        ...(index === 0 ? { logic: undefined } : { logic: filter.logic ?? 'and' }),
      })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
            Property Filters
          </h3>
          <p className="mt-1 text-xs text-[#7A7A7A]">
            Narrow event results by schema or JSON property values.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={addFilter}
          className="h-9"
        >
          + Add Filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <div className="border border-dashed border-[#E8E8E8] bg-[#FAFAFA] px-4 py-6 text-sm text-[#7A7A7A]">
          No property filters yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => {
            const operatorOptions = OPERATOR_OPTIONS[filter.valueType];
            const isExistsOperator =
              filter.operator === 'exists' || filter.operator === 'not_exists';
            const isBetweenOperator = filter.operator === 'between';
            const isListOperator =
              filter.operator === 'in' || filter.operator === 'not_in';

            return (
              <div
                key={filter.id}
                className="grid grid-cols-[84px_140px_140px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3"
              >
                <div className="flex items-center text-xs font-medium uppercase tracking-[0.16em] text-[#7A7A7A]">
                  {index === 0 ? 'Where' : (
                    <select
                      aria-label={`Logic for property filter ${index + 1}`}
                      value={filter.logic ?? 'and'}
                      onChange={(event) =>
                        updateFilter(filter.id, {
                          logic: event.target.value as 'and' | 'or',
                        })
                      }
                      className={`${selectInputClass} h-10 rounded-none py-1 pr-8 text-xs uppercase tracking-[0.14em]`}
                      style={selectChevronStyle}
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  )}
                </div>

                <QueryFieldPicker
                  value={filter.key}
                  onChange={(value) => updateFilter(filter.id, { key: value })}
                  placeholder="property key"
                  label={`Property key ${index + 1}`}
                  fields={availableFields}
                  onExactMatch={(field) => {
                    if (!field || field.valueType === 'unknown') return;

                    updateFilter(filter.id, {
                      valueType: field.valueType,
                      operator: nextOperatorForType(field.valueType),
                      value: field.valueType === 'boolean' ? true : '',
                      secondValue: undefined,
                    });
                  }}
                />

                <select
                  aria-label={`Property type ${index + 1}`}
                  value={filter.valueType}
                  onChange={(event) =>
                    updateFilter(filter.id, {
                      valueType: event.target.value as EditablePropertyFilter['valueType'],
                      operator: nextOperatorForType(
                        event.target.value as EditablePropertyFilter['valueType'],
                      ),
                      value:
                        event.target.value === 'boolean'
                          ? true
                          : '',
                      secondValue: undefined,
                    })
                  }
                  className={selectInputClass}
                  style={selectChevronStyle}
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>

                <select
                  aria-label={`Operator ${index + 1}`}
                  value={filter.operator}
                  onChange={(event) =>
                    updateFilter(filter.id, {
                      operator: event.target.value as EditablePropertyFilter['operator'],
                      secondValue: undefined,
                    })
                  }
                  className={selectInputClass}
                  style={selectChevronStyle}
                >
                  {operatorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {isExistsOperator ? (
                  <div className="flex items-center rounded-md border border-dashed border-[#E8E8E8] px-3 text-sm text-[#7A7A7A]">
                    No value needed
                  </div>
                ) : filter.valueType === 'boolean' ? (
                  <select
                    aria-label={`Value ${index + 1}`}
                    value={String(filter.value ?? true)}
                    onChange={(event) =>
                      updateFilter(filter.id, {
                        value: event.target.value === 'true',
                      })
                    }
                    className={selectInputClass}
                    style={selectChevronStyle}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <Input
                      value={String(filter.value ?? '')}
                      onChange={(event) =>
                        updateFilter(filter.id, {
                          value: event.target.value,
                        })
                      }
                      placeholder={
                        isListOperator
                          ? 'comma,separated,values'
                          : filter.valueType === 'number'
                            ? '100'
                            : 'USD'
                      }
                      aria-label={`Value ${index + 1}`}
                    />
                    {isBetweenOperator ? (
                      <Input
                        value={String(filter.secondValue ?? '')}
                        onChange={(event) =>
                          updateFilter(filter.id, {
                            secondValue:
                              event.target.value === ''
                                ? undefined
                                : Number(event.target.value),
                          })
                        }
                        placeholder="and"
                        aria-label={`Upper bound ${index + 1}`}
                      />
                    ) : (
                      <div />
                    )}
                  </div>
                )}

                <button
                  type="button"
                  aria-label={`Remove property filter ${index + 1}`}
                  onClick={() => removeFilter(filter.id)}
                  className="flex h-10 items-center justify-center border border-[#E8E8E8] text-[#7A7A7A] transition-colors hover:bg-[#FAFAFA] hover:text-[#0D0D0D]"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
