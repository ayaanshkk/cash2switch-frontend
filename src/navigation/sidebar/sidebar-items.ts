import {
  ShoppingBag,
  Forklift,
  Mail,
  MailCheck,
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
  BadgePoundSterling,
  FolderOpen,
  Trash2,
  File,
  UserPlus,
  Archive,
  UserCheck,
  Sparkles,
  FilePenLine,
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
        roles: ["platform admin", "salesperson", "leads offshore"],
      },
      {
        title: "Renewals",
        url: "/dashboard/renewals",
        icon: Users,
        roles: ["platform admin", "salesperson"],
        subItems: [
          {
            title: "Renewals",
            url: "/dashboard/renewals",
            icon: Users,
            roles: ["platform admin", "salesperson"],
          },
          {
            title: "Allocated Renewals",
            url: "/dashboard/allocated-renewals",
            icon: UserCheck,
            roles: ["platform admin", "salesperson"],
          },
        ],
      },
      {
        title: "Leads",
        url: "/dashboard/leads",
        icon: Phone,
        roles: ["platform admin", "salesperson", "leads offshore"],
        subItems: [
          {
            title: "Leads",
            url: "/dashboard/leads",
            icon: Phone,
            roles: ["platform admin", "salesperson", "leads offshore"],
          },
          {
            title: "Allocated Leads",
            url: "/dashboard/allocated-leads",
            icon: UserCheck,
            roles: ["platform admin", "salesperson", "leads offshore"],
          },
        ],
      },
      {
        title: "Priced",
        url: "/dashboard/priced",
        icon: BadgePoundSterling,
        roles: ["platform admin", "salesperson"],
        isNew: true,
      },
      {
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: Calendar,
        roles: ["platform admin", "salesperson", "leads offshore"],
        isNew: true,
        subItems: [
          {
            title: "Renewals Calendar",
            url: "/dashboard/calendar?view=renewals",
            icon: Calendar,
            roles: ["platform admin", "salesperson", "leads offshore"],
          },
          {
            title: "Leads Calendar",
            url: "/dashboard/calendar?view=leads",
            icon: Calendar,
            roles: ["platform admin", "salesperson", "leads offshore"],
          },
        ],
      },
      {
        title: "Documents",
        url: "/dashboard/documents/all",
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
        title: "Archives",
        url: "/dashboard/archives",
        icon: Archive,
        roles: ["platform admin"],
      },
      {
        title: "Email Logs",
        url: "/dashboard/email-logs",
        icon: MailCheck,
        roles: ["platform admin"],
      },
      {
        title: "Cleansing",
        url: "/dashboard/cleansing",
        icon: Sparkles,  
        roles: ["platform admin", "salesperson"],
      },
      {
        title: "Drafts",
        url: "/dashboard/drafts",
        icon: FilePenLine,
        roles: ["platform admin"],
        isNew: true,
      },
      {
        title: "Recycle Bin",
        url: "/dashboard/recycle-bin",
        icon: Trash2,
        roles: ["platform admin", "salesperson", "leads offshore"],
      },
      {
        title: "Notifications",
        url: "/dashboard/notifications",
        icon: Bell,
        roles: ["platform admin", "salesperson", "leads offshore"],
        isNew: true,
      },
      {
        title: "Payments",
        url: "/dashboard/payments",
        icon: Banknote,
        roles: ["platform admin"],
        isNew: true,
        subItems: [
          {
            title: "Supplier Terms",
            url: "/dashboard/payments/supplier-terms",
            icon: Settings,
            roles: ["platform admin"],
          },
          {
            title: "Payment Checker",
            url: "/dashboard/payments",
            icon: ReceiptText,
            roles: ["platform admin"],
          },
          {
            title: "Agent Commissions",
            url: "/dashboard/payments/agent-commissions",
            icon: BadgePoundSterling,
            roles: ["platform admin"],
          },
          {
            title: "Reports",
            url: "/dashboard/payments/reports",
            icon: ChartBar,
            roles: ["platform admin"],
          },
        ],
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        roles: ["platform admin", "salesperson", "leads offshore"],
      },
    ],
  },
];

// Filter sidebar items based on user role and optionally set notification badge
export const getSidebarItems = (userRole: string, notificationCount?: number): NavGroup[] => {
  // Normalize role to lowercase for comparison
  const normalizedRole = userRole?.toLowerCase().trim() || '';
  
  const isAdmin = [
    'admin',
    'platform admin',
    'tenant super admin',
    'super admin',
    'superadmin',
  ].includes(normalizedRole);
  const isSalesperson = normalizedRole.includes('salesperson') || normalizedRole.includes('sales');
  const isLeadsOffshore = normalizedRole.includes('leads') || normalizedRole.includes('offshore');

  
  // Determine allowed roles
  let allowedRoles: string[] = [];
  if (isAdmin) {
    allowedRoles = ['platform admin', 'salesperson', 'leads offshore'];
  } else if (isSalesperson) {
    allowedRoles = ['salesperson'];
  } else if (isLeadsOffshore) {
    allowedRoles = ['leads offshore'];
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
          // ✅ UPDATED: Apply notification badge to Notifications menu item
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
