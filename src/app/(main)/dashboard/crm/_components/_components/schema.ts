import { z } from "zod";

export const recentLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  status: z.string(),
  source: z.string(),
  lastActivity: z.string(),
});

// Add the sectionSchema that columns.tsx is expecting
export const sectionSchema = z.object({
  id: z.string(),
  header: z.string(),
  type: z.string(),
  status: z.enum(["Done", "In Progress", "Pending"]),
  target: z.number().or(z.string()),
  limit: z.number().or(z.string()),
  reviewer: z.string(),
});

export type RecentLead = z.infer<typeof recentLeadSchema>;
export type Section = z.infer<typeof sectionSchema>;
