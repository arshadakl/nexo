import * as React from 'react';
import {
  Plus,
  CheckCircle2,
  Activity,
  Shield,
  Zap,
  Trash2,
  Star,
  RefreshCw,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAIProviders,
  useAIProviderPresets,
  useCreateAIProvider,
  useTestAIProvider,
  useSetDefaultAIProvider,
  useDeleteAIProvider,
} from '@/hooks/useAIProviders';
import type { AIProviderPreset } from '@shared/types/ai.types';

export function AIAutomationView() {
  const { data: providers, isLoading, isError, error, refetch } = useAIProviders();
  const { data: presets } = useAIProviderPresets();

  const createProviderMutation = useCreateAIProvider();
  const testProviderMutation = useTestAIProvider();
  const setDefaultMutation = useSetDefaultAIProvider();
  const deleteMutation = useDeleteAIProvider();

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [testNotification, setTestNotification] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Add Provider Form state
  const [formData, setFormData] = React.useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
    temperature: 0.2,
    maxTokens: 600,
    isDefault: false,
  });

  const handleSelectPreset = (preset: AIProviderPreset) => {
    setFormData((prev) => ({
      ...prev,
      name: preset.name,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.baseUrl || !formData.apiKey || !formData.defaultModel) {
      return;
    }

    try {
      await createProviderMutation.mutateAsync({
        name: formData.name,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey,
        defaultModel: formData.defaultModel,
        temperature: Number(formData.temperature),
        maxTokens: Number(formData.maxTokens),
        isDefault: formData.isDefault,
      });

      setShowAddModal(false);
      setFormData({
        name: '',
        baseUrl: '',
        apiKey: '',
        defaultModel: '',
        temperature: 0.2,
        maxTokens: 600,
        isDefault: false,
      });
    } catch (err) {
      console.error('Failed to create provider', err);
    }
  };

  const handleRunTest = async (providerId: string) => {
    setTestingId(providerId);
    setTestNotification(null);
    try {
      const result = await testProviderMutation.mutateAsync(providerId);
      setTestNotification({
        success: result.success,
        message: result.message,
      });
    } catch (err: unknown) {
      setTestNotification({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed to connect',
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Automation Safety & Governance */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/20 text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Automation Safety & Governance</CardTitle>
                <CardDescription>Server-side pre-send validation and emergency kill switches</CardDescription>
              </div>
            </div>
            <Badge variant="success">All Systems Guarded</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <p className="font-semibold text-foreground">Global Master AI</p>
                <p className="text-muted-foreground text-[10px]">Instant kill switch</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <p className="font-semibold text-foreground">Instagram DM Auto-Reply</p>
                <p className="text-muted-foreground text-[10px]">Eligible in-window DMs</p>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <p className="font-semibold text-foreground">WhatsApp Auto-Reply</p>
                <p className="text-muted-foreground text-[10px]">24h customer window</p>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic AI Providers Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Configured OpenAI-Standard Providers
          </h2>
          <p className="text-xs text-muted-foreground">
            Easily replaceable endpoints. Supports Groq, OpenRouter, OpenAI, DeepSeek, or self-hosted vLLM.
          </p>
        </div>

        <Button size="sm" className="gap-1.5 text-xs h-9" onClick={() => setShowAddModal(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Provider</span>
        </Button>
      </div>

      {/* Test Notification Banner */}
      {testNotification && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            testNotification.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {testNotification.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            )}
            <span>{testNotification.message}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2"
            onClick={() => setTestNotification(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* 4-State Handling for Providers List */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/50 bg-destructive/5 p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <div className="text-sm font-semibold text-foreground">Failed to load AI providers</div>
          <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </Card>
      ) : !providers || providers.length === 0 ? (
        <Card className="p-8 text-center border-dashed space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">No AI Providers Configured Yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your first OpenAI-standard API provider (Groq, OpenRouter, OpenAI, or DeepSeek) to automate visa DM replies.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider Now</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {providers.map((p) => {
            const isCurrentlyTesting = testingId === p.id;
            return (
              <Card
                key={p.id}
                className={
                  p.isDefault
                    ? 'border-primary/50 shadow-sm shadow-primary/5 bg-card/90'
                    : 'bg-card/60'
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      {p.name}
                    </CardTitle>
                    {p.isDefault && (
                      <Badge variant="default" className="text-[10px] gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="font-mono text-[11px] truncate">
                    {p.baseUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Model ID:</span>
                    <span className="font-mono font-medium text-foreground">{p.defaultModel}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Encrypted Key:</span>
                    <span className="font-mono text-muted-foreground">{p.maskedApiKey}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Health Status:</span>
                    <span
                      className={`font-semibold capitalize ${
                        p.lastHealthStatus === 'healthy'
                          ? 'text-emerald-400'
                          : p.lastHealthStatus === 'unauthorized'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {p.lastHealthStatus}
                      {p.lastHealthLatencyMs ? ` (${p.lastHealthLatencyMs}ms)` : ''}
                    </span>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-8 gap-1.5"
                        disabled={isCurrentlyTesting}
                        onClick={() => handleRunTest(p.id)}
                      >
                        {isCurrentlyTesting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Activity className="w-3.5 h-3.5" />
                        )}
                        <span>{isCurrentlyTesting ? 'Testing...' : 'Test Connection'}</span>
                      </Button>

                      {!p.isDefault && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs h-8 px-2.5"
                          title="Set as Default Provider"
                          onClick={() => setDefaultMutation.mutate(p.id)}
                        >
                          <Star className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
                        title="Delete Provider"
                        onClick={() => {
                          if (confirm(`Delete provider "${p.name}"?`)) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Custom Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Add OpenAI-Compatible Provider</CardTitle>
              <CardDescription className="text-xs">
                Pick a quick preset or enter your custom endpoint URL and model. Stored securely with AES-256-GCM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                {/* Preset Selector */}
                {presets && presets.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                      Quick Preset
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {presets.map((preset) => (
                        <Button
                          key={preset.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] truncate"
                          onClick={() => handleSelectPreset(preset)}
                        >
                          {preset.name.split(' ')[0]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Provider Label *</label>
                  <Input
                    required
                    placeholder="e.g. Groq Production"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Base API URL *</label>
                  <Input
                    required
                    type="url"
                    placeholder="https://api.groq.com/openai/v1"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">API Key *</label>
                  <Input
                    required
                    type="password"
                    placeholder="sk-..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Model Identifier *</label>
                    <Input
                      required
                      placeholder="llama-3.3-70b-versatile"
                      value={formData.defaultModel}
                      onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Max Output Tokens</label>
                    <Input
                      type="number"
                      min={50}
                      max={4096}
                      value={formData.maxTokens}
                      onChange={(e) => setFormData({ ...formData, maxTokens: Number(e.target.value) })}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createProviderMutation.isPending}
                  >
                    {createProviderMutation.isPending ? 'Saving...' : 'Save & Encrypt Key'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
