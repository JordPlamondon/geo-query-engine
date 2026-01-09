import type { FilterOperator } from '../core/types.js';

export type FilterFn = (fieldValue: unknown, filterValue: unknown) => boolean;

export const filterOperators: Record<FilterOperator, FilterFn> = {
  equals: (fieldValue, filterValue) => fieldValue === filterValue,

  notEquals: (fieldValue, filterValue) => fieldValue !== filterValue,

  greaterThan: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue > filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue > filterValue;
    }
    return false;
  },

  greaterThanOrEqual: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue >= filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue >= filterValue;
    }
    return false;
  },

  lessThan: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue < filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue < filterValue;
    }
    return false;
  },

  lessThanOrEqual: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue <= filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue <= filterValue;
    }
    return false;
  },

  includes: (fieldValue, filterValue) => {
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(filterValue);
    }
    return false;
  },

  includesAll: (fieldValue, filterValue) => {
    if (Array.isArray(fieldValue) && Array.isArray(filterValue)) {
      return filterValue.every((v) => fieldValue.includes(v));
    }
    return false;
  },

  includesAny: (fieldValue, filterValue) => {
    if (Array.isArray(fieldValue) && Array.isArray(filterValue)) {
      return filterValue.some((v) => fieldValue.includes(v));
    }
    return false;
  },

  startsWith: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue.startsWith(filterValue);
    }
    return false;
  },

  endsWith: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue.endsWith(filterValue);
    }
    return false;
  },

  contains: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue.includes(filterValue);
    }
    return false;
  },

  between: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && Array.isArray(filterValue) && filterValue.length === 2) {
      const [min, max] = filterValue as [number, number];
      return fieldValue >= min && fieldValue <= max;
    }
    return false;
  },

  in: (fieldValue, filterValue) => {
    if (Array.isArray(filterValue)) {
      return filterValue.includes(fieldValue);
    }
    return false;
  },

  notIn: (fieldValue, filterValue) => {
    if (Array.isArray(filterValue)) {
      return !filterValue.includes(fieldValue);
    }
    return false;
  },
};

export function evaluateFilter<T>(
  item: T,
  field: keyof T,
  operator: FilterOperator,
  value: unknown
): boolean {
  const fieldValue = item[field];
  const filterFn = filterOperators[operator];
  return filterFn(fieldValue, value);
}
