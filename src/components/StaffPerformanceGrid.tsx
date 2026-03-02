"use client";

import { useState, useEffect } from "react";
import { User, ChevronDown, Phone, Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface StaffMember {
  employee_id: number;
  employee_name: string;
  role_name?: string;
  email?: string;
}

interface CustomerContact {
  client_id: number;
  business_name: string;
  contact_person: string;
  phone: string;
  contact_date: string;
  notes: string;
  status: string;
  supplier: string;
  contract_end_date: string;
  annual_usage: number;
  estimated_revenue: number;
}

interface SalespersonPerformance {
  employee_id: number;
  employee_name: string;
  total_contacts: number;
  converted_count: number;
  total_value_touched: number;
  conversion_rate: number;
  customers_contacted: CustomerContact[];
}

interface PerformanceData {
  period: string;
  period_label: string;
  start_date: string;
  end_date: string;
  performance: SalespersonPerformance[];
}

interface StaffPerformanceGridProps {
  employeeId?: number; // For salesperson view (only see their own data)
}

export function StaffPerformanceGrid({ employeeId }: StaffPerformanceGridProps) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState<SalespersonPerformance[]>([]);
  const [monthlyPerformance, setMonthlyPerformance] = useState<SalespersonPerformance[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [expandedSalespeople, setExpandedSalespeople] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (employeeId) {
      // Salesperson view - fetch only their performance
      fetchAllPerformance();
    } else {
      // Admin view - fetch all staff first
      fetchStaffMembers();
    }
  }, [employeeId]);

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
        const employees = Array.isArray(data) ? data : (data.data || []);
        
        // Show ALL employees except Platform Admin
        const salespeople = employees.filter((emp: any) => {
          const roleName = emp.role_name?.toLowerCase() || '';
          const isPlatformAdmin = roleName.includes('platform') && roleName.includes('admin');
          return !isPlatformAdmin;
        });
        
        setStaff(salespeople);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPerformance = async () => {
    setPerformanceLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const employeeParam = employeeId ? `&employee_id=${employeeId}` : '';

      // Fetch weekly performance
      const weeklyRes = await fetch(
        `${API_BASE_URL}/energy-renewals/salesperson-performance?period=week${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (weeklyRes.ok) {
        const weeklyData: PerformanceData = await weeklyRes.json();
        setWeeklyPerformance(weeklyData.performance || []);
      }

      // Fetch monthly performance
      const monthlyRes = await fetch(
        `${API_BASE_URL}/energy-renewals/salesperson-performance?period=month${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (monthlyRes.ok) {
        const monthlyData: PerformanceData = await monthlyRes.json();
        setMonthlyPerformance(monthlyData.performance || []);
      }

      setShowDialog(true);
    } catch (error) {
      console.error("Error fetching performance:", error);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const handleStaffClick = (member: StaffMember) => {
    console.log('🖱️ Clicked on:', member.employee_name, member.employee_id);
    fetchAllPerformance();
  };

  const toggleSalesperson = (employeeId: number) => {
    const newExpanded = new Set(expandedSalespeople);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedSalespeople(newExpanded);
  };

  const renderPerformanceData = (performance: SalespersonPerformance[]) => {
    if (performanceLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (performance.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No activity in this period
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {performance.map((sales) => (
          <Collapsible
            key={sales.employee_id}
            open={expandedSalespeople.has(sales.employee_id)}
            onOpenChange={() => toggleSalesperson(sales.employee_id)}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-lg">{sales.employee_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {sales.total_contacts} contacts · {sales.conversion_rate}% conversion
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          £{(sales.total_value_touched / 1000).toFixed(1)}K
                        </p>
                        <p className="text-sm text-green-600">
                          {sales.converted_count} converted
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          expandedSalespeople.has(sales.employee_id) ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Customer Contacts ({sales.customers_contacted.length})
                    </h4>
                    
                    {sales.customers_contacted.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No customer contacts in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sales.customers_contacted.map((contact) => (
                          <div
                            key={contact.client_id}
                            className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/dashboard/renewals/${contact.client_id}`)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h5 className="font-semibold truncate">
                                    {contact.business_name}
                                  </h5>
                                  <Badge variant="outline" className="flex-shrink-0">
                                    {contact.status || 'Pending'}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-2">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {contact.contact_person}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Contacted: {new Date(contact.contact_date).toLocaleDateString()}
                                  </div>
                                  {contact.contract_end_date && (
                                    <div className="flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      Expires: {new Date(contact.contract_end_date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>

                                {contact.notes && (
                                  <p className="text-sm text-muted-foreground italic mt-2 line-clamp-2">
                                    "{contact.notes}"
                                  </p>
                                )}

                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Supplier: {contact.supplier}</span>
                                  {contact.annual_usage && (
                                    <span>AQ: {contact.annual_usage.toLocaleString()} kWh</span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                                  <DollarSign className="h-4 w-4" />
                                  £{contact.estimated_revenue.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Est. Revenue
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    );
  };

  // If salesperson view (employeeId provided), show performance directly
  if (employeeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Your individual renewal performance and customer contacts
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="month" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
            
            <TabsContent value="week">
              {renderPerformanceData(weeklyPerformance)}
            </TabsContent>
            
            <TabsContent value="month">
              {renderPerformanceData(monthlyPerformance)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Admin view - show staff grid
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
                onClick={() => handleStaffClick(member)}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Detail Dialog - Admin View */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team Performance - Detailed Breakdown</DialogTitle>
            <DialogDescription>
              View weekly and monthly performance metrics for all team members
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="month" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
            
            <TabsContent value="week">
              {renderPerformanceData(weeklyPerformance)}
            </TabsContent>
            
            <TabsContent value="month">
              {renderPerformanceData(monthlyPerformance)}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}