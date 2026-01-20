"use client";

import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import axios from 'axios';
import TestReview from '@/components/TestReview';
import TestResults from '@/components/TestResults';

interface QuestionDetail {
  question_number: string | number;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  remark: string;
  marks_obtained: number;
}

interface GradingResult {
  id?: number;
  participant_name: string;
  company: string;
  date: string;
  place: string;
  test_type: string;
  mhe_type: string;
  answers: Record<string, string>;
  total_marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  details: QuestionDetail[];
  created_at?: string;
}

interface ExtractedData {
  mhe_type: string;
  participant_name: string;
  company: string;
  date: string;
  place: string;
  test_type: string;
  total_questions: number;
  answers: Record<string, string>;
  image_base64: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const TestGradingPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Manual review states
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showReview, setShowReview] = useState(false);

  // ✅ FIXED: Get token from localStorage on mount - checking auth_token
  useEffect(() => {
    const storedToken = 
      localStorage.getItem('auth_token') ||     // ✅ Check auth_token first (your app uses this)
      localStorage.getItem('token') ||
      localStorage.getItem('access_token');
    
    if (storedToken) {
      setToken(storedToken);
      console.log('✅ Token found');
    } else {
      console.error('❌ No token found');
    }
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setShowReview(false);
      setExtractedData(null);
    }
  };

  const handleExtractAnswers = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    if (!token) {
      setError('Authentication required. Please login.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post<ExtractedData>(
        `${API_URL}/api/test-grading/extract-answers`,
        formData,
        { 
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          } 
        }
      );

      setExtractedData(response.data);
      setShowReview(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error extracting answers');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitGrading = async (correctedAnswers: Record<string, string>) => {
    if (!extractedData || !token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<GradingResult>(
        `${API_URL}/api/test-grading/grade-with-corrections`,
        {
          extracted_data: extractedData,
          corrected_answers: correctedAnswers
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      setResult(response.data);
      setShowReview(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error grading test');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setShowReview(false);
    setExtractedData(null);
  };

  // Show review screen
  if (showReview && extractedData) {
    return (
      <TestReview
        extractedData={extractedData}
        onSubmit={handleSubmitGrading}
        onCancel={handleReset}
        loading={loading}
      />
    );
  }

  // Show results screen
  if (result) {
    return (
      <TestResults
        result={result}
        onReset={handleReset}
      />
    );
  }

  // Upload screen
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
          Test Paper Grading
        </h1>
        <p style={{ color: '#6b7280' }}>
          Upload test papers for AI-powered grading and result generation
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={20} color="#dc2626" />
          <span style={{ color: '#991b1b', fontSize: '14px' }}>{error}</span>
        </div>
      )}

      {/* Upload Box */}
      {!previewUrl && (
        <div
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s',
            backgroundColor: '#f9fafb',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.backgroundColor = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.backgroundColor = '#f9fafb';
          }}
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            id="file-input"
            style={{ display: 'none' }}
          />
          <label
            htmlFor="file-input"
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <Upload size={48} color="#3b82f6" />
            <div>
              <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                Click to upload or drag and drop
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Supported: JPG, PNG, PDF (Max 10MB)
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Preview Section */}
      {previewUrl && selectedFile && (
        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Preview
          </h3>

          {selectedFile.type === 'application/pdf' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                gap: '12px',
              }}
            >
              <FileText size={64} color="#6b7280" />
              <p style={{ fontSize: '16px', fontWeight: '500' }}>PDF Document</p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{selectedFile.name}</p>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Test paper preview"
              style={{
                maxWidth: '100%',
                maxHeight: '500px',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
              }}
            />
          )}

          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={handleExtractAnswers}
              disabled={loading}
              style={{
                padding: '10px 24px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              {loading ? 'Extracting...' : 'Extract & Review Answers'}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 24px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestGradingPage;