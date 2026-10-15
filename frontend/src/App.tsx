import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queries/queryClient';
import { AppShell } from './components/layout/AppShell';
import type { NavItemKey } from './components/layout/Sidebar';
import { OverviewView } from './views/OverviewView';
import { InboxView } from './views/InboxView';
import { LeadsView } from './views/LeadsView';
import { AIAutomationView } from './views/AIAutomationView';
import { IntegrationsView } from './views/IntegrationsView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const [currentTab, setCurrentTab] = React.useState<NavItemKey>('overview');

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewView />;
      case 'inbox':
        return <InboxView />;
      case 'leads':
        return <LeadsView />;
      case 'ai-automation':
        return <AIAutomationView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell currentTab={currentTab} onTabChange={setCurrentTab} unreadCount={1}>
        {renderCurrentView()}
      </AppShell>
    </QueryClientProvider>
  );
}

export default App;
