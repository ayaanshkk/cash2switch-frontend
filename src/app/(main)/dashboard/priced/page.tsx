'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface PricedLead {
  opportunity_id: number;
  client_id: number;
  business_name: string;
  contact_person: string;
  tel_number: string;
  email: string;
  mpan_mpr: string;
  supplier: string;
  start_date: string;
  end_date: string;
  stage_name: string;
  stage_id: number;
  opportunity_value: number;
  assigned_to_name: string;
  created_at: string;
}

interface PricedStats {
  total_priced: number;
  total_value: number;
  by_employee: {
    [key: string]: {
      count: number;
      total_value: number;
    };
  };
}

const Priced = () => {
  const [leads, setLeads] = useState<PricedLead[]>([]);
  const [stats, setStats] = useState<PricedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  const tenantId = localStorage.getItem('tenant_id') || '1';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchPricedLeads();
    fetchStats();
  }, []);

  const fetchPricedLeads = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${BACKEND_URL}/api/crm/priced`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setLeads(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch priced leads');
      }
    } catch (error) {
      console.error('Error fetching priced leads:', error);
      toast.error('Failed to fetch priced leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/crm/priced/stats`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const moveToLeads = async (opportunityId: number) => {
    if (!confirm('Move this lead back to Leads page?')) {
      return;
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/crm/priced/${opportunityId}/move-to-leads`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success('Lead moved back to Leads page');
        fetchPricedLeads();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to move lead');
      }
    } catch (error) {
      console.error('Error moving lead:', error);
      toast.error('Failed to move lead');
    }
  };

  const handleSelectLead = (opportunityId: number) => {
    setSelectedLeads(prev => 
      prev.includes(opportunityId)
        ? prev.filter(id => id !== opportunityId)
        : [...prev, opportunityId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.opportunity_id));
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.tel_number?.includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Priced Leads</h1>
        <p className="text-gray-600 mt-1">
          Customers who have received price quotes
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Priced Leads</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.total_priced}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Value</div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(stats.total_value)}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Average Value</div>
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(stats.total_value / stats.total_priced)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={fetchPricedLeads}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-xl mb-2">No priced leads found</div>
            <p className="text-gray-500">
              Leads with "Priced" status will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === filteredLeads.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.opportunity_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.opportunity_id)}
                        onChange={() => handleSelectLead(lead.opportunity_id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.opportunity_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {lead.business_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.contact_person}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.tel_number || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.email || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatCurrency(lead.opportunity_value)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => moveToLeads(lead.opportunity_id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Move to Leads
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Actions */}
      {selectedLeads.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedLeads([])}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Priced;
