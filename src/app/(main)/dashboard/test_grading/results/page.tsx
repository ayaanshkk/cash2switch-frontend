"use client";

import React, { useState, useEffect } from 'react';
import { Eye, Trash2, Search, FileText } from 'lucide-react';
import axios from 'axios';
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
  id: number;
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
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const ResultsHistoryPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [results, setResults] = useState<GradingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResult, setSelectedResult] = useState<GradingResult | null>(null);

  // ✅ FIXED: Get token from localStorage on mount - checking auth_token
  useEffect(() => {
    const storedToken = 
      localStorage.getItem('auth_token') ||     // ✅ Check auth_token first (your app uses this)
      localStorage.getItem('token') ||
      localStorage.getItem('access_token');
    
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchResults();
    }
  }, [token]);

  const fetchResults = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await axios.get<GradingResult[]>(
        `${API_URL}/api/test-grading/results`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this result?')) return;

    if (!token) return;

    try {
      await axios.delete(`${API_URL}/api/test-grading/results/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setResults(results.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete result');
    }
  };

  const filteredResults = results.filter(
    (result) =>
      result.participant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.mhe_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedResult) {
    return (
      <TestResults
        result={selectedResult}
        onReset={() => setSelectedResult(null)}
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
          Test Results History
        </h1>
        <p style={{ color: '#6b7280' }}>
          View and manage all graded test results
        </p>
      </div>

      {/* Search Bar */}
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={20}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
            }}
          />
          <input
            type="text"
            placeholder="Search by name, company, or MHE type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          Loading results...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredResults.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
          }}
        >
          <FileText size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '8px' }}>
            No results found
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            {searchTerm
              ? 'Try adjusting your search'
              : 'Grade your first test to see results here'}
          </p>
        </div>
      )}

      {/* Results Table */}
      {!loading && !error && filteredResults.length > 0 && (
        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb',
                  }}
                >
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Participant
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Company
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    MHE Type
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Score
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Percentage
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Grade
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((result) => (
                  <tr
                    key={result.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      {result.participant_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      {result.company}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#eff6ff',
                          color: '#1e40af',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                      >
                        {result.mhe_type}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        textAlign: 'center',
                        fontWeight: '600',
                      }}
                    >
                      {result.total_marks_obtained}/{result.total_marks}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        textAlign: 'center',
                        fontWeight: '600',
                      }}
                    >
                      {result.percentage}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor:
                            result.grade === 'Pass' ? '#d1fae5' : '#fee2e2',
                          color: result.grade === 'Pass' ? '#065f46' : '#991b1b',
                        }}
                      >
                        {result.grade}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        textAlign: 'center',
                        color: '#6b7280',
                      }}
                    >
                      {new Date(result.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setSelectedResult(result)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#2563eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#3b82f6';
                          }}
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(result.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef4444';
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsHistoryPage;