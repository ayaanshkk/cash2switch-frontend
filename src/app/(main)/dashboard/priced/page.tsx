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
  voa_reference: string;        
  billing_authority?: string;   
  case_opened_date?: string;
  appeal_deadline?: string;     
  case_stage?: string;          
  stage_name: string;
  stage_id: number;
  current_rv?: number;
  proposed_rv?: number;
  projected_saving?: number;    
  created_at: string;
  source_type?: string;
}

const Priced = () => {
  const [cases, setCases] = useState<PricedItem[]>([]);
  const [ratedCases, setRatedCases] = useState<PricedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'cases' | 'rated'>('all');

  useEffect(() => { fetchPricedItems(); }, []);

  const fetchPricedItems = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/api/crm/priced');
      if (data.success) {
        setCases(data.cases || []);
        setRatedCases(data.rated_cases || []);
      } else {
        toast.error(data.error || 'Failed to fetch priced cases');
      }
    } catch (error) {
      console.error('Error fetching priced items:', error);
      toast.error('Failed to fetch priced cases');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Move a priced case back to the Check stage (first CCA stage).
   * Both case types use Opportunity_Details, so the same PATCH endpoint works.
   */
  const moveBackToCheck = async (item: PricedItem) => {
    if (!confirm(`Move "${item.business_name}" back to Check stage?`)) return;

    try {
      // Find the Check stage
      const stagesResp = await fetchWithAuth('/api/crm/stages');
      const checkStage = stagesResp.data?.find(
        (s: any) => s.stage_name.toLowerCase() === 'check'
      );

      if (!checkStage) {
        toast.error('Check stage not found');
        return;
      }

      const updateResp = await fetchWithAuth(
        `/api/crm/leads/${item.opportunity_id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: checkStage.stage_id, status: 'check' }),
        }
      );

      if (updateResp.success !== false) {
        toast.success('Case moved back to Check stage');
        fetchPricedItems();
      } else {
        toast.error(updateResp.error || 'Failed to move case');
      }
    } catch (error) {
      console.error('Error moving case:', error);
      toast.error('Failed to move case');
    }
  };

  const getFilteredItems = (): PricedItem[] => {
    let items: PricedItem[] =
      activeTab === 'cases' ? cases
      : activeTab === 'rated' ? ratedCases
      : [...cases, ...ratedCases];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item =>
        item.business_name?.toLowerCase().includes(term) ||
        item.contact_person?.toLowerCase().includes(term) ||
        item.tel_number?.includes(term) ||
        item.email?.toLowerCase().includes(term) ||
        item.voa_reference?.toLowerCase().includes(term)
      );
    }
    return items;
  };

  const filteredItems  = getFilteredItems();
  const totalCases     = cases.length;
  const totalRated     = ratedCases.length;
  const total          = totalCases + totalRated;

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatRV = (rv?: number) => {
    if (!rv) return '—';
    return `£${rv.toLocaleString()}`;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '—';
    return phone.replace(/\.0$/, '');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Savings Assessed</h1>
        <p className="text-gray-600 mt-1">
          Cases where rateable value savings have been calculated and presented to the client
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Assessed</div>
          <div className="text-3xl font-bold text-blue-600">{total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">New Cases</div>
          <div className="text-3xl font-bold text-green-600">{totalCases}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Re-assessed Cases</div>
          <div className="text-3xl font-bold text-purple-600">{totalRated}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-2">
        {[
          { key: 'all',   label: `All (${total})` },
          { key: 'cases', label: `New Cases (${totalCases})` },
          { key: 'rated', label: `Re-assessed (${totalRated})` },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by business name, VOA reference, phone, email..."
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-xl mb-2">No assessed cases found</div>
            <p className="text-gray-500">Cases marked as "Priced" will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VOA Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Authority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current RV</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projected Saving</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item, index) => (
                  <tr key={`${item.source_type}-${item.opportunity_id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>

                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.business_name || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.contact_person || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {item.voa_reference || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.billing_authority || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatRV(item.current_rv)}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-green-700">
                      {formatRV(item.projected_saving)}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatPhone(item.tel_number)}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.email || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        item.source_type === 'rated_case'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.source_type === 'rated_case' ? 'Re-assessed' : 'New Case'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => moveBackToCheck(item)}
                        className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                      >
                        Move to Check
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