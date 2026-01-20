"use client";

import { useState } from "react";
import { UserPlus, ClipboardList, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateCustomerModal } from "@/components/ui/CreateCustomerModal";
import { useRouter } from "next/navigation";

export function QuickActions() {
  const router = useRouter();
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const handleCustomerCreated = () => {
    // Refresh the dashboard or show success message
    window.location.reload();
  };

  const openKitchenChecklist = () => {
    // Navigate to kitchen checklist form in walk-in mode
    router.push("/dashboard/forms?type=kitchen&mode=walkin");
  };

  const openBedroomChecklist = () => {
    // Navigate to bedroom checklist form in walk-in mode
    router.push("/dashboard/forms?type=bedroom&mode=walkin");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Create Customer */}
          <Button
            onClick={() => setShowCreateCustomer(true)}
            className="w-full justify-start"
            variant="outline"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create Customer
          </Button>

          {/* Kitchen Checklist */}
          <Button
            onClick={openKitchenChecklist}
            className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Kitchen Checklist
          </Button>

          {/* Bedroom Checklist */}
          <Button
            onClick={openBedroomChecklist}
            className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Bedroom Checklist
          </Button>

          {/* <div className="pt-3 border-t text-xs text-gray-500">
            <p>💡 <strong>Walk-in customers:</strong> Use checklists to capture customer info automatically</p>
          </div> */}
        </CardContent>
      </Card>

      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </>
  );
}