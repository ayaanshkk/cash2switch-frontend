'use client';

import { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/api';
import { Check, X, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PricedLead {
  opportunity_id: number;
  client_id: number;  
  id: number;  
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  mpan_mpr: string;
  supplier_name: string;
  start_date: string;
  end_date: string;
  stage_id: number;
  assigned_to_name: string;
  assigned_to_id: number;
  created_at: string;
  annual_usage?: number;
}

interface PricedStats {
  total_priced: number;
  total_aq: number;
}

interface Employee {
  employee_id: number;
  employee_name: string;
}

const Priced = () => {
  const [leads, setLeads] = useState<PricedLead[]>([]);
  const [allLeads, setAllLeads] = useState<PricedLead[]>([]);
  const [stats, setStats] = useState<PricedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | 'all'>('all');
  
  const { user } = useAuth();
  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  useEffect(() => {
    fetchEmployees();
    fetchPricedLeads();
  }, []);

  useEffect(() => {
    // Filter leads when employee selection changes
    if (selectedEmployee === 'all') {
      setLeads(allLeads);
    } else {
      setLeads(allLeads.filter(lead => lead.assigned_to_id === selectedEmployee));
    }
  }, [selectedEmployee, allLeads]);

  useEffect(() => {
    // Calculate stats whenever leads change
    const totalPriced = leads.length;
    const totalAQ = leads.reduce((sum: number, lead: any) => 
      sum + (lead.annual_usage || 0), 0
    );
    
    setStats({
      total_priced: totalPriced,
      total_aq: totalAQ
    });
  }, [leads]);

  const fetchEmployees = async () => {
    try {
      const response = await fetchWithAuth('/employees');
      const employeesList = Array.isArray(response.data) ? response.data : 
                           Array.isArray(response) ? response : [];
      setEmployees(employeesList);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchPricedLeads = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching priced leads...');
      
      // ✅ Use dedicated endpoint
      const response = await fetchWithAuth('/energy-clients/priced?service=utilities');
      const pricedLeads = Array.isArray(response) ? response : (response?.data || []);
      
      console.log('✅ Fetched priced leads:', pricedLeads.length);
      console.log('✅ First lead:', pricedLeads[0]);
      
      setAllLeads(pricedLeads);
      setLeads(pricedLeads);
      
    } catch (error) {
      console.error('❌ Error fetching priced leads:', error);
      toast.error('Failed to fetch priced leads');
    } finally {
      setLoading(false);
    }
  };

  const moveToRenewals = async (lead: PricedLead) => {
    if (!confirm('Move this lead back to Renewals?')) {
      return;
    }

    try {
      // ✅ CRITICAL: Use the actual database client_id
      const actualClientId = lead.client_id;
      
      console.log('🔄 Moving to renewals:', {
        displayId: lead.id,
        actualClientId: actualClientId,
        businessName: lead.business_name
      });

      // ✅ Update Misc_Col1 to null to move back to renewals
      await fetchWithAuth(`/energy-clients/${actualClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: null,  // Clear the "priced" status
          stage_id: 1    // Back to first stage
        }),
      });

      toast.success('✅ Lead moved back to Renewals');
      
      // Refresh the list
      fetchPricedLeads();
      
    } catch (error) {
      console.error('❌ Error moving lead:', error);
      toast.error('❌ Failed to move lead');
    }
  };

  const moveToRecycleBin = async (lead: PricedLead) => {
    if (!confirm('Move this lead to Recycle Bin?')) {
      return;
    }

    try {
      // ✅ CRITICAL: Use the actual database client_id
      const actualClientId = lead.client_id;
      
      console.log('🗑️ Moving to recycle bin:', {
        displayId: lead.id,
        actualClientId: actualClientId,
        businessName: lead.business_name
      });

      // ✅ Update status to "lost"
      await fetchWithAuth(`/energy-clients/${actualClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'lost',
          stage_id: 6  // Lost stage ID
        }),
      });

      toast.success('🗑️ Lead moved to Recycle Bin');
      
      // Refresh the list
      fetchPricedLeads();
      
    } catch (error) {
      console.error('❌ Error moving lead:', error);
      toast.error('❌ Failed to move lead');
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
      lead.phone?.includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black">Priced Leads</h1>
        <p className="text-gray-600 mt-1">
          Customers who have received price quotes
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Priced Leads</div>
            <div className="text-3xl font-bold text-black">
              {stats.total_priced}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total AQ (kWh)</div>
            <div className="text-3xl font-bold text-black">
              {stats.total_aq.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Salesperson Tabs (Admin Only) */}
      {isAdmin && employees.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-black" />
            <span className="text-sm font-medium text-black">Filter by Salesperson</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedEmployee('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedEmployee === 'all'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-black hover:bg-gray-200'
              }`}
            >
              All Salespeople
            </button>
            {employees.map((emp) => (
              <button
                key={emp.employee_id}
                onClick={() => setSelectedEmployee(emp.employee_id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedEmployee === emp.employee_id
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-black hover:bg-gray-200'
                }`}
              >
                {emp.employee_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
            />
          </div>
          
          <button
            onClick={fetchPricedLeads}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
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
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Contact Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Annual Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-black uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.client_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.opportunity_id)}
                        onChange={() => handleSelectLead(lead.opportunity_id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {lead.id || lead.client_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-black">
                      {lead.business_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {lead.contact_person}
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {lead.phone || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {lead.email || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {lead.annual_usage ? `${lead.annual_usage.toLocaleString()} kWh` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {lead.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        {/* ✅ Tick Button - Move to Renewals - FIXED: Pass entire lead object */}
                        <button
                          onClick={() => moveToRenewals(lead)}
                          className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                          title="Move to Renewals"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        
                        {/* ❌ Cross Button - Move to Recycle Bin - FIXED: Pass entire lead object */}
                        <button
                          onClick={() => moveToRecycleBin(lead)}
                          className="p-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors"
                          title="Move to Recycle Bin"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
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
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-4 border-2 border-black">
          <div className="flex items-center gap-4">
            <span className="text-sm text-black font-medium">
              {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedLeads([])}
              className="px-4 py-2 text-sm text-black hover:bg-gray-100 rounded"
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