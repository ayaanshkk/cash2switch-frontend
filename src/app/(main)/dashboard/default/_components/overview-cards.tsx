"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  XAxis,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";

import {
  leadsChartConfig,
  salesPipelineChartConfig,
} from "./crm.config";

interface PipelineItem {
  id: string;
  type: "customer" | "job" | "project";
  customer: {
    id: string;
    created_at: string;
    stage: string;
    name: string;
  };
  stage: string;
}

interface ActionItem {
  id: string;
  customer_name: string;
  customer_id: string;
  stage: string;
  priority: "High" | "Medium" | "Low";
  created_at: string;
  completed: boolean;
}

export function OverviewCards() {
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [leadsChartData, setLeadsChartData] = useState<any[]>([]);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  
  const [loadingPipeline, setLoadingPipeline] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get user role ONCE
  useEffect(() => {
    const role = localStorage.getItem("user_role");
    console.log("👤 User role:", role);
    setUserRole(role);
  }, []);

  // Fetch pipeline data (New Leads + Sales Pipeline)
  useEffect(() => {
    const fetchPipelineData = async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoadingPipeline(true);
        }
        console.log("🔄 Fetching pipeline data...");
        
        const pipelineRes = await fetchWithAuth("pipeline");
        
        if (!pipelineRes.ok) {
          throw new Error(`Pipeline API error: ${pipelineRes.status}`);
        }
        
        const pipelineItems: PipelineItem[] = await pipelineRes.json();
        console.log("✅ Pipeline data loaded:", pipelineItems.length, "items");

        // Process New Leads
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const periods = [
          { label: "26-30", daysAgoStart: 26, daysAgoEnd: 30 },
          { label: "21-25", daysAgoStart: 21, daysAgoEnd: 25 },
          { label: "16-20", daysAgoStart: 16, daysAgoEnd: 20 },
          { label: "11-15", daysAgoStart: 11, daysAgoEnd: 15 },
          { label: "6-10", daysAgoStart: 6, daysAgoEnd: 10 },
          { label: "1-5", daysAgoStart: 1, daysAgoEnd: 5 },
        ];

        const today = new Date();
        const chartData = periods.map(period => {
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - period.daysAgoEnd);
          startDate.setHours(0, 0, 0, 0);
          
          const endDate = new Date(today);
          endDate.setDate(today.getDate() - period.daysAgoStart);
          endDate.setHours(23, 59, 59, 999);

          const periodCustomers = pipelineItems.filter(item => {
            if (item.type !== 'customer' || !item.customer.created_at) return false;
            const createdDate = new Date(item.customer.created_at);
            return createdDate >= startDate && createdDate <= endDate;
          });

          return {
            date: period.label,
            newLeads: periodCustomers.filter(c => c.customer.stage !== 'Rejected').length,
            disqualified: periodCustomers.filter(c => c.customer.stage === 'Rejected').length,
          };
        });

        setLeadsChartData(chartData);

        const recentCustomers = pipelineItems.filter((item) => {
          if (item.type !== "customer" || !item.customer.created_at) return false;
          return new Date(item.customer.created_at) >= thirtyDaysAgo;
        });
        
        setNewLeadsCount(recentCustomers.filter(c => c.customer.stage !== 'Rejected').length);

        // Process Pipeline
        const stageCounts: Record<string, number> = {
          Lead: 0, Quote: 0, Accepted: 0, Production: 0, Complete: 0,
        };

        pipelineItems.forEach((item) => {
          const stage = item.stage || 'Lead';
          if (stage in stageCounts) {
            stageCounts[stage]++;
          }
        });

        setPipelineData([
          { stage: "Lead", value: stageCounts['Lead'], fill: "var(--color-lead)" },
          { stage: "Quote", value: stageCounts['Quote'], fill: "var(--color-quote)" },
          { stage: "Accepted", value: stageCounts['Accepted'], fill: "var(--color-accepted)" },
          { stage: "Production", value: stageCounts['Production'], fill: "var(--color-production)" },
          { stage: "Complete", value: stageCounts['Complete'], fill: "var(--color-complete)" },
        ]);

        console.log("✅ Pipeline processing complete");
        
      } catch (error) {
        console.error("❌ Error fetching pipeline data:", error);
      } finally {
        if (showLoading) {
          setLoadingPipeline(false);
        }
      }
    };

    // Initial load with spinner
    fetchPipelineData(true);
    
    // Background refresh every 60 seconds WITHOUT spinner
    const interval = setInterval(() => fetchPipelineData(false), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Action Items SEPARATELY + Create for existing Accepted customers
  useEffect(() => {
    const fetchActionItems = async (showLoading = true) => {
      if (!["Manager", "HR", "Production"].includes(userRole || "")) {
        setLoadingActions(false);
        return;
      }

      try {
        if (showLoading) {
          setLoadingActions(true);
        }
        console.log("🔄 Fetching action items...");
        
        const actionsRes = await fetchWithAuth("action-items");
        
        if (actionsRes.ok) {
          const actionsData: ActionItem[] = await actionsRes.json();
          console.log("✅ Action items loaded:", actionsData);
          setActionItems(actionsData);

          if (actionsData.length === 0 && showLoading) {
            // Only check for missing action items on initial load
            console.log("📋 No action items found, checking for Accepted customers...");
            await createMissingActionItems();
          }
        } else {
          console.warn("⚠️ Action items API returned:", actionsRes.status);
          if (showLoading) {
            await createMissingActionItems();
          }
        }
      } catch (error) {
        console.error("❌ Error fetching action items:", error);
        if (showLoading) {
          await createMissingActionItems();
        }
      } finally {
        if (showLoading) {
          setLoadingActions(false);
        }
      }
    };

    const createMissingActionItems = async () => {
      try {
        console.log("🔄 Checking for customers in Accepted stage...");
        
        const pipelineRes = await fetchWithAuth("pipeline");
        if (!pipelineRes.ok) {
          console.error("❌ Pipeline request failed:", pipelineRes.status);
          return;
        }
        
        const pipelineItems: PipelineItem[] = await pipelineRes.json();
        console.log("📊 Total pipeline items:", pipelineItems.length);
        
        // ✅ FIX: Filter for customers AND projects in Accepted stage
        const acceptedCustomers = pipelineItems.filter(
          item => (item.type === 'customer' || item.type === 'project') && item.stage === 'Accepted'
        );
                
        console.log(`📋 Found ${acceptedCustomers.length} items (customers + projects) in Accepted stage`);
        
        if (acceptedCustomers.length === 0) {
          console.log("ℹ️ No customers in Accepted stage");
          return;
        }
        
        // Get existing action items to avoid duplicates
        const existingRes = await fetchWithAuth("action-items");
        const existingActionItems: ActionItem[] = existingRes.ok ? await existingRes.json() : [];
        const existingCustomerIds = new Set(existingActionItems.map(item => item.customer_id));
        
        console.log(`📌 Existing action items for ${existingCustomerIds.size} customers`);
        
        // Create action items for customers that don't have one
        let createdCount = 0;
        for (const item of acceptedCustomers) {
          const customerId = item.customer.id;
          
          if (existingCustomerIds.has(customerId)) {
            console.log(`⏭️ Skipping ${item.customer.name} - action item already exists`);
            continue;
          }
          
          try {
            console.log(`🔄 Creating action item for: ${item.customer.name}`);
            
            const createRes = await fetchWithAuth("action-items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customer_id: customerId,
              }),
            });
            
            if (createRes.ok) {
              const responseData = await createRes.json();
              console.log(`✅ Created action item for ${item.customer.name}`);
              createdCount++;
            } else {
              const errorText = await createRes.text();
              console.log(`⚠️ Failed to create action item for ${item.customer.name}:`, errorText);
            }
          } catch (error) {
            console.error(`❌ Error creating action item for ${item.customer.name}:`, error);
          }
        }
        
        console.log(`🎉 Created ${createdCount} new action items`);
        
        // Refresh action items after creation
        if (createdCount > 0) {
          console.log("🔄 Refreshing action items list...");
          const refreshRes = await fetchWithAuth("action-items");
          if (refreshRes.ok) {
            const refreshedData: ActionItem[] = await refreshRes.json();
            console.log(`✅ Loaded ${refreshedData.length} total action items`);
            setActionItems(refreshedData);
          }
        }
      } catch (error) {
        console.error("❌ Error in createMissingActionItems:", error);
      }
    };

    if (userRole) {
      // Initial load with spinner
      fetchActionItems(true);
      
      // Background refresh every 60 seconds WITHOUT spinner
      const interval = setInterval(() => fetchActionItems(false), 60000);
      return () => clearInterval(interval);
    }
  }, [userRole, refreshTrigger]);

  const handleCompleteAction = async (actionId: string) => {
    try {
      const response = await fetchWithAuth(`action-items/${actionId}/complete`, {
        method: "PATCH",
      });

      if (response.ok) {
        setActionItems(prev => prev.filter(item => item.id !== actionId));
      } else {
        alert("Failed to mark action as complete");
      }
    } catch (error) {
      console.error("Error completing action:", error);
      alert("Failed to mark action as complete");
    }
  };

  // Determine action items card color
  const hasActionItems = actionItems.length > 0;
  const cardBorderColor = hasActionItems ? "border-red-300" : "border-green-300";
  const cardBgColor = hasActionItems ? "bg-red-50/30" : "bg-green-50/30";
  const headerBgColor = hasActionItems ? "bg-red-100/50 border-red-200" : "bg-green-100/50 border-green-200";
  const iconColor = hasActionItems ? "text-red-600" : "text-green-600";
  const titleColor = hasActionItems ? "text-red-900" : "text-green-900";
  const descColor = hasActionItems ? "text-red-700" : "text-green-700";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* New Leads Card */}
      <Card>
        <CardHeader>
          <CardTitle>New Leads</CardTitle>
          <CardDescription>Last 30 Days</CardDescription>
        </CardHeader>
        <CardContent className="h-48">
          {loadingPipeline ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ChartContainer config={leadsChartConfig} className="h-full w-full">
              <BarChart data={leadsChartData} margin={{ left: 0, right: 0, top: 20, bottom: 20 }}>
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={8}
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="newLeads"
                  stackId="a"
                  fill="var(--color-newLeads)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="disqualified" 
                  stackId="a" 
                  fill="var(--color-disqualified)" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter>
          <span className="text-xl font-semibold">{newLeadsCount}</span>
        </CardFooter>
      </Card>

      {/* Sales Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="h-48">
          {loadingPipeline ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ChartContainer config={salesPipelineChartConfig} className="h-full w-full">
              <FunnelChart>
                <Funnel dataKey="value" data={pipelineData}>
                  <LabelList dataKey="stage" position="right" offset={8} className="text-xs" />
                  <LabelList dataKey="value" position="left" offset={8} className="text-xs" />
                </Funnel>
              </FunnelChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-gray-600">Live data from pipeline</p>
        </CardFooter>
      </Card>

      {/* Action Items - RED when pending, GREEN when complete */}
      <Card className={cn("border-2", cardBorderColor, cardBgColor)}>
        <CardHeader className={cn("border-b", headerBgColor)}>
          <div className="flex items-center gap-2">
            {hasActionItems ? (
              <AlertCircle className={cn("h-5 w-5", iconColor)} />
            ) : (
              <CheckCircle2 className={cn("h-5 w-5", iconColor)} />
            )}
            <CardTitle className={titleColor}>Action Items</CardTitle>
          </div>
          <CardDescription className={descColor}>
            {actionItems.length} pending action{actionItems.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-48 overflow-y-auto">
          {loadingActions ? (
            <div className="flex items-center justify-center h-full">
              <div className={cn("animate-spin rounded-full h-8 w-8 border-b-2", 
                hasActionItems ? "border-red-600" : "border-green-600"
              )}></div>
            </div>
          ) : actionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CheckCircle2 className="h-12 w-12 mb-2 opacity-50 text-green-500" />
              <p className="font-medium text-green-700">All caught up!</p>
              <p className="text-sm">No pending actions</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {actionItems.map((item) => (
                <li key={item.id} className="border-2 border-red-300 bg-white rounded-md p-2 shadow-sm">
                  <div className="flex items-start gap-2 mb-2">
                    <Checkbox className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Order materials for {item.customer_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-600">
                          {format(new Date(item.created_at), "MMM dd, yyyy")}
                        </span>
                        <span
                          className={cn(
                            "ml-auto rounded-md px-2 py-0.5 text-xs font-medium",
                            item.priority === "High" && "text-red-700 bg-red-100",
                            item.priority === "Medium" && "bg-yellow-100 text-yellow-700",
                            item.priority === "Low" && "bg-green-100 text-green-700",
                          )}
                        >
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    onClick={() => handleCompleteAction(item.id)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mark Completed
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}