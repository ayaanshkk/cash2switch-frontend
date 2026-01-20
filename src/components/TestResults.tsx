"use client";

import React from 'react';
import { RotateCcw, CheckCircle, XCircle } from 'lucide-react';

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

interface TestResultsProps {
  result: GradingResult;
  onReset: () => void;
}

const TestResults: React.FC<TestResultsProps> = ({ result, onReset }) => {
  const getAnswerBadgeStyle = (answer: string) => {
    const baseStyle = {
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '600' as const,
      display: 'inline-block',
    };

    const answerLower = answer.toLowerCase();
    if (answerLower === 'true') {
      return { ...baseStyle, backgroundColor: '#d1fae5', color: '#065f46' };
    } else if (answerLower === 'false') {
      return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
    } else if (answerLower.includes('know')) {
      return { ...baseStyle, backgroundColor: '#fef3c7', color: '#92400e' };
    } else if (answerLower === 'blank') {
      return { ...baseStyle, backgroundColor: '#f1f5f9', color: '#64748b' };
    } else {
      return { ...baseStyle, backgroundColor: '#ddd6fe', color: '#5b21b6' };
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '2px solid #e5e7eb',
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: '600' }}>
          📊 Grading Results - {result.mhe_type}
        </h1>
        <button
          onClick={onReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          <RotateCcw size={16} />
          Grade Another Test
        </button>
      </div>

      {/* Info Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            Participant
          </div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>
            {result.participant_name}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            Company
          </div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>{result.company}</div>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            MHE Type
          </div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>{result.mhe_type}</div>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            Marks
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
            {result.total_marks_obtained} / {result.total_marks}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            Percentage
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
            {result.percentage}%
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            Grade
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: result.grade === 'Pass' ? '#10b981' : '#ef4444',
            }}
          >
            {result.grade}
          </div>
        </div>
      </div>

      {/* Score Bar */}
      <div
        style={{
          height: '32px',
          backgroundColor: '#e5e7eb',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${result.percentage}%`,
            backgroundColor:
              result.percentage >= 70
                ? '#10b981'
                : result.percentage >= 50
                ? '#f59e0b'
                : '#ef4444',
            transition: 'width 1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '12px',
            color: 'white',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          {result.percentage}%
        </div>
      </div>

      {/* Detailed Answer Review */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Detailed Answer Review ({result.total_marks} Questions - 1 Mark Each)
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                  Q#
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                  Student Answer
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                  Correct Answer
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                  Remark
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                  Marks
                </th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((detail, index) => (
                <tr
                  key={detail.question_number}
                  style={{
                    backgroundColor: detail.is_correct ? '#f0fdf4' : '#fef2f2',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <td style={{ padding: '12px' }}>{detail.question_number}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={getAnswerBadgeStyle(detail.student_answer)}>
                      {detail.student_answer}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={getAnswerBadgeStyle(detail.correct_answer)}>
                      {detail.correct_answer}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        backgroundColor: detail.is_correct ? '#10b981' : '#ef4444',
                        color: 'white',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {detail.is_correct ? (
                        <CheckCircle size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {detail.remark}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: '16px',
                    }}
                  >
                    {detail.marks_obtained}/1
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                style={{
                  backgroundColor: '#f9fafb',
                  borderTop: '2px solid #e5e7eb',
                  fontWeight: '700',
                }}
              >
                <td colSpan={4} style={{ padding: '16px' }}>
                  Total
                </td>
                <td style={{ padding: '16px', textAlign: 'center', fontSize: '18px' }}>
                  {result.total_marks_obtained}/{result.total_marks}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TestResults;