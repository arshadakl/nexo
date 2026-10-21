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
import { LoginView } from './views/LoginView';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { useConversations } from './hooks/useConversations';

function Dashboard() {
  const [currentTab, setCurrentTab] = React.useState<NavItemKey>('overview');
  const [inboxConversationId, setInboxConversationId] = React.useState<string | null>(null);

  const { data: conversations } = useConversations();
  const unreadCount = React.useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }, [conversations]);

  const handleNavigateToInbox = (conversationId?: string) => {
    if (conversationId) {
      setInboxConversationId(conversationId);
    }
    setCurrentTab('inbox');
  };

  const handleNavigateTab = (tab: NavItemKey) => {
    setCurrentTab(tab);
  };

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewView onNavigateTab={handleNavigateTab} />;
      case 'inbox':
        return <InboxView initialConversationId={inboxConversationId} />;
      case 'leads':
        return <LeadsView onNavigateToInbox={handleNavigateToInbox} />;
      case 'ai-automation':
        return <AIAutomationView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView onNavigateTab={handleNavigateTab} />;
    }
  };

  return (
    <AppShell currentTab={currentTab} onTabChange={setCurrentTab} unreadCount={unreadCount}>
      {renderCurrentView()}
    </AppShell>
  );
}

function MainContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-muted-foreground text-xs font-mono">
        Authenticating session &lt; 2ms...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <Dashboard />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

