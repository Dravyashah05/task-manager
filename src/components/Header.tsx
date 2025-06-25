
"use client";

import React, { useState, useEffect } from 'react';
import { LogoIcon } from './icons/LogoIcon';
import { ThemeToggle } from './ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, LogIn, LogOut, User, Settings as SettingsIcon, Bell, Home as HomeIcon, Users, Info, Loader2, Check, X, CheckCircle2, MessageSquare, CheckSquare, UserPlus, FilePlus2, Trophy } from "lucide-react";
import Link from 'next/link';
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Notification, NotificationStyle, NotificationType } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/context/NotificationContext';

const NotificationBellButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { 'aria-label': string, notificationCount?: number }
>(({ notificationCount = 0, ...props }, ref) => (
  <Button ref={ref} variant="outline" size="icon" className="h-9 w-9 relative" {...props}>
    <Bell className="h-5 w-5" />
    {notificationCount > 0 && (
      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
        {notificationCount}
      </span>
    )}
    <span className="sr-only">Notifications</span>
  </Button>
));
NotificationBellButton.displayName = "NotificationBellButton";

function JoinRequestNotification({ notification, onHandled }: { notification: Notification, onHandled: (notificationId: string) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<'accept' | 'reject' | null>(null);

  const handleRequest = async (action: 'accept' | 'reject') => {
    if (!notification.data.teamId || !notification.data.requestingUserId) return;
    setIsLoading(action);
    try {
      const res = await fetch(`/api/teams/${notification.data.teamId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestingUserId: notification.data.requestingUserId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: `Request ${action}ed!`, icon: <CheckCircle2 className="h-5 w-5 text-primary" /> });
      onHandled(notification.id);
    } catch (error) {
      toast({ title: `Failed to ${action} request`, description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="p-3 hover:bg-muted/50 rounded-lg">
      <p className="text-sm mb-2">{notification.message}</p>
      <div className="text-xs text-muted-foreground mb-3">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 px-2 bg-green-500 hover:bg-green-600 text-white" onClick={() => handleRequest('accept')} disabled={!!isLoading}>{isLoading === 'accept' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}Accept</Button>
        <Button size="sm" className="h-7 px-2" variant="destructive" onClick={() => handleRequest('reject')} disabled={!!isLoading}>{isLoading === 'reject' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />}Decline</Button>
      </div>
    </div>
  );
}

function TeamInviteNotification({ notification, onHandled }: { notification: Notification, onHandled: (notificationId: string) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<'accept' | 'reject' | null>(null);

  const handleInvite = async (action: 'accept' | 'reject') => {
    setIsLoading(action);
    try {
      const res = await fetch(`/api/invites/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: `Invite ${action}ed!`, icon: <CheckCircle2 className="h-5 w-5 text-primary" /> });
      onHandled(notification.id);
    } catch (error) {
      toast({ title: `Failed to ${action} invite`, description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="p-3 hover:bg-muted/50 rounded-lg">
      <p className="text-sm mb-2">{notification.message}</p>
      <div className="text-xs text-muted-foreground mb-3">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 px-2 bg-green-500 hover:bg-green-600 text-white" onClick={() => handleInvite('accept')} disabled={!!isLoading}>{isLoading === 'accept' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}Accept</Button>
        <Button size="sm" className="h-7 px-2" variant="destructive" onClick={() => handleInvite('reject')} disabled={!!isLoading}>{isLoading === 'reject' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />}Decline</Button>
      </div>
    </div>
  );
}

function GenericNotification({ notification }: { notification: Notification }) {
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'WELCOME_TO_TEAM':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'TASK_CREATED':
        return <FilePlus2 className="h-4 w-4 text-blue-500" />;
      case 'TASK_UPDATED':
        return <CheckSquare className="h-4 w-4 text-purple-500" />;
      case 'TASK_ASSIGNED':
        return <UserPlus className="h-4 w-4 text-cyan-500" />;
      case 'NEW_COMMENT':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-3 hover:bg-muted/50 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="mt-1">{getIcon(notification.type)}</span>
        <div className="flex-1">
          <p className="text-sm">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}


const NotificationList = ({ notifications, onNotificationHandled }: { notifications: Notification[], onNotificationHandled: (notificationId: string) => void }) => {
  if (notifications.length === 0) {
    return (
       <div className="p-4 py-8"><p className="text-sm text-muted-foreground text-center">No new notifications yet.</p></div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {notifications.map(notification => {
        switch (notification.type) {
          case 'JOIN_REQUEST':
            return <JoinRequestNotification key={notification.id} notification={notification} onHandled={onNotificationHandled} />;
          case 'TEAM_INVITE':
            return <TeamInviteNotification key={notification.id} notification={notification} onHandled={onNotificationHandled} />;
          default:
            return <GenericNotification key={notification.id} notification={notification} />;
        }
      })}
    </div>
  )
};

export function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isLoading = status === "loading";

  const [mounted, setMounted] = useState(false);
  const { notifications, isLoading: isLoadingNotifications, removeNotification } = useNotifications();
  
  const notificationStyle: NotificationStyle = session?.user?.notificationStyle ?? 'dock';

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const getUserInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  const notificationContent = (
    <>
      {isLoadingNotifications && notifications.length === 0 ? (
        <div className="p-4 py-8 flex justify-center items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <NotificationList notifications={notifications} onNotificationHandled={removeNotification} />
      )}
    </>
  );

  return (
    <header className="py-4 px-4 sm:px-6 lg:px-8 border-b border-border/50 shadow-sm bg-card">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <LogoIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-headline font-semibold text-foreground">TaskFlow</h1>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {status === 'authenticated' && (
            <>
              {mounted && notificationStyle === "dock" && (
                <Sheet>
                  <SheetTrigger asChild><NotificationBellButton aria-label="View notifications (Dock)" notificationCount={notifications.length} /></SheetTrigger>
                  <SheetContent side="right"><SheetHeader><SheetTitle>Notifications</SheetTitle><SheetDescription>Here are your latest updates.</SheetDescription></SheetHeader>{notificationContent}<SheetFooter><SheetClose asChild><Button variant="outline" className="w-full">Close</Button></SheetClose></SheetFooter></SheetContent>
                </Sheet>
              )}
              {mounted && notificationStyle === "float" && (
                <Popover>
                  <PopoverTrigger asChild><NotificationBellButton aria-label="View notifications (Float)" notificationCount={notifications.length} /></PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end"><div className="p-4 border-b"><h3 className="text-lg font-semibold leading-none tracking-tight">Notifications</h3><p className="text-sm text-muted-foreground">Here are your latest updates.</p></div>{notificationContent}</PopoverContent>
                </Popover>
              )}
              {!mounted && (<Button variant="outline" size="icon" className="h-9 w-9" aria-label="View notifications" disabled><Bell className="h-5 w-5" /></Button>)}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                {isLoading ? (<Menu className="h-5 w-5 animate-pulse" />) : session?.user?.image ? (<Avatar className="h-8 w-8"><AvatarImage src={session.user.image} alt={session.user.name || "User Avatar"} /><AvatarFallback>{getUserInitials(session.user.name)}</AvatarFallback></Avatar>) : session?.user ? (<Avatar className="h-8 w-8"><AvatarFallback>{getUserInitials(session.user.name)}</AvatarFallback></Avatar>) : (<Menu className="h-5 w-5" />)}
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isLoading ? (<DropdownMenuLabel>Loading...</DropdownMenuLabel>) : session?.user ? (
                <>
                  <DropdownMenuLabel className="font-normal"><div className="flex flex-col space-y-1"><p className="text-sm font-medium leading-none">{session.user.name || "User"}</p><p className="text-xs leading-none text-muted-foreground">{session.user.email}</p></div></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className={cn(pathname === "/" && "text-primary font-semibold")}><Link href="/" className="flex items-center"><HomeIcon className="mr-2 h-4 w-4" />Home</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(pathname === "/profile" && "text-primary font-semibold")}><Link href="/profile" className="flex items-center"><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(pathname.startsWith("/analytics") && "text-primary font-semibold")}><Link href="/analytics" className="flex items-center"><Trophy className="mr-2 h-4 w-4" />Analytics</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(pathname === "/teams" && "text-primary font-semibold")}><Link href="/teams" className="flex items-center"><Users className="mr-2 h-4 w-4" />Teams</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(pathname === "/settings" && "text-primary font-semibold")}><Link href="/settings" className="flex items-center"><SettingsIcon className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(pathname === "/about" && "text-primary font-semibold")}><Link href="/about" className="flex items-center"><Info className="mr-2 h-4 w-4" />About</Link></DropdownMenuItem>
                  
                  {session.user.role === 'admin' && (
                    <React.Fragment>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className={cn(pathname.startsWith('/admin') && "text-primary font-semibold")}>
                          <Link href="/admin" className="flex items-center">
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            Admin Panel
                          </Link>
                      </DropdownMenuItem>
                    </React.Fragment>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center cursor-pointer"><LogOut className="mr-2 h-4 w-4" />Logout</DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem asChild className={cn(pathname === "/" && "text-primary font-semibold")}><Link href="/" className="flex items-center"><HomeIcon className="mr-2 h-4 w-4" />Home</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signIn("google", { callbackUrl: "/" })} className="flex items-center cursor-pointer"><LogIn className="mr-2 h-4 w-4" />Login with Google</DropdownMenuItem>
                   <DropdownMenuItem onClick={() => { const mainPageEmailInput = document.getElementById('email-login'); if (mainPageEmailInput) mainPageEmailInput.focus(); else router.push('/'); }} className="flex items-center cursor-pointer"><LogIn className="mr-2 h-4 w-4" />Login with Email</DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(pathname === "/about" && "text-primary font-semibold")}><Link href="/about" className="flex items-center"><Info className="mr-2 h-4 w-4" />About</Link></DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
