import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queries/queryClient';
import { AppShell } from './components/layout/AppShell';
import type { NavItemKey } from './components/layout/Sidebar';
import { OverviewView } from './views/OverviewView';
import { InboxView } from './views/InboxView';
import { LeadsView } from './views/LeadsView';
import { ExpertsView } from './views/ExpertsView';
import { AIAutomationView } from './views/AIAutomationView';
import { IntegrationsView } from './views/IntegrationsView';
import { SettingsView } from './views/SettingsView';
import { LoginView } from './views/LoginView';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { useNavigation } from './hooks/useNavigation';
import { inboxHref, navigate, screenPaths } from './lib/navigation';
import { ComposerProvider } from './lib/ComposerContext';

function Dashboard() {
  const route = useNavigation();
  const currentTab = route.screen;

  const handleNavigateToInbox = (conversationId?: string) => {
    navigate(
      inboxHref({
        conversationId: conversationId ?? null,
        channel: 'all',
        search: '',
        humanOnly: false,
      }),
    );
  };

  const handleNavigateTab = (tab: NavItemKey) => {
    navigate(screenPaths[tab]);
  };

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewView onNavigateTab={handleNavigateTab} />;
      case 'inbox':
        return (
          <InboxView
            route={route}
            onRouteChange={(patch, replace = false) =>
              navigate(inboxHref({ ...route, ...patch }), replace)
            }
          />
        );
      case 'leads':
        return (
          <LeadsView
            route={route}
            onNavigateToInbox={handleNavigateToInbox}
          />
        );
      case 'experts':
        return <ExpertsView route={route} />;
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
    <ComposerProvider>
      <AppShell currentTab={currentTab} onTabChange={handleNavigateTab}>
        {renderCurrentView()}
      </AppShell>
    </ComposerProvider>
  );
}

function MainContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        role="status"
        className="min-h-dvh flex items-center justify-center bg-background text-muted-foreground text-sm"
      >
        Loading your workspace…
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <Dashboard key={`${user.tenantId}:${user.id}`} />;
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
