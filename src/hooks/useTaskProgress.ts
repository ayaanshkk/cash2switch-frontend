// hooks/useTaskProgress.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api';

export interface TaskProgress {
  state: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'ERROR';
  status: string;
  progress: number;
  successful?: number;
  errors?: number;
  current_batch?: number;
  total_batches?: number;
  result?: any;
  error?: string;
}

export function useTaskProgress(
  taskId: string | null,
  onComplete?: (result: any) => void,
  onError?: (error: string) => void
) {
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  const pollTaskStatus = useCallback(async () => {
    if (!taskId || completedRef.current) return;

    try {
      const response = await fetchWithAuth(`/api/task-status/${taskId}`);
      setTaskProgress(response);

      if (response.state === 'SUCCESS') {
        completedRef.current = true;
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (onComplete) {
          onComplete(response.result);
        }
      } else if (response.state === 'FAILURE' || response.state === 'ERROR') {
        completedRef.current = true;
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (onError) {
          onError(response.error || 'Task failed');
        }
      }
    } catch (error) {
      console.error('Error polling task status:', error);
    }
  }, [taskId, onComplete, onError]);

  const startPolling = useCallback(() => {
    if (!taskId || isPolling) return;

    completedRef.current = false;
    setIsPolling(true);

    pollTaskStatus();
    intervalRef.current = setInterval(pollTaskStatus, 1500);
  }, [taskId, isPolling, pollTaskStatus]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (taskId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [taskId]);

  return {
    taskProgress,
    isPolling,
    startPolling,
    stopPolling,
    pollTaskStatus,
  };
}