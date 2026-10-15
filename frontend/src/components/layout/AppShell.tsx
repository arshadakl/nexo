import * as React from 'react';
import { Sidebar, type NavItemKey } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  currentTab: NavItemKey;
  onTabChange: (tab: NavItemKey) => void;
  unreadCount?: number;
  children: React.ReactNode;
}

export function AppShell({ currentTab, onTabChange, unreadCount = 0, children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <Sidebar currentTab={currentTab} onTabChange={onTabChange} unreadCount={unreadCount} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header currentTab={currentTab} />
        <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-background via-background to-secondary/10">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
