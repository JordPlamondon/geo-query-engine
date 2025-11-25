import type { FilterOperator } from '../core/types.js';

/**
 * Type for filter function that evaluates a condition
 */
export type FilterFn = (fieldValue: unknown, filterValue: unknown) => boolean;

/**
 * Registry of filter operator implementations
 */
export const filterOperators: Record<FilterOperator, FilterFn> = {
  /**
   * Exact equality check
   */
  equals: (fieldValue, filterValue) => fieldValue === filterValue,

  /**
   * Inequality check
   */
  notEquals: (fieldValue, filterValue) => fieldValue !== filterValue,

  /**
   * Greater than comparison (for numbers/strings)
   */
  greaterThan: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue > filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue > filterValue;
    }
    return false;
  },

  /**
   * Greater than or equal comparison
   */
  greaterThanOrEqual: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue >= filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue >= filterValue;
    }
    return false;
  },

  /**
   * Less than comparison
   */
  lessThan: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue < filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue < filterValue;
    }
    return false;
  },

  /**
   * Less than or equal comparison
   */
  lessThanOrEqual: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
      return fieldValue <= filterValue;
    }
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue <= filterValue;
    }
    return false;
  },

  /**
   * Array includes single value
   */
  includes: (fieldValue, filterValue) => {
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(filterValue);
    }
    return false;
  },

  /**
   * Array includes all values (AND logic)
   */
  includesAll: (fieldValue, filterValue) => {
    if (Array.isArray(fieldValue) && Array.isArray(filterValue)) {
      return filterValue.every((v) => fieldValue.includes(v));
    }
    return false;
  },

  /**
   * Array includes any value (OR logic)
   */
  includesAny: (fieldValue, filterValue) => {
    if (Array.isArray(fieldValue) && Array.isArray(filterValue)) {
      return filterValue.some((v) => fieldValue.includes(v));
    }
    return false;
  },

  /**
   * String starts with prefix
   */
  startsWith: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue.startsWith(filterValue);
    }
    return false;
  },

  /**
   * String ends with suffix
   */
  endsWith: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue.endsWith(filterValue);
    }
    return false;
  },

  /**
   * String contains substring
   */
  contains: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
      return fieldValue.includes(filterValue);
    }
    return false;
  },

  /**
   * Value is between two bounds (inclusive)
   */
  between: (fieldValue, filterValue) => {
    if (typeof fieldValue === 'number' && Array.isArray(filterValue) && filterValue.length === 2) {
      const [min, max] = filterValue as [number, number];
      return fieldValue >= min && fieldValue <= max;
    }
    return false;
  },

  /**
   * Value is in array of allowed values
   */
  in: (fieldValue, filterValue) => {
    if (Array.isArray(filterValue)) {
      return filterValue.includes(fieldValue);
    }
    return false;
  },

  /**
   * Value is not in array of disallowed values
   */
  notIn: (fieldValue, filterValue) => {
    if (Array.isArray(filterValue)) {
      return !filterValue.includes(fieldValue);
    }
    return false;
  },
};

/**
 * Evaluates a filter condition against an item
 *
 * @param item - The item to evaluate
 * @param field - The field name to check
 * @param operator - The filter operator to use
 * @param value - The value to compare against
 * @returns True if the item passes the filter
 */
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
