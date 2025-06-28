
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task, Team, TeamMember } from "@/types";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { generateSubtasksAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";


const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
  priority: z.string().optional(),
  teamId: z.string().optional(),
  assignedTo: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormValues, existingTask?: Task) => void;
  taskToEdit?: Task;
  teams: Team[];
}

export function TaskForm({ isOpen, onClose, onSubmit, taskToEdit, teams }: TaskFormProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  const { toast } = useToast();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      notes: "",
      priority: "",
      teamId: "__none__",
      assignedTo: "__none__",
    },
  });
  
  const selectedTeamId = form.watch('teamId');

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        form.reset({
          title: taskToEdit.title,
          notes: taskToEdit.notes,
          priority: taskToEdit.priority || "",
          teamId: taskToEdit.teamId || "__none__",
          assignedTo: taskToEdit.assignedTo?.id || "__none__",
        });
      } else {
        form.reset({
          title: "",
          notes: "",
          priority: "",
          teamId: "__none__",
          assignedTo: "__none__",
        });
      }
    }
  }, [taskToEdit, form, isOpen]);

  useEffect(() => {
    const fetchMembers = async (teamId: string) => {
      if (teamId === '__none__') {
        setMembers([]);
        form.setValue('assignedTo', '__none__');
        return;
      }
      setIsLoadingMembers(true);
      try {
        const res = await fetch(`/api/teams/${teamId}/members`);
        if (!res.ok) throw new Error('Failed to fetch team members');
        const data = await res.json();
        setMembers(data);
      } catch (error) {
        console.error(error);
        setMembers([]);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    
    if (selectedTeamId) {
      fetchMembers(selectedTeamId);
    }
  }, [selectedTeamId, form]);


  const handleSubmit = (data: TaskFormValues) => {
    onSubmit(data, taskToEdit);
    form.reset();
  };

  const handleGenerateSubtasks = async () => {
    const title = form.getValues('title');
    const notes = form.getValues('notes');
    if (!title) {
        toast({ title: "Title Required", description: "Please enter a title before generating subtasks.", variant: "destructive" });
        return;
    }
    setIsGeneratingSubtasks(true);
    try {
        const subtasks = await generateSubtasksAction({ title, notes });
        const subtaskChecklist = subtasks.map(subtask => `- [ ] ${subtask}`).join('\n');
        const newNotes = notes ? `${notes}\n\n**Generated Subtasks:**\n${subtaskChecklist}` : `**Generated Subtasks:**\n${subtaskChecklist}`;
        form.setValue('notes', newNotes, { shouldValidate: true });
        toast({ title: "Subtasks Generated!", description: "Subtasks have been added to the notes section.", icon: <CheckCircle2 className="h-5 w-5 text-primary" /> });
    } catch (error) {
        toast({ title: "Failed to Generate Subtasks", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsGeneratingSubtasks(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl bg-card rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            {taskToEdit ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {taskToEdit ? "Update the details of your task." : "Fill in the details for your new task."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Finalize project report" {...field} className="bg-background border-input focus:ring-primary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center mb-1">
                    <FormLabel className="text-foreground/80">Notes (Optional)</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs"
                      onClick={handleGenerateSubtasks}
                      disabled={!form.watch('title') || isGeneratingSubtasks}
                    >
                      {isGeneratingSubtasks ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Wand2 className="mr-1 h-4 w-4 text-accent" />}
                      Generate Subtasks
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea placeholder="Add any relevant details or context..." className="resize-none bg-background border-input focus:ring-primary" rows={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input focus:ring-primary"><SelectValue placeholder="Select priority" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Assign to Team</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input focus:ring-primary"><SelectValue placeholder="Select a team" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No Team / Personal</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Assign to Member</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingMembers || selectedTeamId === '__none__' || members.length === 0}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input focus:ring-primary">
                          {isLoadingMembers && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                         {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="mt-8">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant="default">
                {taskToEdit ? "Save Changes" : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
