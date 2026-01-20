import { z } from "zod";

// Add this export for recentLeadSchema
export const recentLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  status: z.string(),
  source: z.string(),
  lastActivity: z.string(),
});

export const sectionSchema = z.object({
  id: z.string(),
  header: z.string(),
  type: z.string(),
  status: z.enum(["Done", "In Progress", "Pending"]),
  target: z.union([z.number(), z.string()]),
  limit: z.union([z.number(), z.string()]),
  reviewer: z.string(),
});

export type RecentLead = z.infer<typeof recentLeadSchema>; // <-- Add this type
export type Section = z.infer<typeof sectionSchema>;
