
"use client";

import React, { createContext, useState, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  removeNotification: (notificationId: string) => void;
  markAllAsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

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
    if (status === 'authenticated') {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }
  }, [status, fetchNotifications]);

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };
  
  const markAllAsRead = async () => {
    // Optimistically update UI
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      // Revert optimistic update on failure
      fetchNotifications();
    }
  };

  const clearAllNotifications = async () => {
    const oldNotifications = notifications;
    setNotifications([]); // Optimistic update
    try {
      await fetch('/api/notifications/clear', { method: 'DELETE' });
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      setNotifications(oldNotifications); // Revert on failure
    }
  };

  const value = { notifications, unreadCount, isLoading, fetchNotifications, removeNotification, markAllAsRead, clearAllNotifications };

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
