
"use server";

import { smartSort as smartSortFlow, type SmartSortInput } from "@/ai/flows/smart-sort";
import { generateSubtasks as generateSubtasksFlow, type GenerateSubtasksInput } from "@/ai/flows/generate-subtasks";
import type { Task } from "@/types";

export async function smartSortTasksAction(tasks: Task[]): Promise<Array<Pick<Task, 'id' | 'category' | 'priority'>>> {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  const smartSortInput: SmartSortInput = tasks.map(task => ({
    id: task.id,
    title: task.title,
    notes: task.notes,
  }));

  try {
    const result = await smartSortFlow(smartSortInput);
    // Ensure the result conforms to the expected output structure
    return result.map(item => ({
      id: item.id,
      category: item.category,
      priority: item.priority as 'high' | 'medium' | 'low' | string,
    }));
  } catch (error) {
    console.error("Error in smartSortTasksAction:", error);
    throw new Error("Failed to sort tasks using AI. Please try again.");
  }
}


export async function generateSubtasksAction(input: { title: string, notes?: string }): Promise<string[]> {
  if (!input.title) {
    return [];
  }

  const generateSubtasksInput: GenerateSubtasksInput = {
    title: input.title,
    notes: input.notes,
  };

  try {
    const result = await generateSubtasksFlow(generateSubtasksInput);
    return result.subtasks;
  } catch (error) {
    console.error("Error in generateSubtasksAction:", error);
    throw new Error("Failed to generate sub-tasks using AI. Please try again.");
  }
}
