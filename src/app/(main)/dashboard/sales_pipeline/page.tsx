"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { KanbanBoard, KanbanCard, KanbanCards, KanbanHeader, KanbanProvider } from "@/components/ui/shadcn-io/kanban";
import {
  Search,
  Calendar,
  Mail,
  MoreHorizontal,
  Eye,
  Users,
  Plus,
  UserPlus,
  Phone,
  MapPin,
  AlertCircle,
  Filter,
  Lock,
  X,
  GraduationCap,
  FileCheck,
  Send,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fetchWithAuth } from "@/lib/api";
import { useRouter } from "next/navigation";

// --- PIPELINE DEFINITIONS ---

// Sales Pipeline Stages
const SALES_STAGES = ["Enquiry", "Proposal", "Converted"] as const;
type SalesStage = (typeof SALES_STAGES)[number];

// Training Pipeline Stages
const TRAINING_STAGES = [
  "Training Scheduled",
  "Training Conducted", 
  "Training Completed",
  "PTI Created",
  "Certificates Created",
  "Certificates Dispatched"
] as const;
type TrainingStage = (typeof TRAINING_STAGES)[number];

type Stage = SalesStage | TrainingStage;

const salesStageColors: Record<SalesStage, string> = {
  "Enquiry": "#6B7280",
  "Proposal": "#3B82F6",
  "Converted": "#059669",
};

const trainingStageColors: Record<TrainingStage, string> = {
  "Training Scheduled": "#EC4899",
  "Training Conducted": "#9333EA",
  "Training Completed": "#10B981",
  "PTI Created": "#D97706",
  "Certificates Created": "#0284C7",
  "Certificates Dispatched": "#065F46",
};

type UserRole = "Admin" | "Staff";

const ROLE_PERMISSIONS: Record<UserRole, any> = {
  Admin: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewFinancials: true,
    canDragDrop: true,
    canViewAllRecords: true,
  },
  Staff: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canViewFinancials: false,
    canDragDrop: true,
    canViewAllRecords: true,
  },
};

// --- TYPE DEFINITIONS ---

type Customer = {
  id: string;
  name: string;
  address?: string | null;
  postcode?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_made: "Yes" | "No" | "Unknown";
  preferred_contact_method?: "Phone" | "Email" | "WhatsApp" | null;
  marketing_opt_in: boolean;
  date_of_measure?: string | null;
  sales_stage: SalesStage;
  training_stage?: TrainingStage | null;
  pipeline_type: 'sales' | 'training';
  notes?: string | null;
  salesperson?: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type PipelineItem = {
  id: string;
  type: "customer";
  customer: Customer;
  stage: Stage;
  pipeline_type: 'sales' | 'training';
};

const makeSalesColumns = () =>
  SALES_STAGES.map((name) => ({
    id: `col-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    color: salesStageColors[name],
  }));

const makeTrainingColumns = () =>
  TRAINING_STAGES.map((name) => ({
    id: `col-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    color: trainingStageColors[name],
  }));

const columnIdToStage = (colId: string, pipelineType: 'sales' | 'training'): Stage => {
  const stages = pipelineType === 'sales' ? SALES_STAGES : TRAINING_STAGES;
  const stage = stages.find((s) => `col-${s.toLowerCase().replace(/\s+/g, "-")}` === colId);
  return stage ?? (pipelineType === 'sales' ? "Enquiry" : "Training Scheduled") as Stage;
};

const stageToColumnId = (stage: Stage) => `col-${stage.toLowerCase().replace(/\s+/g, "-")}`;

export default function EnhancedPipelinePage() {
  const router = useRouter();
  const [salesPipelineItems, setSalesPipelineItems] = useState<PipelineItem[]>([]);
  const [trainingPipelineItems, setTrainingPipelineItems] = useState<PipelineItem[]>([]);
  const [salesFeatures, setSalesFeatures] = useState<any[]>([]);
  const [trainingFeatures, setTrainingFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePipeline, setActivePipeline] = useState<'sales' | 'training'>('sales');
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSalesperson, setFilterSalesperson] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const { user, token, loading: authLoading } = useAuth();
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    itemId: string | null;
    newStage?: Stage;
    reason?: string;
  }>({
    open: false,
    itemId: null,
  });
  const prevSalesFeaturesRef = useRef<any[]>([]);
  const prevTrainingFeaturesRef = useRef<any[]>([]);
  
  const userRole = (user?.role || "Staff") as UserRole;
  const permissions = ROLE_PERMISSIONS[userRole];

  const currentPipelineItems = activePipeline === 'sales' ? salesPipelineItems : trainingPipelineItems;
  const currentFeatures = activePipeline === 'sales' ? salesFeatures : trainingFeatures;
  const currentColumns = activePipeline === 'sales' ? makeSalesColumns() : makeTrainingColumns();
  const currentStages = activePipeline === 'sales' ? SALES_STAGES : TRAINING_STAGES;

  const mapPipelineToFeatures = useCallback((items: PipelineItem[], pipelineType: 'sales' | 'training') => {
    return items.map((item) => {
      const { notes: customerNotes, ...customerWithoutNotes } = item.customer;
      
      return {
        id: item.id,
        name: `${item.customer.name}`,
        column: stageToColumnId(item.stage),
        itemId: item.id,
        customer: customerWithoutNotes,
        stage: item.stage,
        salesperson: item.customer.salesperson,
        pipeline_type: pipelineType,
      };
    });
  }, []);

  useEffect(() => {
    if (authLoading || !user || !token) {
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [salesResponse, trainingResponse] = await Promise.all([
          fetch("http://localhost:5000/pipeline/sales", {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }),
          fetch("http://localhost:5000/pipeline/training", {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
        ]);

        if (!salesResponse.ok || !trainingResponse.ok) {
          throw new Error("Failed to fetch pipeline data");
        }

        const salesData = await salesResponse.json();
        const trainingData = await trainingResponse.json();
        
        if (isCancelled) return;
        
        setSalesPipelineItems(salesData);
        setTrainingPipelineItems(trainingData);
        
        const salesMapped = mapPipelineToFeatures(salesData, 'sales');
        const trainingMapped = mapPipelineToFeatures(trainingData, 'training');
        
        setSalesFeatures(salesMapped);
        setTrainingFeatures(trainingMapped);
        prevSalesFeaturesRef.current = salesMapped;
        prevTrainingFeaturesRef.current = trainingMapped;

      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "Failed to load data");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, token, user, mapPipelineToFeatures]);

  const handleDataChange = async (next: any[]) => {
    if (!permissions.canDragDrop) {
      alert("You don't have permission to move items in the pipeline.");
      return;
    }

    const prev = activePipeline === 'sales' ? prevSalesFeaturesRef.current : prevTrainingFeaturesRef.current;
    const moved = next.filter((n) => {
      const p = prev.find((x) => x.id === n.id);
      return p && p.column !== n.column;
    });
    
    if (moved.length === 0) return;

    const stageUpdates = new Map(
      moved.map((item) => [item.itemId, columnIdToStage(item.column, activePipeline)]),
    );

    const previousSnapshot = prev;
    const previousPipelineSnapshot = currentPipelineItems;

    // Optimistic update
    const movedIds = new Set(moved.map((item) => item.id));
    const nextById = new Map(next.map((item) => [item.id, item]));

    const optimisticallyUpdatedFeatures = currentFeatures.map((feature) => {
      if (!movedIds.has(feature.id)) return feature;
      const nextFeature = nextById.get(feature.id);
      const nextColumn = nextFeature?.column ?? feature.column;
      const nextStage = stageUpdates.get(feature.itemId) ?? feature.stage;
      return { ...feature, column: nextColumn, stage: nextStage };
    });

    if (activePipeline === 'sales') {
      setSalesFeatures(optimisticallyUpdatedFeatures);
      prevSalesFeaturesRef.current = optimisticallyUpdatedFeatures;
      setSalesPipelineItems((current) =>
        current.map((item) => {
          const newStage = stageUpdates.get(item.id);
          return newStage ? { ...item, stage: newStage } : item;
        })
      );
    } else {
      setTrainingFeatures(optimisticallyUpdatedFeatures);
      prevTrainingFeaturesRef.current = optimisticallyUpdatedFeatures;
      setTrainingPipelineItems((current) =>
        current.map((item) => {
          const newStage = stageUpdates.get(item.id);
          return newStage ? { ...item, stage: newStage } : item;
        })
      );
    }

    try {
      const updatePromises = moved.map(async (item) => {
        const newStage = columnIdToStage(item.column, activePipeline);
        const entityId = item.itemId.replace("customer-", "");

        const response = await fetchWithAuth(`customers/${entityId}/stage`, {
          method: "PATCH",
          body: JSON.stringify({
            stage: newStage,
            pipeline_type: activePipeline,
            reason: "Moved via Kanban board",
            updated_by: user?.email || "current_user",
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update customer ${entityId}`);
        }

        return await response.json();
      });

      await Promise.all(updatePromises);

    } catch (error) {
      console.error("Error updating stages:", error);
      
      // Revert on error
      if (activePipeline === 'sales') {
        setSalesFeatures(previousSnapshot);
        prevSalesFeaturesRef.current = previousSnapshot;
        setSalesPipelineItems(previousPipelineSnapshot);
      } else {
        setTrainingFeatures(previousSnapshot);
        prevTrainingFeaturesRef.current = previousSnapshot;
        setTrainingPipelineItems(previousPipelineSnapshot);
      }
      
      alert("Failed to update stage. Changes reverted.");
    }
  };

  const filteredFeatures = useMemo(() => {
    if (loading) return [];

    return currentFeatures.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer.phone?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSalesperson = filterSalesperson === "all" || item.salesperson === filterSalesperson;
      const matchesStage = filterStage === "all" || item.stage === filterStage;

      return matchesSearch && matchesSalesperson && matchesStage;
    });
  }, [currentFeatures, searchTerm, filterSalesperson, filterStage, loading]);

  const filteredListItems = useMemo(() => {
    return currentPipelineItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer.phone?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSalesperson = filterSalesperson === "all" || item.customer.salesperson === filterSalesperson;
      const matchesStage = filterStage === "all" || item.stage === filterStage;

      return matchesSearch && matchesSalesperson && matchesStage;
    });
  }, [currentPipelineItems, searchTerm, filterSalesperson, filterStage]);

  const salespeople = useMemo(
    () => [...new Set([...salesPipelineItems, ...trainingPipelineItems].map((item) => item.customer.salesperson).filter(Boolean))],
    [salesPipelineItems, trainingPipelineItems],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of currentColumns) map[c.id] = 0;
    for (const f of filteredFeatures) {
      map[f.column] = (map[f.column] ?? 0) + 1;
    }
    return map;
  }, [currentColumns, filteredFeatures]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return "Invalid Date";
    }
  };

  const handleOpenCustomer = (customerId: string) => {
    const cleanId = customerId.replace('customer-', '');
    router.push(`/dashboard/clients/${cleanId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-[300px] flex-shrink-0 space-y-3">
              <div className="h-12 bg-gray-200 rounded animate-pulse" />
              <div className="h-32 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 text-lg font-medium text-red-900">Error Loading Data</h3>
            <p className="mb-4 text-red-600">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales & Training Pipeline</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {userRole} View
          </Badge>
          {permissions.canCreate && (
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/clients/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline Selector */}
      <div className="flex items-center gap-4">
        <Button
          variant={activePipeline === 'sales' ? 'default' : 'outline'}
          onClick={() => setActivePipeline('sales')}
        >
          Sales Pipeline
        </Button>
        <Button
          variant={activePipeline === 'training' ? 'default' : 'outline'}
          onClick={() => setActivePipeline('training')}
        >
          <GraduationCap className="mr-2 h-4 w-4" />
          Training Pipeline
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name, address, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <span>Filters</span>
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 space-y-2 p-2">
            <DropdownMenuLabel>Filters</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {permissions.canViewAllRecords && (
              <Select value={filterSalesperson} onValueChange={setFilterSalesperson}>
                <SelectTrigger>
                  <SelectValue placeholder="All Salespeople" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Salespeople</SelectItem>
                  {salespeople.map((person) => (
                    <SelectItem key={person} value={person!}>
                      {person}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger>
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {currentStages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Kanban View */}
      <div className="h-[calc(100vh-280px)]">
        <div className="h-full overflow-x-auto overflow-y-hidden rounded-lg bg-gray-50/30">
          <div className="flex h-full items-start gap-4 p-3" style={{ width: "max-content", minWidth: "100%" }}>
            <KanbanProvider
              columns={currentColumns} 
              data={filteredFeatures}
              onDataChange={permissions.canDragDrop ? handleDataChange : undefined}
            >
              {(column) => (
                <div key={column.id} className="flex-shrink-0">
                  <KanbanBoard
                    id={column.id}
                    className="flex h-full w-[300px] flex-shrink-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex h-full flex-col">
                      <KanbanHeader className="flex-shrink-0 rounded-t-lg border-b bg-white p-2.5 sticky top-0 z-10 shadow-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
                          <span className="text-xs font-medium">{column.name}</span>
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {counts[column.id] ?? 0}
                          </Badge>
                        </div>
                      </KanbanHeader>

                      <KanbanCards id={column.id} className="flex-1 space-y-2 overflow-y-auto p-2">
                        {(feature: any) => (
                          <KanbanCard
                            column={column.id}
                            id={feature.id}
                            key={feature.id}
                            name={feature.name}
                            className="rounded-md border-2 border-gray-200 bg-white shadow-sm transition-all hover:shadow-md p-3"
                          >
                            <div className="space-y-2.5">
                              <div>
                                <h3 className="text-base font-bold leading-tight text-gray-900">
                                  {feature.customer.name}
                                </h3>
                              </div>

                              {(feature.customer.phone || feature.customer.email || feature.customer.address) && (
                                <div className="space-y-1 text-xs text-gray-600">
                                  {feature.customer.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                      <span className="truncate">{feature.customer.phone}</span>
                                    </div>
                                  )}
                                  {feature.customer.email && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                      <span className="truncate">{feature.customer.email}</span>
                                    </div>
                                  )}
                                  {feature.customer.address && (
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                      <span className="truncate">{feature.customer.address}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="space-y-1 text-xs">
                                {feature.salesperson && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                    <span className="truncate text-gray-700">{feature.salesperson}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-1 pt-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 flex-1 px-1 text-xs hover:bg-gray-200 bg-white/50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCustomer(feature.itemId);
                                  }}
                                  title="View Customer"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </KanbanCard>
                        )}
                      </KanbanCards>
                    </div>
                  </KanbanBoard>
                </div>
              )}
            </KanbanProvider>
          </div>
        </div>
      </div>
    </div>
  );
}