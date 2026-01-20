"use client";

import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { FunnelChart, Funnel, LabelList } from "recharts";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { salesPipelineChartConfig, generateSalesPipelineData, generateNewLeadsData } from "./crm.config";
import { format } from "date-fns";

type ActionItem = {
  id: string;
  customer_name: string;
  customer_id: string;
  stage: string;
  priority: "High" | "Medium" | "Low";
  created_at: string;
  completed: boolean;
};

export function OperationalCards() {
  const { user } = useAuth();
  const userRole = user?.role || "Staff";
  
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [salesPipelineChartData, setSalesPipelineChartData] = useState<any[]>([]);
  const [newLeadsData, setNewLeadsData] = useState({ total: 0, disqualified: 0 });
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch pipeline data
        const pipelineResponse = await fetchWithAuth("pipeline");
        if (pipelineResponse.ok) {
          const pipelineData = await pipelineResponse.json();
          setPipelineData(pipelineData);
          
          // Generate chart data from pipeline
          setSalesPipelineChartData(generateSalesPipelineData(pipelineData));
          
          // Generate new leads data
          const customers = pipelineData.filter((item: any) => item.type === "customer");
          setNewLeadsData(generateNewLeadsData(customers.map((c: any) => c.customer)));
        }

        // Fetch action items (only for Manager, HR, Production)
        if (["Manager", "HR", "Production"].includes(userRole)) {
          const actionsResponse = await fetchWithAuth("action-items");
          if (actionsResponse.ok) {
            const actionsData = await actionsResponse.json();
            setActionItems(actionsData);
          }
        }

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  const handleCompleteAction = async (actionId: string) => {
    try {
      const response = await fetchWithAuth(`action-items/${actionId}/complete`, {
        method: "PATCH",
      });

      if (response.ok) {
        // Remove from UI immediately
        setActionItems(prev => prev.filter(item => item.id !== actionId));
      } else {
        alert("Failed to mark action as complete");
      }
    } catch (error) {
      console.error("Error completing action:", error);
      alert("Failed to mark action as complete");
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="h-96 animate-pulse">
          <div className="h-full bg-gray-100" />
        </Card>
        <Card className="h-96 animate-pulse">
          <div className="h-full bg-gray-100" />
        </Card>
        {["Manager", "HR", "Production"].includes(userRole) && (
          <Card className="h-96 animate-pulse">
            <div className="h-full bg-gray-100" />
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* New Leads Card */}
      <Card>
        <CardHeader>
          <CardTitle>New Leads</CardTitle>
          <CardDescription>Last 30 Days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold">{newLeadsData.total}</div>
              <p className="text-sm text-gray-600 mt-2">New Leads</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold text-green-600">{newLeadsData.total}</div>
                <p className="text-xs text-gray-600 mt-1">New Leads</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold text-red-600">{newLeadsData.disqualified}</div>
                <p className="text-xs text-gray-600 mt-1">Disqualified</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">
            Live data from customer pipeline
          </p>
        </CardFooter>
      </Card>

      {/* Sales Pipeline Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="size-full">
          <ChartContainer config={salesPipelineChartConfig} className="size-full">
            <FunnelChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <Funnel className="stroke-card stroke-2" dataKey="value" data={salesPipelineChartData}>
                <LabelList className="fill-foreground stroke-0" dataKey="stage" position="right" offset={10} />
                <LabelList className="fill-foreground stroke-0" dataKey="value" position="left" offset={10} />
              </Funnel>
            </FunnelChart>
          </ChartContainer>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">Live data from all customer jobs.</p>
        </CardFooter>
      </Card>

      {/* Action Items Card - Only for Manager, HR, Production */}
      {["Manager", "HR", "Production"].includes(userRole) && (
        <Card className="border-2 border-orange-200 bg-orange-50/30">
          <CardHeader className="border-b border-orange-200 bg-orange-100/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-900">Action Items</CardTitle>
            </div>
            <CardDescription className="text-orange-700">
              {actionItems.length} pending action{actionItems.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {actionItems.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm mt-1">No pending action items</p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-[400px] overflow-y-auto">
                {actionItems.map((item) => (
                  <li 
                    key={item.id} 
                    className="space-y-2 rounded-md border-2 border-orange-300 bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox 
                        id={`action-${item.id}`}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <label 
                          htmlFor={`action-${item.id}`}
                          className="text-sm font-semibold cursor-pointer block"
                        >
                          Order materials for {item.customer_name}
                        </label>
                        <div className="text-xs text-gray-600 mt-1">
                          Customer moved to Accepted stage
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="text-muted-foreground h-3 w-3" />
                          <span className="text-muted-foreground text-xs font-medium">
                            {format(new Date(item.created_at), "MMM dd, yyyy")}
                          </span>
                          <span
                            className={cn(
                              "ml-auto w-fit rounded-md px-2 py-0.5 text-xs font-medium",
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
                      className="w-full mt-2 border-green-200 bg-green-50 hover:bg-green-100 text-green-700"
                      onClick={() => handleCompleteAction(item.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Completed
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}