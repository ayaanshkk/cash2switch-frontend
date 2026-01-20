"use client";

import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

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

interface TestReviewProps {
  extractedData: ExtractedData;
  onSubmit: (correctedAnswers: Record<string, string>) => void;
  onCancel: () => void;
  loading: boolean;
}

const TestReview: React.FC<TestReviewProps> = ({
  extractedData,
  onSubmit,
  onCancel,
  loading,
}) => {
  const [editedAnswers, setEditedAnswers] = useState<Record<string, string>>(
    extractedData.answers
  );

  const handleAnswerChange = (questionKey: string, value: string) => {
    setEditedAnswers((prev) => ({ ...prev, [questionKey]: value }));
  };

  const getQuestionNumbers = () => {
    return Object.keys(extractedData.answers).sort((a, b) => {
      const aNum = parseInt(a.replace(/[^0-9]/g, ''));
      const bNum = parseInt(b.replace(/[^0-9]/g, ''));
      if (aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '16px',
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
          📝 Review & Correct AI Extraction
        </h1>
        <p style={{ color: '#6b7280' }}>
          Check the extracted answers and correct any mistakes before grading
        </p>
      </div>

      {/* Two Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
        }}
      >
        {/* Left Panel - Image */}
        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Original Test Paper
          </h3>
          <img
            src={`data:image/jpeg;base64,${extractedData.image_base64}`}
            alt="Test paper"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '800px',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

        {/* Right Panel - Info & Answers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Student Information */}
          <div
            style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
              Student Information
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
              }}
            >
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Name: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {extractedData.participant_name || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Company: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {extractedData.company || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>MHE Type: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {extractedData.mhe_type}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Test Type: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {extractedData.test_type}
                </span>
              </div>
            </div>
          </div>

          {/* Answers Section */}
          <div
            style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '20px',
              flex: 1,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
              Extracted Answers - Click to Edit
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '12px',
                maxHeight: '500px',
                overflowY: 'auto',
                padding: '4px',
              }}
            >
              {getQuestionNumbers().map((questionKey) => (
                <div key={questionKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500' }}>
                    Q{questionKey}:
                  </label>
                  <select
                    value={editedAnswers[questionKey] || ''}
                    onChange={(e) => handleAnswerChange(questionKey, e.target.value)}
                    style={{
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value="TRUE">TRUE</option>
                    <option value="FALSE">FALSE</option>
                    <option value="Don't Know">Don't Know</option>
                    <option value="BLANK">BLANK</option>
                    {questionKey === '20' && extractedData.mhe_type === 'FORKLIFT' && (
                      <option value="BALANCE">BALANCE</option>
                    )}
                  </select>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '24px',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <button
                onClick={() => onSubmit(editedAnswers)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: loading ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#10b981';
                }}
              >
                <Check size={16} />
                {loading ? 'Grading...' : 'Submit & Grade Test'}
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
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
        </div>
      </div>
    </div>
  );
};

export default TestReview;