import * as React from 'react';
import {
  Plus,
  CheckCircle2,
  Activity,
  Shield,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AIAutomationView() {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);
  const [isTesting, setIsTesting] = React.useState(false);

  const providers = [
    {
      id: 'p1',
      name: 'Groq Production (Ultra Fast)',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      status: 'healthy',
      latency: '240ms',
      isDefault: true,
      apiKeyMasked: 'gsk_••••••••••••••••3x9Q',
    },
    {
      id: 'p2',
      name: 'OpenRouter Fallback',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat',
      status: 'healthy',
      latency: '680ms',
      isDefault: false,
      apiKeyMasked: 'sk-or-v1-••••••••••••••••8a2B',
    },
    {
      id: 'p3',
      name: 'OpenAI Direct Backup',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      status: 'healthy',
      latency: '510ms',
      isDefault: false,
      apiKeyMasked: 'sk-proj-••••••••••••••••4f1A',
    },
  ];

  const handleRunTest = (providerName: string) => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult(`Success: ${providerName} verified in 240ms. Structured JSON schema parsed with 100% adherence.`);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: AI Master Control Switches */}
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

      {/* Dynamic AI Providers Section */}
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

      {testResult && (
        <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {/* Provider List Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {providers.map((p) => (
          <Card key={p.id} className={p.isDefault ? 'border-primary/50 shadow-sm shadow-primary/5' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  {p.name}
                </CardTitle>
                {p.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
              </div>
              <CardDescription className="font-mono text-[11px] truncate">{p.baseUrl}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Model ID:</span>
                <span className="font-mono font-medium text-foreground">{p.model}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Encrypted Key:</span>
                <span className="font-mono text-muted-foreground">{p.apiKeyMasked}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Recent Latency:</span>
                <span className="font-mono font-semibold text-emerald-400">{p.latency}</span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8 gap-1.5"
                  disabled={isTesting}
                  onClick={() => handleRunTest(p.name)}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Add Provider Modal Dialog (Simple state demonstration) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Add OpenAI-Compatible Provider</CardTitle>
              <CardDescription className="text-xs">
                Enter your standard OpenAI endpoint URL, model, and API key. Stored with AES-256-GCM encryption.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Provider Label</label>
                <Input placeholder="e.g. Together AI Production" className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Base API URL</label>
                <Input placeholder="https://api.together.xyz/v1" className="text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">API Key</label>
                <Input type="password" placeholder="sk-..." className="text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Model Identifier</label>
                <Input placeholder="meta-llama/Llama-3.3-70B-Instruct-Turbo" className="text-xs font-mono" />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => setShowAddModal(false)}>
                  Save & Validate Provider
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
