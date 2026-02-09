'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/api';

interface PricedItem {
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
  source_type?: string;
}

const Priced = () => {
  const [leads, setLeads] = useState<PricedItem[]>([]);
  const [renewals, setRenewals] = useState<PricedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'leads' | 'renewals'>('all');

  useEffect(() => {
    fetchPricedItems();
  }, []);

  const fetchPricedItems = async () => {
    try {
      setLoading(true);
      
      const data = await fetchWithAuth('/api/crm/priced');
      
      if (data.success) {
        setLeads(data.leads || []);
        setRenewals(data.renewals || []);
      } else {
        toast.error(data.error || 'Failed to fetch priced items');
      }
    } catch (error) {
      console.error('Error fetching priced items:', error);
      toast.error('Failed to fetch priced items');
    } finally {
      setLoading(false);
    }
  };

  const moveToLeads = async (item: PricedItem) => {
    const isRenewal = item.source_type === 'renewal';
    const confirmMessage = isRenewal 
      ? 'Move this renewal back to Renewals page?'
      : 'Move this lead back to Leads page?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      if (isRenewal) {
        // Update Client_Master's Opportunity status back to 'called'
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/energy-clients/${item.client_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ status: 'called' })
          }
        );

        const data = await response.json();
        
        if (data.success) {
          toast.success('Renewal moved back to Renewals page');
          fetchPricedItems();
        } else {
          toast.error(data.error || 'Failed to move renewal');
        }
      } else {
        // Update Opportunity_Details stage back to 'Called'
        const calledStageResponse = await fetchWithAuth('/api/crm/stages');
        const calledStage = calledStageResponse.data?.find(
          (s: any) => s.stage_name.toLowerCase() === 'called'
        );
        
        if (!calledStage) {
          toast.error('Called stage not found');
          return;
        }

        const updateResponse = await fetchWithAuth(
          `/api/crm/leads/${item.opportunity_id}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ stage_id: calledStage.stage_id })
          }
        );
        
        if (updateResponse.success) {
          toast.success('Lead moved back to Leads page');
          fetchPricedItems();
        } else {
          toast.error(updateResponse.error || 'Failed to move lead');
        }
      }
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error('Failed to move item');
    }
  };

  const getFilteredItems = (): PricedItem[] => {
    let items: PricedItem[] = [];
    
    if (activeTab === 'all') {
      items = [...leads, ...renewals];
    } else if (activeTab === 'leads') {
      items = leads;
    } else {
      items = renewals;
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.business_name?.toLowerCase().includes(term) ||
        item.contact_person?.toLowerCase().includes(term) ||
        item.tel_number?.includes(term) ||
        item.email?.toLowerCase().includes(term)
      );
    }
    
    return items;
  };

  const filteredItems = getFilteredItems();
  const totalLeads = leads.length;
  const totalRenewals = renewals.length;
  const total = totalLeads + totalRenewals;

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // ✅ Format phone number - remove .0 decimal
  const formatPhone = (phone: string) => {
    if (!phone) return '—';
    // Remove .0 at the end if it exists
    return phone.replace(/\.0$/, '');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Priced</h1>
        <p className="text-gray-600 mt-1">
          Customers who have received price quotes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Priced</div>
          <div className="text-3xl font-bold text-blue-600">{total}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Leads</div>
          <div className="text-3xl font-bold text-green-600">{totalLeads}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Renewals</div>
          <div className="text-3xl font-bold text-purple-600">{totalRenewals}</div>
        </div>
      </div>

      {/* Tabs - ✅ Changed to black */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            activeTab === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({total})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            activeTab === 'leads'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Leads ({totalLeads})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('renewals')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            activeTab === 'renewals'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Renewals ({totalRenewals})
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={fetchPricedItems}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table - ✅ Restructured columns */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-xl mb-2">No priced items found</div>
            <p className="text-gray-500">
              Items with "Priced" status will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MPAN Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item, index) => (
                  <tr key={`${item.source_type}-${item.opportunity_id}`} className="hover:bg-gray-50">
                    {/* ✅ ID - Chronological numbering */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {index + 1}
                    </td>
                    
                    {/* ✅ Name (Contact Person) */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.contact_person || '—'}
                    </td>
                    
                    {/* ✅ Business Name */}
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.business_name}
                    </td>
                    
                    {/* ✅ MPAN Number - Only show for renewals */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.source_type === 'renewal' ? (item.mpan_mpr || '—') : '—'}
                    </td>
                    
                    {/* ✅ Phone - Removed .0 decimal */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatPhone(item.tel_number)}
                    </td>
                    
                    {/* ✅ Email ID */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.email || '—'}
                    </td>
                    
                    {/* ✅ Assigned To */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.assigned_to_name || 'Unassigned'}
                    </td>
                    
                    {/* ✅ Date */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                    
                    {/* ✅ Type */}
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        item.source_type === 'renewal' 
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.source_type === 'renewal' ? 'Renewal' : 'Lead'}
                      </span>
                    </td>
                    
                    {/* ✅ Actions */}
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => moveToLeads(item)}
                        className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                      >
                        Move Back
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Priced;