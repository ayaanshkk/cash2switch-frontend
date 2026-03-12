// src/hooks/useCustomerSync.ts
import { useEffect } from 'react';

export function useCustomerSync(onSync: () => void) {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customer_updated') {
        onSync();
        localStorage.removeItem('customer_updated');
      }
    };

    const handleCustomEvent = () => {
      onSync();
    };

    // Listen for storage events (cross-tab)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom events (same-tab)
    window.addEventListener('customer_sync', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customer_sync', handleCustomEvent);
    };
  }, [onSync]);
}

export function triggerCustomerSync() {
  // Set localStorage to trigger storage event in other tabs
  localStorage.setItem('customer_updated', Date.now().toString());
  
  // Dispatch custom event for same-tab sync
  window.dispatchEvent(new Event('customer_sync'));
  
  // Clean up
  setTimeout(() => {
    localStorage.removeItem('customer_updated');
  }, 100);
}