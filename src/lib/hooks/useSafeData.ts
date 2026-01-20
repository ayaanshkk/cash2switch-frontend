import { useState, useEffect } from 'react';

/**
 * Custom hook for safely fetching data that should be an array
 * Guarantees that the returned data is always an array, never undefined or an object
 */
export function useSafeArrayData<T>(
  fetchFn: () => Promise<T[]>,
  deps: any[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchFn();
        
        if (mounted) {
          // ✅ SAFETY: Ensure result is always an array
          setData(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch data'));
          setData([]); // ✅ Set empty array on error
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, deps);

  return { data, loading, error };
}

/**
 * Ensures a value is an array
 * @param value - Any value that might or might not be an array
 * @returns An array (either the original if it was an array, or an empty array)
 */
export function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  // If it's an object with a common data property, try to extract it
  if (typeof value === 'object') {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.customers)) return value.customers;
    if (Array.isArray(value.jobs)) return value.jobs;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.results)) return value.results;
  }
  return [];
}

/**
 * Safely map over data that might not be an array
 * @param data - Data that should be an array
 * @param mapFn - Mapping function
 * @returns Mapped array or empty array
 */
export function safeMap<T, R>(data: any, mapFn: (item: T, index: number) => R): R[] {
  const arr = ensureArray<T>(data);
  return arr.map(mapFn);
}

/**
 * Safely filter data that might not be an array
 * @param data - Data that should be an array
 * @param filterFn - Filter function
 * @returns Filtered array or empty array
 */
export function safeFilter<T>(data: any, filterFn: (item: T) => boolean): T[] {
  const arr = ensureArray<T>(data);
  return arr.filter(filterFn);
}