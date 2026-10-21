import * as React from 'react';
import {
  Search,
  Send,
  PauseCircle,
  PlayCircle,
  Clock,
  Sparkles,
  CheckCheck,
  AlertCircle,
  User,
  ShieldAlert,
  Globe,
  Briefcase,
  MessageSquare,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Edit3,
  ShieldCheck,
  Building2,
  Phone,
  FileCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useConversations,
  useConversation,
  useConversationMessages,
  useSendMessage,
  useToggleTakeover,
  useClearConversationHistory,
} from '@/hooks/useConversations';
import {
  useConversationDraft,
  useApproveDraft,
  useModifyDraft,
  useRejectDraft,
} from '@/hooks/useDrafts';
import { useLead } from '@/hooks/useLeads';
import { useExperts, useAssignExpert } from '@/hooks/useExperts';
import type { ChannelType, LeadStatus } from '@shared/types/crm.types';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getResiderStatusBadgeClass(status: LeadStatus): string {
  switch (status) {
    case 'ready_for_team':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'handed_over':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'handover_requested':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'exploring':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'needs_clarification':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'support_enquiry':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    case 'outside_scope_spam':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatStatusName(status: string): string {
  return status.replace(/_/g, ' ');
}

const RESIDER_QUICK_TEMPLATES = [
  {
    label: '👋 Brief Greeting',
    text: 'ഹായ്! എന്താണ് അറിയേണ്ടത്? We can help with UAE residency permits and verified business setup.',
  },
  {
    label: '📋 6 Stages of Residency',
    text: 'Our UAE residency service covers 6 clear stages: 1) Initial check, 2) Entry permit, 3) Status change, 4) Medical fitness test, 5) Emirates ID biometrics, and 6) Visa stamping. Would you like permit + residency or residency only?',
  },
  {
    label: '🤝 Business Setup Expert',
    text: 'For business setup, our team connects you with verified consulting experts matching your sector and language. May we have your permission to share your details with our expert partner?',
  },
  {
    label: '📞 Schedule Advisory Call',
    text: 'Our advisory team can discuss your profile in detail. What is the best WhatsApp number or time for a quick 10-minute briefing?',
  },
];

interface InboxViewProps {
  initialConversationId?: string | null;
}

export function InboxView({ initialConversationId }: InboxViewProps = {}) {
  const [selectedConvoId, setSelectedConvoId] = React.useState<string | null>(initialConversationId || null);
  const [filterChannel, setFilterChannel] = React.useState<'all' | ChannelType>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [messageInput, setMessageInput] = React.useState('');
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null);
  const [isEditingDraft, setIsEditingDraft] = React.useState(false);
  const [selectedExpertToAssign, setSelectedExpertToAssign] = React.useState<string>('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Synchronize when initialConversationId is provided from outside
  React.useEffect(() => {
    if (initialConversationId) {
      setSelectedConvoId(initialConversationId);
    }
  }, [initialConversationId]);

  // Queries
  const { data: conversations, isLoading: isLoadingList, refetch: refetchList } = useConversations({
    channel: filterChannel,
    search: searchQuery || undefined,
  });

  // Select first conversation by default if none selected
  React.useEffect(() => {
    if (!selectedConvoId && conversations && conversations.length > 0) {
      const first = conversations[0];
      if (first) {
        setSelectedConvoId(first.id);
      }
    }
  }, [conversations, selectedConvoId]);

  const { data: activeConvo } = useConversation(selectedConvoId);
  const { data: messages, isLoading: isLoadingMessages } = useConversationMessages(selectedConvoId);

  // Draft review query for the selected conversation
  const { data: pendingDraft, refetch: refetchDraft } = useConversationDraft(selectedConvoId);

  // Lead dossier query
  const leadId = activeConvo?.lead?.id || null;
  const { data: fullLead } = useLead(leadId);

  // Verified Experts query for matching
  const { data: availableExperts } = useExperts({
    emirate: fullLead?.targetEmirate || undefined,
  });

  // Mutations
  const sendMessageMutation = useSendMessage(selectedConvoId);
  const toggleTakeoverMutation = useToggleTakeover(selectedConvoId);
  const clearChatMutation = useClearConversationHistory(selectedConvoId);
  const approveDraftMutation = useApproveDraft();
  const modifyDraftMutation = useModifyDraft();
  const rejectDraftMutation = useRejectDraft();
  const assignExpertMutation = useAssignExpert();

  // Auto scroll to bottom of messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingDraft]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || sendMessageMutation.isPending) return;

    if (isEditingDraft && activeDraftId) {
      modifyDraftMutation.mutate(
        { draftId: activeDraftId, modifiedText: trimmed },
        {
          onSuccess: () => {
            setMessageInput('');
            setIsEditingDraft(false);
            setActiveDraftId(null);
            refetchDraft();
          },
        }
      );
      return;
    }

    sendMessageMutation.mutate(
      { messageText: trimmed },
      {
        onSuccess: () => {
          setMessageInput('');
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTakeoverToggle = () => {
    if (!activeConvo) return;
    toggleTakeoverMutation.mutate({
      takeover: !activeConvo.humanTakeover,
    });
  };

  const handleClearChat = () => {
    if (!activeConvo) return;
    const confirmed = window.confirm(
      `Are you sure you want to clear chat history for "${activeConvo.customerName}"?\n\nThis will wipe all existing messages and reset this Resider dossier.`
    );
    if (!confirmed) return;

    clearChatMutation.mutate();
  };

  const handleApproveDraft = (draftId: string) => {
    approveDraftMutation.mutate(draftId, {
      onSuccess: () => {
        setIsEditingDraft(false);
        setActiveDraftId(null);
        refetchDraft();
      },
    });
  };

  const handleStartEditDraft = (draftId: string, text: string) => {
    setActiveDraftId(draftId);
    setIsEditingDraft(true);
    setMessageInput(text);
  };

  const handleRejectDraft = (draftId: string) => {
    rejectDraftMutation.mutate(draftId, {
      onSuccess: () => {
        setIsEditingDraft(false);
        setActiveDraftId(null);
        refetchDraft();
      },
    });
  };

  const handleAssignExpert = () => {
    if (!leadId || !selectedExpertToAssign) return;
    assignExpertMutation.mutate(
      { leadId, expertId: selectedExpertToAssign },
      {
        onSuccess: () => {
          setSelectedExpertToAssign('');
        },
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-xl border border-border bg-card/40 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* =========================================================================
          LEFT PANE: Conversation Directory
      ========================================================================== */}
      <div className="w-80 lg:w-96 border-r border-border flex flex-col shrink-0 bg-background/50">
        {/* Search & Channel Filter */}
        <div className="p-3 border-b border-border space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enquiries, handles..."
              className="pl-9 h-9 text-xs bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={filterChannel === 'all' ? 'default' : 'outline'}
                className="text-xs h-7 px-2.5"
                onClick={() => setFilterChannel('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filterChannel === 'instagram' ? 'default' : 'outline'}
                className="text-xs h-7 px-2.5 gap-1"
                onClick={() => setFilterChannel('instagram')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                Instagram
              </Button>
              <Button
                size="sm"
                variant={filterChannel === 'whatsapp' ? 'default' : 'outline'}
                className="text-xs h-7 px-2.5 gap-1"
                onClick={() => setFilterChannel('whatsapp')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                WhatsApp
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => refetchList()}
              title="Refresh conversations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Conversation List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {isLoadingList ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations && conversations.length > 0 ? (
            conversations.map((convo) => {
              const isSelected = convo.id === selectedConvoId;
              const leadStatus = convo.lead?.leadStatus as LeadStatus | undefined;

              return (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConvoId(convo.id)}
                  className={`p-3.5 cursor-pointer transition-colors relative ${
                    isSelected
                      ? 'bg-muted/70 border-l-2 border-l-primary'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-xs truncate text-foreground">
                        {convo.customerName}
                      </span>
                      {convo.channel === 'instagram' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" title="Instagram" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="WhatsApp" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {convo.unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-primary rounded-full">
                          {convo.unreadCount}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(convo.lastMessageAt)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {convo.lastMessageText || 'No messages yet'}
                  </p>

                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {convo.humanTakeover ? (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                        >
                          Takeover
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[9px] bg-primary/10 text-primary border-primary/20 flex items-center gap-0.5"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          AI Mode
                        </Badge>
                      )}
                      {convo.customerHandle && (
                        <span className="text-muted-foreground/70 truncate max-w-[100px]">
                          {convo.customerHandle}
                        </span>
                      )}
                    </div>

                    {leadStatus && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium border capitalize ${getResiderStatusBadgeClass(
                          leadStatus
                        )}`}
                      >
                        {formatStatusName(leadStatus)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-40 mb-2" />
              <p className="text-xs font-medium">No enquiries yet</p>
              <p className="text-[11px] opacity-70">
                Inbound DMs from Instagram and WhatsApp will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTER PANE: Message Thread, AI Draft Staging Bar & Composer
      ========================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/20">
        {selectedConvoId && activeConvo ? (
          <>
            {/* Thread Header */}
            <div className="p-3.5 border-b border-border flex items-center justify-between bg-card/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-medium text-xs text-primary shrink-0">
                  {activeConvo.customerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{activeConvo.customerName}</span>
                    <Badge variant="outline" className="text-[10px] h-4 capitalize">
                      {activeConvo.channel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {activeConvo.customerHandle || `@${activeConvo.customerId}`}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-950/20"
                  onClick={handleClearChat}
                  disabled={clearChatMutation.isPending}
                  title="Clear chat history and reset lead data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{clearChatMutation.isPending ? 'Clearing...' : 'Clear Chat'}</span>
                </Button>

                <Button
                  size="sm"
                  variant={activeConvo.humanTakeover ? 'destructive' : 'outline'}
                  className="text-xs h-8 gap-1.5"
                  onClick={handleTakeoverToggle}
                  disabled={toggleTakeoverMutation.isPending}
                >
                  {activeConvo.humanTakeover ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Resume AI</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span>Take Over</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Human Takeover Alert Banner */}
            {activeConvo.humanTakeover && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-400">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>Human Takeover Active:</strong> AI auto-replies paused. All replies sent here go directly to the customer.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-amber-400 hover:bg-amber-500/20"
                  onClick={handleTakeoverToggle}
                >
                  Resume AI
                </Button>
              </div>
            )}

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-64 rounded-2xl" />
                  <Skeleton className="h-16 w-80 rounded-2xl ml-auto" />
                  <Skeleton className="h-10 w-48 rounded-2xl" />
                </div>
              ) : messages && messages.length > 0 ? (
                messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound';
                  const isAI = msg.senderType === 'ai';
                  const isStaff = msg.senderType === 'staff';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {isAI ? (
                            <span className="text-indigo-400 flex items-center gap-1 font-semibold">
                              <Sparkles className="w-2.5 h-2.5" /> Resider AI
                            </span>
                          ) : isStaff ? (
                            <span className="text-cyan-400 font-semibold">Resider Team</span>
                          ) : (
                            activeConvo.customerName
                          )}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                          isAI
                            ? 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 rounded-tr-sm'
                            : isStaff
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted/80 text-foreground border border-border/70 rounded-tl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.messageText}</p>
                      </div>

                      {/* Delivery Status Indicator */}
                      {isOutbound && (
                        <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-muted-foreground/70">
                          {msg.deliveryStatus === 'pending' && (
                            <>
                              <Clock className="w-2.5 h-2.5" />
                              <span>Sending...</span>
                            </>
                          )}
                          {msg.deliveryStatus === 'delivered' && (
                            <>
                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                              <span>Delivered</span>
                            </>
                          )}
                          {msg.deliveryStatus === 'failed' && (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span className="text-rose-400">Failed to send</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-center p-8 text-muted-foreground">
                  <div>
                    <MessageSquare className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p className="text-xs">No messages in this enquiry yet</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* =========================================================================
                AI DRAFT REVIEW BAR (Section 10 Operational Guardrail)
            ========================================================================== */}
            {pendingDraft && pendingDraft.status === 'pending_review' && (
              <div className="mx-3 my-2 p-3.5 rounded-xl border border-indigo-500/40 bg-indigo-950/30 backdrop-blur-sm shadow-lg space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span>AI Suggested Reply (Draft Review Mode)</span>
                    <Badge variant="outline" className="text-[9px] bg-indigo-500/20 text-indigo-200 border-indigo-400/30">
                      Pending Approval
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Generated {formatRelativeTime(pendingDraft.createdAt)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-background/60 border border-border/80 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {pendingDraft.suggestedText}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-muted-foreground/80 italic">
                    Review before live dispatch to Meta Send API
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 px-2.5 gap-1"
                      onClick={() => handleRejectDraft(pendingDraft.id)}
                      disabled={rejectDraftMutation.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-indigo-300 border-indigo-500/40 hover:bg-indigo-950/40 px-2.5 gap-1"
                      onClick={() => handleStartEditDraft(pendingDraft.id, pendingDraft.suggestedText)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 gap-1 shadow-sm"
                      onClick={() => handleApproveDraft(pendingDraft.id)}
                      disabled={approveDraftMutation.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{approveDraftMutation.isPending ? 'Sending...' : 'Approve & Send'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Templates Bar (Strictly Resider Aligned) */}
            <div className="px-3 py-1.5 border-t border-border/60 bg-background/60 flex items-center gap-1.5 overflow-x-auto shrink-0">
              <span className="text-[10px] font-medium text-muted-foreground shrink-0 uppercase tracking-wider">
                Approved Replies:
              </span>
              {RESIDER_QUICK_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  type="button"
                  onClick={() => setMessageInput(tmpl.text)}
                  className="px-2 py-1 text-[11px] rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 border border-border/40"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            {/* Composer */}
            <form onSubmit={handleSend} className="p-3 border-t border-border bg-card/20 shrink-0">
              {isEditingDraft && (
                <div className="mb-2 flex items-center justify-between text-[11px] text-indigo-300 bg-indigo-950/20 px-2.5 py-1 rounded border border-indigo-500/30">
                  <span className="flex items-center gap-1.5">
                    <Edit3 className="w-3 h-3 text-indigo-400" />
                    Editing staged draft — sending will mark draft as modified & dispatched
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDraft(false);
                      setActiveDraftId(null);
                      setMessageInput('');
                    }}
                    className="text-muted-foreground hover:text-foreground underline ml-2"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}
              <div className="relative">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${activeConvo.customerName}... (Press Ctrl+Enter to send)`}
                  rows={2}
                  className="w-full bg-muted/30 border border-border rounded-lg pl-3 pr-20 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !messageInput.trim() ||
                      sendMessageMutation.isPending ||
                      modifyDraftMutation.isPending
                    }
                    className="h-7 px-3 text-xs gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isEditingDraft ? 'Save & Send' : 'Send'}</span>
                  </Button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm font-medium">Select an enquiry</p>
              <p className="text-xs opacity-70">
                Choose a customer from the left to view messages and Resider lead qualification.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          RIGHT PANE: Lead Dossier & Evidence Inspector
      ========================================================================== */}
      {selectedConvoId && activeConvo && (
        <div className="w-80 lg:w-96 border-l border-border bg-background/50 flex flex-col shrink-0 p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              Resider Dossier
            </h4>
            {fullLead && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-medium border capitalize ${getResiderStatusBadgeClass(
                  fullLead.leadStatus
                )}`}
              >
                {formatStatusName(fullLead.leadStatus)}
              </span>
            )}
          </div>

          {fullLead ? (
            <div className="space-y-4">
              {/* Status Reason Audit Callout */}
              {fullLead.statusReason && (
                <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60 text-xs space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block flex items-center gap-1">
                    <FileCheck className="w-3 h-3 text-primary" />
                    Status Rationale
                  </span>
                  <p className="text-muted-foreground leading-relaxed">{fullLead.statusReason}</p>
                </div>
              )}

              {/* Fact Matrix */}
              <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  UAE Qualification Profile
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                      Vertical:
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {fullLead.serviceVertical.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      Residency Intent:
                    </span>
                    <span className="font-medium text-foreground text-right text-[11px] capitalize">
                      {fullLead.residencyIntent ? fullLead.residencyIntent.replace(/_/g, ' ') : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      Activity / Sector:
                    </span>
                    <span className="font-medium text-foreground truncate max-w-[140px] text-right">
                      {fullLead.workBusinessActivity || '⏳ Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Location Context:</span>
                    <span className="font-medium text-foreground capitalize">
                      {fullLead.uaeLocationContext.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Target Emirate:</span>
                    <span className="font-medium text-foreground">
                      {fullLead.targetEmirate || 'Undecided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Language:</span>
                    <span className="font-medium text-foreground capitalize">
                      {fullLead.detectedLanguage}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      Contact:
                    </span>
                    <span className="font-medium text-foreground font-mono">
                      {fullLead.phoneOrEmail || fullLead.phoneNumber || '⏳ Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Handover & Privacy Guardrails (Section 3) */}
              <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Consent & Permissions
                </span>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contact Permission:</span>
                    <span className="font-medium text-[11px]">
                      {fullLead.contactPermission ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Granted
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">⏳ Pending</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expert Sharing:</span>
                    <span className="font-medium text-[11px]">
                      {fullLead.externalSharingPermission ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Permitted
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Gate Required
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Missing Details Checklist */}
              <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Missing Details Checklist
                </span>
                {fullLead.missingDetails && fullLead.missingDetails.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    {fullLead.missingDetails.map((item) => (
                      <div key={item} className="flex items-center gap-1.5 text-amber-400/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                        <span className="capitalize">{item.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>All critical qualification details captured!</span>
                  </div>
                )}
              </div>

              {/* Verified Expert Assignment Card */}
              {(fullLead.serviceVertical === 'business_setup' ||
                fullLead.serviceVertical === 'both' ||
                fullLead.assignedExpertId) && (
                <div className="border border-primary/30 rounded-lg p-3 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary block flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      Verified Expert
                    </span>
                    {fullLead.assignedExpertId && (
                      <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                        Assigned
                      </Badge>
                    )}
                  </div>

                  {fullLead.assignedExpertId ? (
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">Partner Assigned</p>
                      <p className="text-muted-foreground text-[11px]">
                        Lead handed over to verified business setup partner.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Match this customer with a verified consulting partner:
                      </p>
                      <div className="flex gap-1.5">
                        <select
                          value={selectedExpertToAssign}
                          onChange={(e) => setSelectedExpertToAssign(e.target.value)}
                          className="flex-1 h-7 rounded border border-border bg-card px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Select verified expert...</option>
                          {(availableExperts || []).map((exp) => (
                            <option key={exp.id} value={exp.id}>
                              {exp.fullName} ({exp.organizationName})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={!selectedExpertToAssign || assignExpertMutation.isPending}
                          onClick={handleAssignExpert}
                          className="h-7 text-xs px-2.5"
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-border text-center space-y-2">
              <Sparkles className="w-5 h-5 mx-auto text-primary opacity-50" />
              <p className="text-xs font-medium">Resider AI Profiling Active</p>
              <p className="text-[11px] text-muted-foreground">
                As the customer chats, Resider AI automatically identifies residency intent, business activity, and missing details.
              </p>
            </div>
          )}

          {/* Channel Connection Info */}
          <div className="pt-3 border-t border-border/70 text-[11px] space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>Channel:</span>
              <span className="font-medium text-foreground capitalize">{activeConvo.channel}</span>
            </div>
            <div className="flex justify-between">
              <span>AI Mode:</span>
              <span className="font-medium text-foreground font-mono">{activeConvo.aiMode}</span>
            </div>
            <div className="flex justify-between">
              <span>First Contact:</span>
              <span>{formatRelativeTime(activeConvo.createdAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
