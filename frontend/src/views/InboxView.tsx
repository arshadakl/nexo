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
  GraduationCap,
  Briefcase,
  MessageSquare,
  RefreshCw,
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
} from '@/hooks/useConversations';
import type { ChannelType } from '@shared/types/crm.types';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
}

const QUICK_TEMPLATES = [
  {
    label: '📋 Checklist',
    text: 'Here are the required documents for your visa assessment: 1. Updated CV 2. Degree Certificates 3. Valid Passport 4. Language proficiency test score if available.',
  },
  {
    label: '🇩🇪 Opportunity Card',
    text: 'The German Opportunity Card (Chancenkarte) uses a points-based system. With your recognized qualifications, you are a strong applicant. Would you like to schedule an eligibility call?',
  },
  {
    label: '🇨🇦 Express Entry',
    text: 'For Canada Express Entry, your CRS score is evaluated based on age, education, and foreign work experience. What is your estimated timeline to relocate?',
  },
  {
    label: '📞 Book Call',
    text: 'Our licensed immigration counselor can review your complete documentation. Would tomorrow afternoon or Friday morning work better for a 15-minute consultation?',
  },
];

export function InboxView() {
  const [selectedConvoId, setSelectedConvoId] = React.useState<string | null>(null);
  const [filterChannel, setFilterChannel] = React.useState<'all' | ChannelType>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [messageInput, setMessageInput] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

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

  // Mutations
  const sendMessageMutation = useSendMessage(selectedConvoId);
  const toggleTakeoverMutation = useToggleTakeover(selectedConvoId);

  // Auto scroll to bottom of messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || sendMessageMutation.isPending) return;

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
              placeholder="Search applicants, handles..."
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
                          AI
                        </Badge>
                      )}
                      {convo.customerHandle && (
                        <span className="text-muted-foreground/70 truncate max-w-[100px]">
                          {convo.customerHandle}
                        </span>
                      )}
                    </div>

                    {convo.lead && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${getScoreBadgeClass(
                          convo.lead.leadScore
                        )}`}
                      >
                        {convo.lead.leadScore} pts
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-40 mb-2" />
              <p className="text-xs font-medium">No conversations yet</p>
              <p className="text-[11px] opacity-70">
                Inbound DMs from connected Instagram accounts will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTER PANE: Message Thread & Composer
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
                    <strong>Human Takeover Active:</strong> AI auto-replies are paused. Your messages
                    will be sent directly to applicant via Instagram DM.
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
                              <Sparkles className="w-2.5 h-2.5" /> Nexo AI
                            </span>
                          ) : isStaff ? (
                            <span className="text-cyan-400 font-semibold">Counselor</span>
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
                    <p className="text-xs">No messages in this conversation yet</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates Bar */}
            <div className="px-3 py-1.5 border-t border-border/60 bg-background/60 flex items-center gap-1.5 overflow-x-auto shrink-0">
              <span className="text-[10px] font-medium text-muted-foreground shrink-0 uppercase tracking-wider">
                Templates:
              </span>
              {QUICK_TEMPLATES.map((tmpl) => (
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
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    className="h-7 px-3 text-xs gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send</span>
                  </Button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs opacity-70">
                Choose an applicant from the left to view messages and qualification details.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          RIGHT PANE: Lead Dossier Context
      ========================================================================== */}
      {selectedConvoId && activeConvo && (
        <div className="w-72 lg:w-80 border-l border-border bg-background/50 flex flex-col shrink-0 p-4 overflow-y-auto space-y-5">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              Applicant Profile
            </h4>
            {activeConvo.lead && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${getScoreBadgeClass(
                  activeConvo.lead.leadScore
                )}`}
              >
                {activeConvo.lead.leadScore}/100
              </span>
            )}
          </div>

          {activeConvo.lead ? (
            <div className="space-y-4">
              {/* Destination & Visa */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs">
                  <Globe className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Destination</span>
                    <span className="font-medium text-foreground">
                      {activeConvo.lead.destinationCountry || 'Not extracted yet'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs">
                  <GraduationCap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Visa Category</span>
                    <span className="font-medium text-foreground">
                      {activeConvo.lead.visaCategory || 'Consultation Inquiry'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs">
                  <Briefcase className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Lead Stage</span>
                    <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">
                      {activeConvo.lead.leadStatus.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Information Completeness Checklist */}
              <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  AI Qualification Checklist
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Target Country:</span>
                    <span className="font-medium">
                      {activeConvo.lead.destinationCountry ? '✅ Identified' : '⏳ Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Visa Intent:</span>
                    <span className="font-medium">
                      {activeConvo.lead.visaCategory ? '✅ Identified' : '⏳ Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lead Score:</span>
                    <span className="font-medium font-mono">
                      {activeConvo.lead.leadScore >= 70 ? '🟢 Hot Lead' : '🟡 In Review'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-border text-center space-y-2">
              <Sparkles className="w-5 h-5 mx-auto text-primary opacity-50" />
              <p className="text-xs font-medium">AI Collecting Details</p>
              <p className="text-[11px] text-muted-foreground">
                As the applicant converses, Nexo AI will extract destination country, visa category,
                and score this profile automatically.
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
