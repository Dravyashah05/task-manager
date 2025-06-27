
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2, BarChart, PieChart, TrendingUp, CheckCircle, ListTodo, CircleDashed } from "lucide-react";
import { Bar, Pie, Cell, Tooltip, Legend, ComposedChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LineChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

interface AnalyticsData {
  totalTasks: number;
  completedTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  statusData: { name: string; value: number; fill: string }[];
  priorityData: { name: string; value: number; fill: string }[];
  topCategoriesData: { name: string; total: number }[];
  completionTrendData: { date: string; count: number }[];
}

const statusChartConfig = {
    tasks: { label: "Tasks" },
    done: { label: "Done", color: "hsl(var(--chart-1))" },
    "in-progress": { label: "In Progress", color: "hsl(var(--chart-2))" },
    todo: { label: "To-Do", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const priorityChartConfig = {
    tasks: { label: "Tasks" },
    high: { label: "High", color: "hsl(var(--chart-1))" },
    medium: { label: "Medium", color: "hsl(var(--chart-2))" },
    low: { label: "Low", color: "hsl(var(--chart-3))" },
    none: { label: "None", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

const categoriesChartConfig = {
    total: { label: "Tasks", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const trendChartConfig = {
    count: { label: "Completed", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;


export default function AnalyticsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      const data = await res.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAnalyticsData();
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router, fetchAnalyticsData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Button variant="outline" onClick={() => router.back()} className="self-start mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
            <p>No data to display.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <Button variant="outline" onClick={() => router.back()} className="self-start mb-4 sm:mb-0">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tasks
              </Button>
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Tasks</CardTitle><ListTodo className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.totalTasks}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle><CheckCircle className="h-4 w-4 text-green-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.completedTasks}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">In Progress</CardTitle><CircleDashed className="h-4 w-4 text-blue-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.inProgressTasks}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">To-Do</CardTitle><ListTodo className="h-4 w-4 text-yellow-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.todoTasks}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3">
                <CardHeader><CardTitle>Top Categories</CardTitle><CardDescription>Tasks count by category.</CardDescription></CardHeader>
                <CardContent className="h-[300px] w-full">
                    <ChartContainer config={categoriesChartConfig} className="w-full h-full">
                        <BarChart layout="vertical" data={analyticsData.topCategoriesData} margin={{ left: 30 }}>
                             <CartesianGrid horizontal={false} />
                            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} />
                            <XAxis type="number" hide />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" hideLabel />} />
                            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Tasks by Status</CardTitle></CardHeader>
                <CardContent className="h-[300px] w-full flex items-center justify-center">
                    <ChartContainer config={statusChartConfig} className="w-full h-full">
                        <PieChart>
                             <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={analyticsData.statusData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                {analyticsData.statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                            </Pie>
                             <Legend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                <CardHeader><CardTitle>Completion Trend</CardTitle><CardDescription>Tasks completed over the last 7 days.</CardDescription></CardHeader>
                <CardContent className="h-[300px] w-full">
                    <ChartContainer config={trendChartConfig} className="w-full h-full">
                        <LineChart data={analyticsData.completionTrendData} margin={{ left: -20, right: 20 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(5)} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                            <Line dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} dot={true} />
                        </LineChart>
                    </ChartContainer>
                </CardContent>
            </Card>
             <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Tasks by Priority</CardTitle></CardHeader>
                <CardContent className="h-[300px] w-full flex items-center justify-center">
                    <ChartContainer config={priorityChartConfig} className="w-full h-full">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={analyticsData.priorityData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                 {analyticsData.priorityData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                            </Pie>
                            <Legend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
