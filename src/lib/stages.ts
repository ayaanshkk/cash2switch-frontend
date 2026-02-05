/**
 * Stage/Status definitions for Leads
 * Maps status display names to their stage_ids in the database
 */

export interface StageOption {
  name: string;
  id: number;
  color: string;
  dotColor: string;
}

// Default stage IDs - adjust these based on your database
// These are the IDs from Stage_Master table
export const STAGES: Record<string, StageOption> = {
  'Not Called': {
    name: 'Not Called',
    id: 1, // Adjust to match your database
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dotColor: 'bg-gray-500',
  },
  'Called': {
    name: 'Called',
    id: 2, // Adjust to match your database
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  'Priced': {
    name: 'Priced',
    id: 3, // Adjust to match your database
    color: 'bg-green-100 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
  },
  'Lost': {
    name: 'Lost',
    id: 4, // Adjust to match your database
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
  },
};

/**
 * Get stage option by ID
 */
export function getStageById(id: number | null): StageOption | undefined {
  if (id === null) return undefined;
  return Object.values(STAGES).find(stage => stage.id === id);
}

/**
 * Get stage option by name
 */
export function getStageName(id: number | null): string {
  if (id === null) return 'Not Called';
  const stage = getStageById(id);
  return stage ? stage.name : 'Not Called';
}

/**
 * Get stage option by display name
 */
export function getStageByName(name: string | null): StageOption | undefined {
  if (!name) return undefined;
  return STAGES[name];
}

/**
 * Get color for a stage by name or ID
 */
export function getStageColor(stageNameOrId: string | number | null): string {
  if (typeof stageNameOrId === 'number') {
    const stage = getStageById(stageNameOrId);
    return stage?.color || STAGES['Not Called'].color;
  }
  const stage = getStageByName(stageNameOrId);
  return stage?.color || STAGES['Not Called'].color;
}

/**
 * Get dot color for a stage by name or ID
 */
export function getStageDotColor(stageNameOrId: string | number | null): string {
  if (typeof stageNameOrId === 'number') {
    const stage = getStageById(stageNameOrId);
    return stage?.dotColor || STAGES['Not Called'].dotColor;
  }
  const stage = getStageByName(stageNameOrId);
  return stage?.dotColor || STAGES['Not Called'].dotColor;
}

/**
 * Get list of all available stage options
 */
export function getAllStages(): StageOption[] {
  return Object.values(STAGES);
}
