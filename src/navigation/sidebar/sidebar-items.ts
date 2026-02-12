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
  Trash2, // ✅ Added for Recycle Bin
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
        roles: ["admin", "staff"],
      },
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
      },
      {
        title: "Priced",
        url: "/dashboard/priced",
        icon: BadgeDollarSign,
        roles: ["admin", "staff"],
        isNew: true,
      },
      {
        title: "Documents",
        url: "/dashboard/documents",
        icon: FolderOpen,
        roles: ["admin", "staff"],
        isNew: true,
      },
      {
        title: "Recycle Bin", // ✅ Separate page (removed from Leads sub-items)
        url: "/dashboard/recycle-bin",
        icon: Trash2,
        roles: ["admin", "staff"],
      },
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
  const allowedRoles = roleMap[normalizedRole] || ['admin', 'staff'];
  
  return allSidebarItems
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => {
          if (!item.roles || item.roles.length === 0) return true;
          return item.roles.some(role => allowedRoles.includes(role));
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
                return subItem.roles.some(role => allowedRoles.includes(role));
              }),
            };
          }
          
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0);
};

// For backwards compatibility, export default items (Admin view shows all)
export const sidebarItems = getSidebarItems("Admin");