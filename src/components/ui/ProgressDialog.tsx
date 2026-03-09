// components/ui/ProgressDialog.tsx
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  progress: number;
  status: string;
  state: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'ERROR';
  successful?: number;
  errors?: number;
  currentBatch?: number;
  totalBatches?: number;
  result?: any;
  error?: string;
  onComplete?: () => void;
}

export function ProgressDialog({
  open,
  onOpenChange,
  title,
  progress,
  status,
  state,
  successful = 0,
  errors = 0,
  currentBatch,
  totalBatches,
  result,
  error,
  onComplete,
}: ProgressDialogProps) {
  const getIcon = () => {
    switch (state) {
      case 'PENDING':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />;
      case 'PROGRESS':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />;
      case 'SUCCESS':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'FAILURE':
      case 'ERROR':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <AlertCircle className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case 'SUCCESS':
        return 'text-green-700';
      case 'FAILURE':
      case 'ERROR':
        return 'text-red-700';
      default:
        return 'text-blue-700';
    }
  };

  const canClose = state === 'SUCCESS' || state === 'FAILURE' || state === 'ERROR';

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => !canClose && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-center">{getIcon()}</div>

          <div className={`text-center font-medium ${getStatusColor()}`}>
            {status}
          </div>

          {state === 'PROGRESS' && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress}%</span>
                {currentBatch && totalBatches && (
                  <span>
                    Batch {currentBatch}/{totalBatches}
                  </span>
                )}
              </div>
            </div>
          )}

          {(state === 'PROGRESS' || state === 'SUCCESS') && (successful > 0 || errors > 0) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-green-600 font-semibold">{successful}</div>
                <div className="text-gray-600">Successful</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-red-600 font-semibold">{errors}</div>
                <div className="text-gray-600">Errors</div>
              </div>
            </div>
          )}

          {state === 'SUCCESS' && result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <div className="font-medium text-green-800 mb-2">✅ Import Complete</div>
              <div className="space-y-1 text-gray-700">
                <div>• Total: {result.total || result.successful} records</div>
                <div>• Successful: {result.successful}</div>
                {result.failed > 0 && <div>• Failed: {result.failed}</div>}
                {result.assigned_to && (
                  <div>• Assigned to: {result.assigned_to}</div>
                )}
              </div>
            </div>
          )}

          {state === 'FAILURE' && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              <div className="font-medium text-red-800 mb-2">❌ Task Failed</div>
              <div className="text-red-700">{error}</div>
            </div>
          )}

          {canClose && (
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  if (onComplete) onComplete();
                }}
                variant={state === 'SUCCESS' ? 'default' : 'outline'}
              >
                {state === 'SUCCESS' ? 'Done' : 'Close'}
              </Button>
            </div>
          )}

          {!canClose && (
            <div className="text-xs text-center text-gray-500">
              Please wait... Do not close this window.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}