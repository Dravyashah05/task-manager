
"use client";

import React, { createContext, useState, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  removeNotification: (notificationId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (status !== 'authenticated') {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        console.error("Failed to fetch notifications:", res.status, res.statusText);
        // We don't throw here to avoid unhandled promise rejections on intermittent network issues.
        return;
      }
      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [status, fetchNotifications]);

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const value = { notifications, isLoading, fetchNotifications, removeNotification };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
