/* eslint-disable max-lines */

import { ChartConfig } from "@/components/ui/chart";

// ============================================
// CHART CONFIGURATIONS (Keep these static)
// ============================================

export const leadsChartConfig = {
  newLeads: {
    label: "New Leads",
    color: "var(--chart-1)",
  },
  disqualified: {
    label: "Disqualified",
    color: "var(--chart-3)",
  },
  background: {
    color: "var(--primary)",
  },
} as ChartConfig;

export const proposalsChartConfig = {
  proposalsSent: {
    label: "Proposals Sent",
    color: "var(--chart-1)",
  },
} as ChartConfig;

export const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} as ChartConfig;

export const salesPipelineChartConfig = {
  lead: {
    label: "Lead",
    color: "hsl(var(--chart-1))",
  },
  quote: {
    label: "Quote",
    color: "hsl(var(--chart-2))",
  },
  accepted: {
    label: "Accepted",
    color: "hsl(var(--chart-3))",
  },
  production: {
    label: "Production",
    color: "hsl(var(--chart-4))",
  },
  complete: {
    label: "Complete",
    color: "hsl(var(--chart-5))",
  },
};

export const projectRevenueChartConfig = {
  actual: {
    label: "Actual",
    color: "var(--chart-1)",
  },
  remaining: {
    label: "Remaining",
    color: "var(--chart-2)",
  },
  label: {
    color: "var(--primary-foreground)",
  },
} as ChartConfig;

// ============================================
// DYNAMIC DATA GENERATION FUNCTIONS
// ============================================

/**
 * Generate sales pipeline funnel data from real pipeline items
 */
export const generateSalesPipelineData = (pipelineItems: any[]) => {
  const stageCounts: Record<string, number> = {
    Lead: 0,
    Survey: 0,
    Design: 0,
    Quote: 0,
    Accepted: 0,
    Ordered: 0,
    Production: 0,
    Delivery: 0,
    Installation: 0,
    Complete: 0,
    Remedial: 0,
    Rejected: 0,
  };
  
  // Count items in each stage
  pipelineItems.forEach(item => {
    const stage = item.stage || 'Lead';
    if (stageCounts.hasOwnProperty(stage)) {
      stageCounts[stage]++;
    }
  });

  // Return funnel data (showing key stages only for clarity)
  return [
    { stage: "Lead", value: stageCounts['Lead'] || 0, fill: "var(--color-lead)" },
    { stage: "Quote", value: stageCounts['Quote'] || 0, fill: "var(--color-quote)" },
    { stage: "Accepted", value: stageCounts['Accepted'] || 0, fill: "var(--color-accepted)" },
    { stage: "Production", value: stageCounts['Production'] || 0, fill: "var(--color-production)" },
    { stage: "Complete", value: stageCounts['Complete'] || 0, fill: "var(--color-complete)" },
  ];
};

/**
 * Generate new leads data from customers created in last 30 days
 */
export const generateNewLeadsData = (customers: any[]) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Filter customers created in last 30 days
  const recentCustomers = customers.filter(c => {
    if (!c.created_at) return false;
    const createdDate = new Date(c.created_at);
    return createdDate >= thirtyDaysAgo;
  });
  
  // Count new leads (those still in Lead stage or recently moved)
  const newLeads = recentCustomers.filter(c => 
    c.stage === 'Lead' || c.stage === 'Survey' || c.stage === 'Design' || c.stage === 'Quote'
  );
  
  // Count disqualified (rejected) in last 30 days
  const disqualified = recentCustomers.filter(c => c.stage === 'Rejected');
  
  return {
    total: newLeads.length,
    disqualified: disqualified.length,
  };
};

/**
 * Generate leads chart data by date ranges (last 30 days broken into 6 periods of 5 days each)
 * Period 1-5 = Days 1-5 ago (most recent)
 * Period 6-10 = Days 6-10 ago
 * etc.
 */
export const generateLeadsChartData = (customers: any[]) => {
  const today = new Date();
  
  // Define 6 periods of 5 days each, going back 30 days
  const periods = [
    { label: "1-5", daysAgoStart: 1, daysAgoEnd: 5 },      // 1-5 days ago
    { label: "6-10", daysAgoStart: 6, daysAgoEnd: 10 },    // 6-10 days ago
    { label: "11-15", daysAgoStart: 11, daysAgoEnd: 15 },  // 11-15 days ago
    { label: "16-20", daysAgoStart: 16, daysAgoEnd: 20 },  // 16-20 days ago
    { label: "21-25", daysAgoStart: 21, daysAgoEnd: 25 },  // 21-25 days ago
    { label: "26-30", daysAgoStart: 26, daysAgoEnd: 30 },  // 26-30 days ago
  ];

  return periods.map(period => {
    // Calculate the date range for this period
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - period.daysAgoStart);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - period.daysAgoEnd);
    startDate.setHours(0, 0, 0, 0);

    // Filter customers created in this period
    const periodCustomers = customers.filter(c => {
      if (!c.created_at) return false;
      const createdDate = new Date(c.created_at);
      return createdDate >= startDate && createdDate <= endDate;
    });

    const newLeads = periodCustomers.filter(c => c.stage !== 'Rejected').length;
    const disqualified = periodCustomers.filter(c => c.stage === 'Rejected').length;

    return {
      date: period.label,
      newLeads,
      disqualified,
    };
  }).reverse(); // Reverse so oldest period (26-30) shows first on chart
};

/**
 * Calculate total revenue from completed jobs
 */
export const calculateTotalRevenue = (jobs: any[]) => {
  return jobs
    .filter(job => job.stage === 'Complete' && job.sold_amount)
    .reduce((sum, job) => sum + (job.sold_amount || 0), 0);
};

/**
 * Generate monthly revenue data for the chart
 */
export const generateRevenueChartData = (jobs: any[]) => {
  const monthlyRevenue: Record<string, number> = {};
  
  jobs.forEach(job => {
    if (job.stage === 'Complete' && job.sold_amount && job.completion_date) {
      const date = new Date(job.completion_date);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = 0;
      }
      monthlyRevenue[monthKey] += job.sold_amount;
    }
  });

  // Get last 12 months
  const months = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months.push({
      month: monthKey,
      revenue: monthlyRevenue[monthKey] || 0,
    });
  }

  return months;
};

/**
 * Generate proposals sent data (quotes sent in last 30 days, broken into 5-day periods)
 */
export const generateProposalsChartData = (jobs: any[]) => {
  const today = new Date();
  
  const periods = [
    { label: "1-5", daysAgoStart: 1, daysAgoEnd: 5 },
    { label: "6-10", daysAgoStart: 6, daysAgoEnd: 10 },
    { label: "11-15", daysAgoStart: 11, daysAgoEnd: 15 },
    { label: "16-20", daysAgoStart: 16, daysAgoEnd: 20 },
    { label: "21-25", daysAgoStart: 21, daysAgoEnd: 25 },
    { label: "26-30", daysAgoStart: 26, daysAgoEnd: 30 },
  ];

  return periods.map(period => {
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - period.daysAgoStart);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - period.daysAgoEnd);
    startDate.setHours(0, 0, 0, 0);

    const proposalsSent = jobs.filter(job => {
      if (job.stage !== 'Quote' || !job.created_at) return false;
      const createdDate = new Date(job.created_at);
      return createdDate >= startDate && createdDate <= endDate;
    }).length;

    return {
      date: period.label,
      proposalsSent,
    };
  }).reverse(); // Oldest first on chart
};

/**
 * Generate recent leads data from customers in Lead stage
 * Returns the most recent 15 customers in Lead stage
 */
export const generateRecentLeadsData = (pipelineItems: any[]) => {
  // Filter for customers in Lead stage
  const leadCustomers = pipelineItems
    .filter(item => item.type === 'customer' && item.stage === 'Lead')
    .map(item => item.customer)
    .filter(Boolean);

  // Sort by created_at (most recent first)
  const sortedLeads = leadCustomers.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });

  // Take the 15 most recent and format for display
  return sortedLeads.slice(0, 15).map(customer => {
    const createdDate = new Date(customer.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let lastActivity = '';
    if (diffMins < 60) {
      lastActivity = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      lastActivity = `${diffHours}h ago`;
    } else {
      lastActivity = `${diffDays}d ago`;
    }

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email || 'No email',
      phone: customer.phone || 'No phone',
      status: 'Lead',
      source: customer.preferred_contact_method || 'Unknown',
      lastActivity,
    };
  });
};

// ============================================
// STATIC DATA (Commented out for now - will implement later)
// ============================================

// export const revenueChartData = [
//   { month: "Jul 2024", revenue: 6700 },
//   { month: "Aug 2024", revenue: 7100 },
//   { month: "Sep 2024", revenue: 6850 },
//   { month: "Oct 2024", revenue: 7500 },
//   { month: "Nov 2024", revenue: 8000 },
//   { month: "Dec 2024", revenue: 8300 },
//   { month: "Jan 2025", revenue: 7900 },
//   { month: "Feb 2025", revenue: 8400 },
//   { month: "Mar 2025", revenue: 8950 },
//   { month: "Apr 2025", revenue: 9700 },
//   { month: "May 2025", revenue: 11200 },
//   { month: "Jun 2025", revenue: 9500 },
// ];

// export const projectRevenueChartData = [
//   { name: "MVP Development", actual: 82000, target: 90000 },
//   { name: "Consultation", actual: 48000, target: 65000 },
//   { name: "Framer Sites", actual: 34000, target: 45000 },
//   { name: "DevOps Support", actual: 77000, target: 90000 },
//   { name: "LLM Training", actual: 68000, target: 80000 },
//   { name: "Product Launch", actual: 52000, target: 70000 },
// ].map((row) => ({
//   ...row,
//   remaining: Math.max(0, row.target - row.actual),
// }));