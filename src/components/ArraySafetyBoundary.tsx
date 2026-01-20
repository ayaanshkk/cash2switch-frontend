"use client";

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary to catch array-related errors throughout the app
 * This prevents the entire app from crashing when .map() or .filter() fails
 */
export class ArraySafetyBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's an array-related error
    const isArrayError = 
      error.message?.includes('is not a function') ||
      error.message?.includes('.map') ||
      error.message?.includes('.filter') ||
      error.message?.includes('.reduce');

    if (isArrayError) {
      console.error('🚨 Array Safety Error:', error);
      return { hasError: true, error };
    }

    // Re-throw other errors
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Array error details:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center p-4">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="mb-2 text-xl font-semibold text-red-800">
              Loading Error
            </h2>
            <p className="mb-4 text-sm text-red-600">
              There was an issue loading this page. This usually happens when the server is starting up or temporarily unavailable.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}