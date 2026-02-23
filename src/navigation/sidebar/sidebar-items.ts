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
  FolderOpen,
  Trash2,
  File,
  UserPlus,
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

// Define all sidebar items with role permissions
const allSidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        title: "Dashboard",
        url: "/dashboard/default",
        icon: Home,
        roles: ["platform admin", "salesperson"],
      },
      {
        title: "Renewals",
        url: "/dashboard/renewals",
        icon: Users,
        roles: ["platform admin", "salesperson"],
      },
      {
        title: "Leads",
        url: "/dashboard/leads",
        icon: Phone,
        roles: ["platform admin", "salesperson"],
      },
      {
        title: "Priced",
        url: "/dashboard/priced",
        icon: BadgeDollarSign,
        roles: ["platform admin", "salesperson"],
        isNew: true,
      },
      {
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: Calendar,
        roles: ["platform admin", "salesperson"],
        isNew: true,
      },
      {
        title: "Documents",
        url: "/dashboard/documents/all", // Changed from /dashboard/documents
        icon: FolderOpen,
        roles: ["platform admin", "salesperson"],
        subItems: [
          {
            title: "All Documents",
            url: "/dashboard/documents/all",
            icon: File,
            roles: ["platform admin", "salesperson"],
          },
          {
            title: "New Connections",
            url: "/dashboard/documents/new-connections",
            icon: UserPlus,
            roles: ["platform admin", "salesperson"],
          },
        ],
      },
      {
        title: "Recycle Bin",
        url: "/dashboard/recycle-bin",
        icon: Trash2,
        roles: ["platform admin", "salesperson"],
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        roles: ["platform admin", "salesperson"],
      },
    ],
  },
];

// Filter sidebar items based on user role and optionally set notification badge
export const getSidebarItems = (userRole: string, notificationCount?: number): NavGroup[] => {
  // Normalize role to lowercase for comparison
  const normalizedRole = userRole?.toLowerCase().trim() || '';
  
  // Check if user has platform admin role
  const isPlatformAdmin = normalizedRole.includes('platform') && normalizedRole.includes('admin');
  const isSalesperson = normalizedRole.includes('salesperson') || normalizedRole.includes('sales');
  
  // Determine allowed roles
  let allowedRoles: string[] = [];
  if (isPlatformAdmin) {
    allowedRoles = ['platform admin', 'salesperson']; // Admin sees everything
  } else if (isSalesperson) {
    allowedRoles = ['salesperson'];
  }
  
  return allSidebarItems
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => {
          if (!item.roles || item.roles.length === 0) return true;
          return item.roles.some(role => allowedRoles.includes(role.toLowerCase()));
        })
        .map((item) => {
          if (item.title === "Notifications" && notificationCount !== undefined && notificationCount > 0) {
            return {
              ...item,
              badge: notificationCount > 9 ? '9+' : notificationCount,
            };
          }
          
          if (item.subItems && item.subItems.length > 0) {
            return {
              ...item,
              subItems: item.subItems.filter((subItem) => {
                if (!subItem.roles || subItem.roles.length === 0) return true;
                return subItem.roles.some(role => allowedRoles.includes(role.toLowerCase()));
              }),
            };
          }
          
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0);
};

// For backwards compatibility, export default items (Platform Admin view shows all)
export const sidebarItems = getSidebarItems("Platform Admin");