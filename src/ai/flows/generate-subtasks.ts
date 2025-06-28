
'use server';
/**
 * @fileOverview A flow to generate sub-tasks for a given task.
 *
 * - generateSubtasks - A function that takes a task's title and notes and returns a list of suggested sub-tasks.
 * - GenerateSubtasksInput - The input type for the generateSubtasks function.
 * - GenerateSubtasksOutput - The return type for the generateSubtasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateSubtasksInputSchema = z.object({
  title: z.string().describe('The title of the main task.'),
  notes: z.string().optional().describe('The notes or description of the main task.'),
});
export type GenerateSubtasksInput = z.infer<typeof GenerateSubtasksInputSchema>;

export const GenerateSubtasksOutputSchema = z.object({
  subtasks: z.array(z.string()).describe('An array of generated sub-task descriptions.'),
});
export type GenerateSubtasksOutput = z.infer<typeof GenerateSubtasksOutputSchema>;

export async function generateSubtasks(input: GenerateSubtasksInput): Promise<GenerateSubtasksOutput> {
  return generateSubtasksFlow(input);
}

const generateSubtasksPrompt = ai.definePrompt({
  name: 'generateSubtasksPrompt',
  input: {schema: GenerateSubtasksInputSchema},
  output: {schema: GenerateSubtasksOutputSchema},
  system: `You are an expert project manager. Your goal is to break down a given task into smaller, actionable sub-tasks.
Generate a list of 2 to 5 sub-tasks. Each sub-task should be a clear, concise action item.
Return the sub-tasks as a JSON object with a single key "subtasks" which is an array of strings.
Do not include any introductory text, closing remarks, or markdown. Your response must be only the JSON object.`,
  prompt: `Task Title: "{{title}}"
Task Notes: "{{notes}}"

Based on the title and notes, generate a list of sub-tasks.`,
});

const generateSubtasksFlow = ai.defineFlow(
  {
    name: 'generateSubtasksFlow',
    inputSchema: GenerateSubtasksInputSchema,
    outputSchema: GenerateSubtasksOutputSchema,
  },
  async (input) => {
    const { output } = await generateSubtasksPrompt(input);
    if (!output) {
      throw new Error('AI model did not return a parsable output for sub-task generation.');
    }
    return output;
  }
);
