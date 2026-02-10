import {
  ShoppingBag,
  Forklift,
  Mail,
  MessageSquare,
  Calendar,
  Kanban,
  ReceiptText,
  Users,
  Lock,
  Fingerprint,
  SquareArrowUpRight,
  LayoutDashboard,
  ChartBar,
  Banknote,
  Gauge,
  GraduationCap,
  CheckCircle,
  Package,
  Home,
  Briefcase,
  FileText,
  Settings,
  type LucideIcon,
  Bot,
  Bell,
  ClipboardList,
  DollarSign,
  ClipboardCheck,
  History,
  TrendingUp,
  Phone,
  BadgeDollarSign,
  FolderOpen, // ✅ Added for Documents
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  roles?: string[];
  badge?: number | string;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  roles?: string[];
  badge?: number | string;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

// Define all sidebar items with role permissions (Admin/Staff only)
const allSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboard",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard/default",
        icon: Home,
        roles: ["admin", "staff"], // Everyone can see dashboard
      },
      // {
      //   title: "Sales Pipeline",
      //   url: "/dashboard/sales_pipeline",
      //   icon: Briefcase,
      //   roles: ["admin", "staff"],
      // },
      // {
      //   title: "Training Pipeline",
      //   url: "/dashboard/training_pipeline",
      //   icon: GraduationCap,
      //   roles: ["admin", "staff"],
      //   isNew: true, // Mark as new feature
      // },
      {
        title: "Renewals",
        url: "/dashboard/renewals",
        icon: Users,
        roles: ["admin", "staff"],
      },
      {
        title: "Leads",
        url: "/dashboard/leads",
        icon: Phone,
        roles: ["admin", "staff"],
        subItems: [
          {
            title: "All Leads",
            url: "/dashboard/leads",
            roles: ["admin", "staff"],
          },
          {
            title: "Recycle Bin",
            url: "/dashboard/leads/recycle-bin",
            roles: ["admin", "staff"],
          },
        ],
      },

      {
        title: "Priced",
        url: "/dashboard/priced",
        icon: BadgeDollarSign,
        roles: ["admin", "staff"],
        isNew: true,
      },

      {
        title: "Documents", // ✅ NEW DOCUMENTS PAGE
        url: "/dashboard/documents",
        icon: FolderOpen, // ✅ Icon for documents/templates
        roles: ["admin", "staff"],
        isNew: true, // ✅ Mark as new feature
      },

      // {
      //   title: "Calendar",
      //   url: "/dashboard/calendar",
      //   icon: Calendar,
      //   roles: ["admin", "staff"],
      // },
      // {
      //   title: "Proposals",
      //   url: "/dashboard/proposals",
      //   icon: FileText,
      //   roles: ["admin", "staff"],
      // },
      // {
      //   title: "Invoices",
      //   url: "/dashboard/invoices",
      //   icon: DollarSign,
      //   roles: ["admin", "staff"],
      // },
      // // ✅ ADD TEST GRADING SECTION
      // {
      //   title: "Test Grading",
      //   url: "/dashboard/test_grading",
      //   icon: ClipboardCheck,
      //   roles: ["admin", "staff"],
      //   isNew: true, // Mark as new feature
      //   subItems: [
      //     {
      //       title: "Grade Test",
      //       url: "/dashboard/test_grading",
      //       icon: ClipboardCheck,
      //       roles: ["admin", "staff"],
      //     },
      //     {
      //       title: "Results History",
      //       url: "/dashboard/test_grading/results",
      //       icon: History,
      //       roles: ["admin", "staff"],
      //     },
      //   ],
      // },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        roles: ["admin", "staff"],
      },
    ],
  },
];

// Filter sidebar items based on user role and optionally set notification badge
export const getSidebarItems = (userRole: string, notificationCount?: number): NavGroup[] => {
  // Normalize role: Manager/Admin -> admin, Staff -> staff
  const normalizedRole = userRole?.toLowerCase() || '';
  const roleMap: Record<string, string[]> = {
    'manager': ['admin', 'staff'],
    'admin': ['admin', 'staff'],
    'staff': ['staff'],
  };
  
  // Get allowed roles for this user
  const allowedRoles = roleMap[normalizedRole] || ['admin', 'staff']; // Default to showing all if role unknown
  
  return allSidebarItems
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => {
          // If no roles defined, show to everyone
          if (!item.roles || item.roles.length === 0) return true;
          // Check if any of the user's allowed roles match the item's required roles
          return item.roles.some(role => allowedRoles.includes(role));
        })
        .map((item) => {
          // Update notification badge count dynamically
          if (item.title === "Notifications" && notificationCount !== undefined && notificationCount > 0) {
            return {
              ...item,
              badge: notificationCount > 9 ? '9+' : notificationCount,
            };
          }
          
          // Filter sub-items based on role if they exist
          if (item.subItems && item.subItems.length > 0) {
            return {
              ...item,
              subItems: item.subItems.filter((subItem) => {
                // If no roles defined, show to everyone
                if (!subItem.roles || subItem.roles.length === 0) return true;
                // Check if any of the user's allowed roles match the sub-item's required roles
                return subItem.roles.some(role => allowedRoles.includes(role));
              }),
            };
          }
          
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0); // Remove empty groups
};

// For backwards compatibility, export default items (Admin view shows all)
export const sidebarItems = getSidebarItems("Admin");