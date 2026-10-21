import * as React from 'react';
import {
  Plus,
  CheckCircle2,
  Activity,
  Zap,
  Trash2,
  Star,
  RefreshCw,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  BookOpen,
  Lock,
  Unlock,
  ShieldCheck,
  Check,
  Sparkles,
  Bot,
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
import {
  useKnowledgeItems,
  useTogglePriceApproval,
  useCreateKnowledgeItem,
  useDeleteKnowledgeItem,
} from '@/hooks/useKnowledge';
import type { AIProviderPreset } from '@shared/types/ai.types';
import type { KnowledgeCategory, BusinessKnowledgeItem } from '@shared/types/knowledge.types';

export function AIAutomationView() {
  const { data: providers, isLoading, refetch } = useAIProviders();
  const { data: presets } = useAIProviderPresets();
  const { data: knowledgeItems, isLoading: isLoadingKnowledge, refetch: refetchKnowledge } = useKnowledgeItems();

  const createProviderMutation = useCreateAIProvider();
  const testProviderMutation = useTestAIProvider();
  const setDefaultMutation = useSetDefaultAIProvider();
  const deleteMutation = useDeleteAIProvider();

  const togglePriceApprovalMutation = useTogglePriceApproval();
  const createKnowledgeMutation = useCreateKnowledgeItem();
  const deleteKnowledgeMutation = useDeleteKnowledgeItem();

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showAddKnowledgeModal, setShowAddKnowledgeModal] = React.useState(false);
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

  // Add Knowledge Form state
  const [knowledgeForm, setKnowledgeForm] = React.useState<{
    category: KnowledgeCategory;
    title: string;
    content: string;
    priceAed: string;
    isApprovedByClient: boolean;
  }>({
    category: 'residency_package',
    title: '',
    content: '',
    priceAed: '',
    isApprovedByClient: false,
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
      const res = await testProviderMutation.mutateAsync(providerId);
      setTestNotification({
        success: res.success,
        message: res.success
          ? `Online! Handshake latency: ${res.latencyMs}ms. Model: ${res.model}. Message: "${res.message}"`
          : `Handshake failed: ${res.message}`,
      });
    } catch (err: any) {
      setTestNotification({
        success: false,
        message: err.message || 'Error executing connection handshake',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleApproval = (item: BusinessKnowledgeItem) => {
    const nextApproved = !item.isApprovedByClient;
    togglePriceApprovalMutation.mutate({
      id: item.id,
      isApproved: nextApproved,
      notes: nextApproved ? 'Approved by client via dashboard' : 'Approval revoked by client',
    });
  };

  const handleCreateKnowledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) return;

    createKnowledgeMutation.mutate(
      {
        category: knowledgeForm.category,
        title: knowledgeForm.title.trim(),
        content: knowledgeForm.content.trim(),
        priceAed: knowledgeForm.priceAed ? Number(knowledgeForm.priceAed) : undefined,
        isApprovedByClient: knowledgeForm.isApprovedByClient,
      },
      {
        onSuccess: () => {
          setShowAddKnowledgeModal(false);
          setKnowledgeForm({
            category: 'residency_package',
            title: '',
            content: '',
            priceAed: '',
            isApprovedByClient: false,
          });
          refetchKnowledge();
        },
      }
    );
  };

  const handleDeleteKnowledge = (id: string, title: string) => {
    if (window.confirm(`Delete knowledge item "${title}"?`)) {
      deleteKnowledgeMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Resider AI Engine & Operational Guardrails
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure conversation flow rules, escrowed pricing approvals, and OpenAI-compatible inference providers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => {
              refetch();
              refetchKnowledge();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          SECTION A: RESIDER CONVERSATION FLOW ENGINE & GUARDRAIL SPECIFICATION
      ========================================================================== */}
      <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-background to-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Resider Conversation Protocol v1.0 (Specification Conformance)
            </CardTitle>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Guardrails Enforced
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Client-approved conversation boundaries for UAE residency, Malayalam tone matching, and partner handovers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                1. Voice & Script Matching
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Malayalam script responses for Malayalam queries; "we" and "our team"; friendly, brief, and never claiming to be Anas personally.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                2. One Question At A Time
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Never interrogate. Answer the customer's question first, then ask only 1 concise follow-up to move the inquiry forward.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                3. Privacy & ID Shield
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Strict ban on asking for passport copies, nationality, or sensitive documents in chat. Those are handled later by the team.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                9. Escrowed Price Shield
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Prices (AED 7k–7.5k, AED 7.5k, AED 15k–20k) are strictly blocked from AI quotation until marked approved by the client below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          SECTION B: BUSINESS KNOWLEDGE BASE & CLIENT PRICING APPROVALS (Section 9)
      ========================================================================== */}
      <Card className="shadow-sm border-border/80">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Knowledge Base & Escrowed Pricing Approvals
              </CardTitle>
              <CardDescription className="text-xs">
                Section 9 Guardrail: Toggle client approval to allow or block Resider AI from quoting specific packages and prices
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1.5"
              onClick={() => setShowAddKnowledgeModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Knowledge Item</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Package / Item Title</th>
                  <th className="px-5 py-3 font-semibold">Price (AED)</th>
                  <th className="px-5 py-3 font-semibold">AI Quotation Permission</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoadingKnowledge ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-5 py-3.5"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-5 py-3.5"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-5 py-3.5"><Skeleton className="h-6 w-32" /></td>
                      <td className="px-5 py-3.5 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : knowledgeItems && knowledgeItems.length > 0 ? (
                  knowledgeItems.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.category.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-foreground">{item.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[360px]">
                          {item.content}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold">
                        {item.priceAed !== null && item.priceAed !== undefined ? (
                          <span>AED {item.priceAed.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.isApprovedByClient ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Unlock className="w-3 h-3" />
                            Approved by Client (AI Can Quote)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Lock className="w-3 h-3" />
                            Shielded (AI Blocked from Quoting)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={item.isApprovedByClient ? 'outline' : 'default'}
                            className={`h-7 text-xs px-2.5 gap-1 ${
                              item.isApprovedByClient
                                ? 'text-amber-400 hover:text-amber-300 hover:border-amber-500/40'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                            onClick={() => handleToggleApproval(item)}
                            disabled={togglePriceApprovalMutation.isPending}
                          >
                            {item.isApprovedByClient ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Shield Price</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Approve Price</span>
                              </>
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteKnowledge(item.id, item.title)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">
                      No knowledge items defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          SECTION C: OPENAI-COMPATIBLE INFERENCE PROVIDERS
      ========================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Connected LLM Providers
            </h3>
            <p className="text-xs text-muted-foreground">
              Zero-cold-start inference runtimes with encrypted credential vaults
            </p>
          </div>
        </div>

        {/* Test Notification Banner */}
        {testNotification && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              testNotification.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {testNotification.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{testNotification.message}</span>
            </div>
            <button
              onClick={() => setTestNotification(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Providers Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-8 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(providers || []).map((p) => {
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
      </div>

      {/* Add Provider Modal */}
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

      {/* Add Knowledge Item Modal */}
      {showAddKnowledgeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Add Business Knowledge Base Item</CardTitle>
              <CardDescription className="text-xs">
                Package descriptions, policies, or FAQ injected into Resider AI context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateKnowledgeSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Category *</label>
                    <select
                      value={knowledgeForm.category}
                      onChange={(e) =>
                        setKnowledgeForm({ ...knowledgeForm, category: e.target.value as KnowledgeCategory })
                      }
                      className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="residency_package">Residency Package</option>
                      <option value="business_service">Business Setup Service</option>
                      <option value="policy">Consulting Policy</option>
                      <option value="faq">FAQ</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Price AED (Optional)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 7500"
                      value={knowledgeForm.priceAed}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, priceAed: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Title *</label>
                  <Input
                    required
                    placeholder="e.g. Freelance Permit & Residency"
                    value={knowledgeForm.title}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Content / Details *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detailed description of deliverables, stages, or terms..."
                    value={knowledgeForm.content}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                    className="w-full bg-muted/20 border border-border rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/70">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={knowledgeForm.isApprovedByClient}
                      onChange={(e) =>
                        setKnowledgeForm({ ...knowledgeForm, isApprovedByClient: e.target.checked })
                      }
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Approved by Client (Permit AI to quote this package / price immediately)</span>
                  </label>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddKnowledgeModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createKnowledgeMutation.isPending}
                  >
                    {createKnowledgeMutation.isPending ? 'Saving...' : 'Save Knowledge Item'}
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
