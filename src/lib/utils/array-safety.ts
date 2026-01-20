import React from 'react';

/**
 * Global Array Safety Utilities
 * Import these anywhere you need to safely work with arrays
 * 
 * Usage:
 * import { safe } from '@/lib/utils/array-safety';
 * 
 * safe.map(maybeArray, item => <div key={item.id}>{item.name}</div>)
 * safe.filter(maybeArray, item => item.active)
 */

/**
 * Ensures a value is an array
 */
function toArray<T>(value: any): T[] {
  // Already an array
  if (Array.isArray(value)) return value;
  
  // Null or undefined
  if (value == null) return [];
  
  // Object with common array properties
  if (typeof value === 'object') {
    // Try common property names
    const arrayProps = ['data', 'items', 'results', 'customers', 'jobs', 'users', 'list'];
    for (const prop of arrayProps) {
      if (Array.isArray(value[prop])) {
        return value[prop];
      }
    }
  }
  
  // Single item - wrap in array
  return [value];
}

/**
 * Safe array operations that never throw
 */
export const safe = {
  /**
   * Safely map over any value
   */
  map: <T, R>(value: any, fn: (item: T, index: number, array: T[]) => R): R[] => {
    const arr = toArray<T>(value);
    try {
      return arr.map(fn);
    } catch (error) {
      console.error('Error in safe.map:', error);
      return [];
    }
  },

  /**
   * Safely filter any value
   */
  filter: <T>(value: any, fn: (item: T, index: number, array: T[]) => boolean): T[] => {
    const arr = toArray<T>(value);
    try {
      return arr.filter(fn);
    } catch (error) {
      console.error('Error in safe.filter:', error);
      return [];
    }
  },

  /**
   * Safely find in any value
   */
  find: <T>(value: any, fn: (item: T) => boolean): T | undefined => {
    const arr = toArray<T>(value);
    try {
      return arr.find(fn);
    } catch (error) {
      console.error('Error in safe.find:', error);
      return undefined;
    }
  },

  /**
   * Safely reduce any value
   */
  reduce: <T, R>(value: any, fn: (acc: R, item: T) => R, initial: R): R => {
    const arr = toArray<T>(value);
    try {
      return arr.reduce(fn, initial);
    } catch (error) {
      console.error('Error in safe.reduce:', error);
      return initial;
    }
  },

  /**
   * Safely get length of any value
   */
  length: (value: any): number => {
    const arr = toArray(value);
    return arr.length;
  },

  /**
   * Safely slice any value
   */
  slice: <T>(value: any, start?: number, end?: number): T[] => {
    const arr = toArray<T>(value);
    try {
      return arr.slice(start, end);
    } catch (error) {
      console.error('Error in safe.slice:', error);
      return [];
    }
  },

  /**
   * Ensure value is an array (alias for toArray)
   */
  array: toArray,
};

/**
 * Higher-order component to wrap components that expect array props
 */
export function withArraySafety<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  arrayProps: (keyof T)[]
): React.ComponentType<T> {
  const SafeComponent = (props: T) => {
    const safeProps = { ...props };
    arrayProps.forEach(prop => {
      if (prop in safeProps) {
        safeProps[prop] = toArray(safeProps[prop]) as any;
      }
    });
    return React.createElement(Component, safeProps);
  };
  return SafeComponent;
}

export { toArray as ensureArray };