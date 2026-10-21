import * as React from 'react';
import {
  Plus,
  RefreshCw,
  Lock,
  Check,
  Trash2,
  Activity,
  Star,
  ShieldCheck,
  Loader2,
  BookOpen,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import { Field, SelectField, TextField, CheckField } from '@/components/ui/Field';
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
  const [activeTab, setActiveTab] = React.useState<'knowledge' | 'providers' | 'behavior'>('knowledge');

  const { data: providers, isLoading: isLoadingProviders, isError: isErrorProviders, refetch: refetchProviders } = useAIProviders();
  const { data: presets } = useAIProviderPresets();
  const { data: knowledgeItems, isLoading: isLoadingKnowledge, isError: isErrorKnowledge, refetch: refetchKnowledge } = useKnowledgeItems();

  const createProviderMutation = useCreateAIProvider();
  const testProviderMutation = useTestAIProvider();
  const setDefaultMutation = useSetDefaultAIProvider();
  const deleteProviderMutation = useDeleteAIProvider();

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

  const [deletingKnowledge, setDeletingKnowledge] = React.useState<{ id: string; title: string } | null>(null);
  const [deletingProvider, setDeletingProvider] = React.useState<{ id: string; name: string } | null>(null);

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
    } catch {
      // Inline mutation error
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
          ? `Connection verified (${res.latencyMs}ms). Model: ${res.model}.`
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
          void refetchKnowledge();
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content-primary">
            AI & knowledge
          </h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Knowledge base items, price quotes, inference provider credentials, and conversation rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5 bg-surface-panel border-border"
            onClick={() => {
              void refetchProviders();
              void refetchKnowledge();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </Button>

          {activeTab === 'knowledge' && (
            <Button
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setShowAddKnowledgeModal(true)}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add knowledge item</span>
            </Button>
          )}

          {activeTab === 'providers' && (
            <Button
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add provider</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-border space-x-6 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('knowledge')}
          className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'knowledge'
              ? 'border-accent text-content-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span>Knowledge base</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'providers'
              ? 'border-accent text-content-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          <Zap className="w-4 h-4" aria-hidden="true" />
          <span>Model providers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('behavior')}
          className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'behavior'
              ? 'border-accent text-content-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span>System behavior & rules</span>
        </button>
      </div>

      {/* TAB 1: KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <Card className="bg-surface-panel border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-content-primary">
                Approved packages & service pricing
              </CardTitle>
              <CardDescription className="text-xs text-content-secondary mt-0.5">
                Pricing is strictly shielded until explicitly approved. Unapproved prices are never quoted by Resider AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-base border-y border-border text-content-secondary text-[11px] uppercase tracking-wider font-medium">
                    <tr>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Package title</th>
                      <th className="px-4 py-2.5">Price (AED)</th>
                      <th className="px-4 py-2.5">Quoting permission</th>
                      <th className="px-4 py-2.5 text-right"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoadingKnowledge ? (
                      [1, 2, 3].map((i) => (
                        <tr key={i}>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        </tr>
                      ))
                    ) : isErrorKnowledge ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-danger text-xs">
                          Could not load knowledge items. Please retry.
                        </td>
                      </tr>
                    ) : knowledgeItems && knowledgeItems.length > 0 ? (
                      knowledgeItems.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-hover/70 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-surface-base text-content-secondary capitalize">
                              {item.category.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-content-primary block">{item.title}</span>
                            <span className="text-[11px] text-content-secondary line-clamp-1 mt-0.5">{item.content}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-content-primary">
                            {item.priceAed != null ? `${item.priceAed.toLocaleString()} AED` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {item.isApprovedByClient ? (
                              <span className="text-[11px] text-success font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                Permitted to quote
                              </span>
                            ) : (
                              <span className="text-[11px] text-warning font-medium flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                                Shielded (Internal only)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 gap-1 bg-surface-panel border-border"
                                onClick={() => handleToggleApproval(item)}
                                disabled={togglePriceApprovalMutation.isPending}
                              >
                                {item.isApprovedByClient ? (
                                  <>
                                    <Lock className="w-3 h-3 text-warning" aria-hidden="true" />
                                    <span>Shield</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3 text-success" aria-hidden="true" />
                                    <span>Approve</span>
                                  </>
                                )}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-content-secondary hover:text-danger"
                                onClick={() => setDeletingKnowledge({ id: item.id, title: item.title })}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-content-secondary text-xs">
                          No knowledge items registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: MODEL PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          {testNotification && (
            <div
              role="status"
              className={`p-3 rounded-md border text-xs flex items-center justify-between ${
                testNotification.success
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-danger/10 border-danger/30 text-danger'
              }`}
            >
              <span>{testNotification.message}</span>
              <button
                type="button"
                onClick={() => setTestNotification(null)}
                className="text-xs opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {isErrorProviders && (
            <div role="alert" className="p-3 rounded-md border border-danger/30 bg-danger/10 text-xs text-danger">
              Could not load AI providers. Please retry.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingProviders ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="p-4 space-y-3 bg-surface-panel border-border">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-8 w-full" />
                </Card>
              ))
            ) : providers && providers.length > 0 ? (
              providers.map((p) => {
                const isCurrentlyTesting = testingId === p.id;
                return (
                  <Card
                    key={p.id}
                    className={`bg-surface-panel border-border ${p.isDefault ? 'border-accent/40' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-content-primary flex items-center gap-2">
                          {p.name}
                        </CardTitle>
                        {p.isDefault && (
                          <span className="text-[10px] text-accent font-medium flex items-center gap-1 border border-accent/30 rounded px-1.5 py-0.2">
                            <Star className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                            Default
                          </span>
                        )}
                      </div>
                      <CardDescription className="font-mono text-[11px] text-content-secondary truncate mt-0.5">
                        {p.baseUrl}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-content-secondary">Model:</span>
                        <span className="font-mono text-content-primary font-medium">{p.defaultModel}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-content-secondary">Key:</span>
                        <span className="font-mono text-content-secondary">{p.maskedApiKey}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-content-secondary">Status:</span>
                        <span
                          className={`font-medium capitalize ${
                            p.lastHealthStatus === 'healthy'
                              ? 'text-success'
                              : p.lastHealthStatus === 'unauthorized'
                              ? 'text-danger'
                              : 'text-content-secondary'
                          }`}
                        >
                          {p.lastHealthStatus || 'Not tested'}
                          {p.lastHealthLatencyMs ? ` (${p.lastHealthLatencyMs}ms)` : ''}
                        </span>
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 gap-1.5 bg-surface-panel border-border"
                          disabled={isCurrentlyTesting}
                          onClick={() => handleRunTest(p.id)}
                        >
                          {isCurrentlyTesting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{isCurrentlyTesting ? 'Testing…' : 'Test'}</span>
                        </Button>

                        {!p.isDefault && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 px-2.5 bg-surface-panel border-border"
                            title="Set as default"
                            onClick={() => setDefaultMutation.mutate(p.id)}
                          >
                            <Star className="w-3.5 h-3.5 text-content-secondary" aria-hidden="true" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-8 px-2 text-content-secondary hover:text-danger"
                          title="Delete provider"
                          onClick={() => setDeletingProvider({ id: p.id, name: p.name })}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full p-8 text-center text-content-secondary border border-dashed border-border rounded-lg">
                <p className="text-sm font-medium text-content-primary">No providers configured</p>
                <p className="text-xs mt-1">Add an OpenAI-compatible API endpoint to handle customer message generation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM BEHAVIOR & RULES */}
      {activeTab === 'behavior' && (
        <Card className="bg-surface-panel border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-content-primary">
              Resider conversation protocol rules
            </CardTitle>
            <CardDescription className="text-xs text-content-secondary mt-0.5">
              Read-only view of the deterministic prompt structure enforced on every outbound AI draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-content-secondary">
            <div className="p-3.5 rounded-md border border-border bg-surface-base space-y-2">
              <h4 className="font-medium text-content-primary">1. Single Question Rule</h4>
              <p>The AI asks only one missing qualification item at a time to keep conversation friction minimal on messaging apps.</p>
            </div>
            <div className="p-3.5 rounded-md border border-border bg-surface-base space-y-2">
              <h4 className="font-medium text-content-primary">2. Explicit Pricing Guardrail</h4>
              <p>Prices are quoted exclusively from approved knowledge items. If an applicant asks for an unapproved package or customized quote, the AI escalates to human review.</p>
            </div>
            <div className="p-3.5 rounded-md border border-border bg-surface-base space-y-2">
              <h4 className="font-medium text-content-primary">3. External Handover Permission</h4>
              <p>Applicant contact details are never transferred to external consulting partners without recorded customer consent.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Provider Dialog */}
      {showAddModal && (
        <Dialog
          title="Add OpenAI-compatible provider"
          onClose={() => setShowAddModal(false)}
          isBusy={createProviderMutation.isPending}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 p-5">
            {presets && presets.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-content-secondary block">Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border border-border bg-surface-panel hover:bg-surface-hover text-content-primary"
                      onClick={() => handleSelectPreset(preset)}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field
              required
              label="Provider name *"
              placeholder="e.g. Workers AI / Groq"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            />

            <Field
              required
              label="Base URL *"
              placeholder="https://api.groq.com/openai/v1"
              value={formData.baseUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))}
            />

            <Field
              required
              label="API key *"
              type="password"
              placeholder="gsk_…"
              value={formData.apiKey}
              onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
            />

            <Field
              required
              label="Model ID *"
              placeholder="llama-3.3-70b-versatile"
              value={formData.defaultModel}
              onChange={(e) => setFormData((prev) => ({ ...prev, defaultModel: e.target.value }))}
            />

            <CheckField
              label="Set as default inference provider"
              checked={formData.isDefault}
              onChange={(e) => setFormData((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />

            {createProviderMutation.isError && (
              <p role="alert" className="text-xs text-danger">
                {createProviderMutation.error.message || 'Could not register provider.'}
              </p>
            )}

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={createProviderMutation.isPending}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createProviderMutation.isPending || !formData.name || !formData.baseUrl || !formData.apiKey || !formData.defaultModel}
              >
                {createProviderMutation.isPending ? 'Saving…' : 'Save provider'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Add Knowledge Item Dialog */}
      {showAddKnowledgeModal && (
        <Dialog
          title="Add knowledge item"
          onClose={() => setShowAddKnowledgeModal(false)}
          isBusy={createKnowledgeMutation.isPending}
        >
          <form onSubmit={handleCreateKnowledgeSubmit} className="space-y-4 p-5">
            <SelectField
              label="Category"
              value={knowledgeForm.category}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, category: e.target.value as KnowledgeCategory }))}
            >
              <option value="residency_package">Residency package</option>
              <option value="business_license">Business license</option>
              <option value="emirates_id_process">Emirates ID process</option>
              <option value="tax_guideline">Tax guideline</option>
              <option value="banking_requirement">Banking requirement</option>
              <option value="faq">FAQ</option>
            </SelectField>

            <Field
              required
              label="Package / item title *"
              placeholder="e.g. 2-Year Green Visa Package"
              value={knowledgeForm.title}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, title: e.target.value }))}
            />

            <TextField
              required
              label="Knowledge content *"
              placeholder="Explain deliverables, timeline, and eligibility..."
              value={knowledgeForm.content}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, content: e.target.value }))}
            />

            <Field
              label="Price (AED, optional)"
              type="number"
              placeholder="12500"
              value={knowledgeForm.priceAed}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, priceAed: e.target.value }))}
            />

            <CheckField
              label="Approve price for automated customer quoting"
              checked={knowledgeForm.isApprovedByClient}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, isApprovedByClient: e.target.checked }))}
            />

            {createKnowledgeMutation.isError && (
              <p role="alert" className="text-xs text-danger">
                {createKnowledgeMutation.error.message || 'Could not create knowledge item.'}
              </p>
            )}

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={createKnowledgeMutation.isPending}
                onClick={() => setShowAddKnowledgeModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createKnowledgeMutation.isPending || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()}
              >
                {createKnowledgeMutation.isPending ? 'Saving…' : 'Save knowledge item'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Delete Knowledge Confirmation */}
      {deletingKnowledge && (
        <ConfirmAction
          title={`Delete "${deletingKnowledge.title}"?`}
          actionLabel="Delete item"
          onConfirm={async () => {
            await deleteKnowledgeMutation.mutateAsync(deletingKnowledge.id);
          }}
          onClose={() => setDeletingKnowledge(null)}
        >
          Are you sure you want to delete this knowledge item? It will no longer be available for AI draft quoting.
        </ConfirmAction>
      )}

      {/* Delete Provider Confirmation */}
      {deletingProvider && (
        <ConfirmAction
          title={`Delete provider "${deletingProvider.name}"?`}
          actionLabel="Delete provider"
          onConfirm={async () => {
            await deleteProviderMutation.mutateAsync(deletingProvider.id);
          }}
          onClose={() => setDeletingProvider(null)}
        >
          Are you sure you want to delete this provider? If this was the default model provider, another provider must be selected.
        </ConfirmAction>
      )}
    </div>
  );
}
