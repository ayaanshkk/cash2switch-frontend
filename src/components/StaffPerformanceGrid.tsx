"use client";

import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface StaffMember {
  employee_id: number;
  employee_name: string;
  role_name?: string;
  email?: string;
}

interface StaffPerformance {
  employee_id: number;
  employee_name: string;
  renewed_count: number;
  contacted_count: number;
  not_contacted_count: number;
  lost_count: number;
  total_revenue: number;
  total_aq: number;
}

export function StaffPerformanceGrid() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffPerformance | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  const fetchStaffMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Employees response:", data); // Debug
        
        // ✅ Handle both data structures
        const employees = Array.isArray(data) ? data : (data.data || []);
        
        console.log("👥 All employees:", employees); // Debug
        
        // ✅ Show ALL employees except Platform Admin
        const salespeople = employees.filter((emp: any) => {
          const roleName = emp.role_name?.toLowerCase() || '';
          console.log(`Employee: ${emp.employee_name}, Role: ${roleName}`); // Debug
          
          // Exclude only Platform Admin
          const isPlatformAdmin = roleName.includes('platform') && roleName.includes('admin');
          return !isPlatformAdmin;
        });
        
        console.log("✅ Filtered salespeople:", salespeople); // Debug
        setStaff(salespeople);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffPerformance = async (employeeId: number, employeeName: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      
      const response = await fetch(
        `${API_BASE_URL}/energy-renewals/stats?employee_id=${employeeId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedStaff({
          employee_id: employeeId,
          employee_name: employeeName,
          renewed_count: data.renewed_count || 0,
          contacted_count: data.contacted_count || 0,
          not_contacted_count: data.not_contacted_count || 0,
          lost_count: data.lost_count || 0,
          total_revenue: data.total_revenue_at_risk || 0,
          total_aq: data.total_aq || 0,
        });
        setShowDialog(true);
      }
    } catch (error) {
      console.error("Error fetching staff performance:", error);
    }
  };

  const calculateSuccessRate = (perf: StaffPerformance | null) => {
    if (!perf) return "0";
    const total = perf.renewed_count + perf.lost_count + perf.contacted_count + perf.not_contacted_count;
    if (total === 0) return "0";
    return ((perf.renewed_count / total) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click on any team member to view their individual renewal performance
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {staff.map((member) => (
              <button
                key={member.employee_id}
                onClick={() => {
									console.log('🖱️ Clicked on:', member.employee_name, member.employee_id);
									fetchStaffPerformance(member.employee_id, member.employee_name);
								}}
                className="p-4 border rounded-lg hover:shadow-lg transition-all hover:border-primary bg-white hover:bg-gray-50 text-center group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-medium text-sm truncate w-full" title={member.employee_name}>
                    {member.employee_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {member.role_name || 'Staff'}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {staff.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No staff members found</p>
              <p className="text-xs mt-2">Check browser console for debug info</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Detail Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedStaff?.employee_name}'s Renewal Performance
            </DialogTitle>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-6">
              {/* Performance Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg bg-green-50">
                  <div className="text-3xl font-bold text-green-700">
                    {selectedStaff.renewed_count}
                  </div>
                  <div className="text-sm text-green-600 mt-1">Renewed</div>
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mt-2" />
                </div>

                <div className="text-center p-4 border rounded-lg bg-blue-50">
                  <div className="text-3xl font-bold text-blue-700">
                    {selectedStaff.contacted_count}
                  </div>
                  <div className="text-sm text-blue-600 mt-1">In Progress</div>
                  <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mt-2" />
                </div>

                <div className="text-center p-4 border rounded-lg bg-orange-50">
                  <div className="text-3xl font-bold text-orange-700">
                    {selectedStaff.not_contacted_count}
                  </div>
                  <div className="text-sm text-orange-600 mt-1">Not Contacted</div>
                  <AlertTriangle className="h-5 w-5 text-orange-600 mx-auto mt-2" />
                </div>

                <div className="text-center p-4 border rounded-lg bg-red-50">
                  <div className="text-3xl font-bold text-red-700">
                    {selectedStaff.lost_count}
                  </div>
                  <div className="text-sm text-red-600 mt-1">Lost</div>
                  <TrendingDown className="h-5 w-5 text-red-600 mx-auto mt-2" />
                </div>
              </div>

              {/* Success Rate */}
              <div className="bg-gray-50 rounded-lg p-4 text-center border">
                <div className="text-sm text-muted-foreground mb-1">
                  Renewal Success Rate
                </div>
                <div className="text-4xl font-bold text-foreground">
                  {calculateSuccessRate(selectedStaff)}%
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="text-sm text-purple-600 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-purple-900">
                    £{((selectedStaff.total_revenue || 0) / 1000).toFixed(0)}K
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <div className="text-sm text-indigo-600 mb-1">Total AQ</div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {((selectedStaff.total_aq || 0) / 1000).toFixed(0)}K kWh
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}