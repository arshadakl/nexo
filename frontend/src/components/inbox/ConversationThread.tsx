import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowDown, PanelRight, Trash2, UserRound, MessageSquare, Play } from 'lucide-react';
import type { AutomationState, ConversationWithDetails } from '@shared/types/crm.types';
import {
  useConversation,
  useConversationMessages,
  useSendMessage,
  useToggleTakeover,
  useClearConversationHistory,
  useResumeAI,
  useRetryMessage,
} from '@/hooks/useConversations';
import {
  useConversationDraft,
  useApproveDraft,
  useModifyDraft,
  useRejectDraft,
  useRetryDraft,
} from '@/hooks/useDrafts';
import { automationDescriptions, automationLabels, qualificationLabels, qualificationVariant } from '@/lib/leadPresentation';
import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import type { RejectNextAction } from './DraftReview';
import { useComposerDraft } from '@/lib/ComposerContext';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DaySeparator, MessageItem } from './MessageItem';
import { Avatar } from '@/components/ui/Avatar';
import { channelTheme } from '@/lib/channelTheme';
import { MessageComposer } from './MessageComposer';
import { DraftReview } from './DraftReview';
import { CustomerDetails } from './CustomerDetails';

export function ConversationThread({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const conversation = useConversation(conversationId);
  if (!conversation.data)
    return (
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <div className="border-b border-border p-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to conversations
          </Button>
        </div>
        {conversation.isPending ? (
          <div role="status" className="space-y-6 p-5">
            <span className="sr-only">Loading conversation</span>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-24 w-2/3" />
          </div>
        ) : (
          <ErrorState
            message={
              conversation.error instanceof ApiError && conversation.error.status === 404
                ? 'This conversation is unavailable or was removed.'
                : 'Could not load this conversation.'
            }
            onRetry={() => {
              void conversation.refetch();
            }}
          />
        )}
      </section>
    );
  return (
    <ConversationSession
      conversation={conversation.data}
      onBack={onBack}
      detailError={conversation.isError}
      onRetry={() => {
        void conversation.refetch();
      }}
    />
  );
}

function ConversationSession({
  conversation,
  onBack,
  detailError,
  onRetry,
}: {
  conversation: ConversationWithDetails;
  onBack: () => void;
  detailError: boolean;
  onRetry: () => void;
}) {
  const id = conversation.id;
  const messages = useConversationMessages(id);
  const draftQuery = useConversationDraft(id);
  const send = useSendMessage(id);
  const approve = useApproveDraft();
  const modify = useModifyDraft();
  const reject = useRejectDraft();
  const takeover = useToggleTakeover(id);
  const resume = useResumeAI(id);
  const retryDraft = useRetryDraft();
  const retryMessage = useRetryMessage(id);
  const clear = useClearConversationHistory(id);
  const [discardPrompt, setDiscardPrompt] = useState<number | null>(null);
  const { draft, update, start, finish } = useComposerDraft(id);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearLeadData, setClearLeadData] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const pendingDraft =
    draftQuery.data &&
    (draftQuery.data.status === 'pending_review' ||
      draftQuery.data.status === 'sending' ||
      draftQuery.data.status === 'send_failed')
      ? draftQuery.data
      : null;
  const automationState: AutomationState =
    conversation.automationState ??
    (conversation.humanTakeover ? 'human_takeover' : conversation.aiMode === 'OFF' ? 'ai_off' : 'ai_active');
  const isPaused = automationState !== 'ai_active';
  const qualification = conversation.lead?.qualification ?? 'unknown';
  const theme = channelTheme(conversation.channel);
  const isWhatsApp = conversation.channel === 'whatsapp';
  const headerButton = isWhatsApp
    ? 'text-white hover:bg-white/15 hover:text-white dark:text-[#aebac1] dark:hover:bg-white/10'
    : 'text-content-primary hover:bg-surface-hover';
  const headerPill = cn(
    'min-h-9 rounded-full px-3 text-xs font-semibold',
    isWhatsApp
      ? 'border border-white/50 bg-white/10 text-white hover:bg-white/20 dark:border-white/20'
      : 'border border-border bg-surface-panel hover:bg-surface-hover',
  );
  const isBusy = draft.action !== null;
  const isStaleEdit = Boolean(
    draft.editing && (!pendingDraft || pendingDraft.id !== draft.editing.id),
  );

  useEffect(() => {
    const stream = streamRef.current;
    const latestId = messages.data?.at(-1)?.id ?? null;
    if (!stream || !latestId) return;
    if (isNearBottom.current) {
      stream.scrollTop = stream.scrollHeight;
      setHasNewMessages(false);
    } else if (lastMessageId.current !== latestId) setHasNewMessages(true);
    lastMessageId.current = latestId;
  }, [messages.data, draftQuery.data]);

  const handleSend = async () => {
    const text = (draft.editing?.text ?? draft.text).trim();
    if (!text || isStaleEdit || !start(id, 'send')) return;
    isNearBottom.current = true;
    try {
      if (draft.editing) {
        // The reviewer wrote this text with any newer customer messages visible above.
        await modify.mutateAsync({ draftId: draft.editing.id, modifiedText: text, acknowledgeNewMessages: true });
        finish(id, {
          editing: null,
          notice: 'Draft submitted. Check delivery status in the thread.',
        });
      } else {
        const result = await send.mutateAsync({ messageText: text });
        if (result.deliveryStatus === 'failed') {
          finish(id, {
            error: result.errorMessage
              ? `Not sent: ${result.errorMessage}`
              : 'The reply could not be sent. Your text is preserved.',
          });
        } else {
          finish(id, {
            text: '',
            notice:
              result.deliveryStatus === 'pending' || result.deliveryStatus === 'unknown'
                ? 'Reply recorded. Delivery has not been confirmed.'
                : 'Reply submitted. Delivery status is shown above.',
          });
        }
      }
    } catch (error) {
      finish(id, {
        error:
          error instanceof ApiError && error.status === 409
            ? 'This draft was already reviewed. Your text is preserved.'
            : 'Could not confirm sending. Your text is preserved. Check the thread before trying again.',
      });
    }
  };

  const handleReview = async (
    action: 'approve' | 'reject' | 'retry',
    options: { acknowledgeNewMessages?: boolean; nextAction?: RejectNextAction } = {},
  ) => {
    if (!pendingDraft || !start(id, action === 'retry' ? 'approve' : action)) return;
    try {
      if (action === 'approve') {
        isNearBottom.current = true;
        await approve.mutateAsync(
          options.acknowledgeNewMessages
            ? { draftId: pendingDraft.id, acknowledgeNewMessages: true }
            : pendingDraft.id,
        );
      } else if (action === 'retry') {
        isNearBottom.current = true;
        await retryDraft.mutateAsync({
          draftId: pendingDraft.id,
          acknowledgeNewMessages: Boolean(options.acknowledgeNewMessages),
        });
      } else {
        await reject.mutateAsync(
          options.nextAction ? { draftId: pendingDraft.id, nextAction: options.nextAction } : pendingDraft.id,
        );
      }
      finish(id, {
        notice:
          action === 'reject'
            ? options.nextAction === 'resume_ai'
              ? 'Draft rejected. No reply was sent. AI continues with later messages.'
              : 'Draft rejected. No reply was sent.'
            : 'Draft approved. Check delivery status in the thread.',
      });
    } catch (error) {
      void draftQuery.refetch();
      finish(id, {
        error:
          error instanceof ApiError && error.code === 'STALE_DRAFT'
            ? 'The customer sent new messages after this draft. Review them before sending.'
            : error instanceof ApiError && error.code === 'SEND_FAILED'
              ? `${error.message} The reply was kept so you can retry.`
              : error instanceof ApiError && error.status === 409
                ? 'This draft was already reviewed. Refresh to see the latest state.'
                : action === 'reject'
                  ? 'Could not reject this draft. Please try again.'
                  : 'Could not confirm approval. Check the thread before trying again.',
      });
    }
  };

  const handleResume = async (discardPendingDrafts = false) => {
    try {
      await resume.mutateAsync({ discardPendingDrafts });
      setDiscardPrompt(null);
      update(id, { error: null, notice: 'AI resumed. Waiting customer messages will be answered once.' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PENDING_APPROVALS' && !discardPendingDrafts) {
        const pending = Number((error.details as { pendingDrafts?: number } | undefined)?.pendingDrafts ?? 1);
        setDiscardPrompt(pending);
        return;
      }
      throw error;
    }
  };

  return (
    <>
      <section
        aria-label={`Conversation with ${conversation.customerName}`}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className={cn('flex shrink-0 items-center justify-between gap-2 px-2 py-2 sm:px-4', theme.header)}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to conversations"
              className={cn('size-10 rounded-full md:hidden', headerButton)}
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Button>
            <Avatar name={conversation.customerName} channel={conversation.channel} size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold leading-5">
                {conversation.customerName || 'Unknown customer'}
              </h2>
              <p className={cn('truncate text-xs leading-4', theme.headerMuted)}>
                {conversation.customerHandle || theme.label}
                {conversation.customerHandle ? ` · ${theme.label}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {automationState !== 'human_takeover' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={headerPill}
                disabled={takeover.isPending || clear.isPending}
                onClick={() => takeover.mutate({ takeover: true })}
              >
                <UserRound aria-hidden="true" className="size-3.5" />
                <span className="sr-only sm:not-sr-only">{takeover.isPending ? 'Updating…' : 'Take over'}</span>
              </Button>
            )}
            {isPaused && automationState !== 'approval_sending' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={headerPill}
                disabled={resume.isPending || clear.isPending}
                onClick={() => {
                  void handleResume().catch(() => {});
                }}
              >
                <Play aria-hidden="true" className="size-3.5" />
                <span className="sr-only sm:not-sr-only">{resume.isPending ? 'Resuming…' : 'Resume AI'}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear conversation history"
              title="Clear conversation history"
              className={cn('size-10 rounded-full', headerButton)}
              disabled={isBusy || clear.isPending}
              onClick={() => setIsClearOpen(true)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('size-10 rounded-full min-[1440px]:hidden', headerButton)}
              aria-label="Open customer details"
              onClick={() => setIsDetailsOpen(true)}
            >
              <PanelRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <div
          role="status"
          className={cn(
            'flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-1.5 text-xs',
            automationState === 'send_failed'
              ? 'bg-danger/10 text-danger'
              : isPaused
                ? 'bg-warning/10 text-warning'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          <span className="inline-flex items-center gap-1.5 font-semibold" title={automationDescriptions[automationState]}>
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                automationState === 'send_failed' ? 'bg-danger' : isPaused ? 'bg-warning' : 'animate-pulse bg-emerald-500',
              )}
            />
            {automationLabels[automationState]}
          </span>
          <span className="hidden truncate text-content-secondary 2xl:inline">· {automationDescriptions[automationState]}</span>
          {conversation.lead && (
            <Badge
              variant={qualificationVariant[qualification]}
              className="ml-auto rounded-full"
              title={conversation.lead.qualificationReason || undefined}
            >
              Lead: {qualificationLabels[qualification]}
            </Badge>
          )}
        </div>
        {detailError && (
          <ErrorState message="Could not refresh conversation details." onRetry={onRetry} />
        )}
        {takeover.isError && (
          <ErrorState
            message="Could not change human handling. The previous state is unchanged."
            onRetry={() => takeover.mutate({ takeover: true })}
          />
        )}
        {resume.isError && discardPrompt === null && (
          <ErrorState
            message="Could not resume AI. The previous state is unchanged."
            onRetry={() => {
              void handleResume().catch(() => {});
            }}
          />
        )}
        {messages.isError && (
          <ErrorState
            message={
              messages.data
                ? 'Could not refresh messages. Showing the previous history.'
                : 'Could not load messages.'
            }
            onRetry={() => {
              void messages.refetch();
            }}
          />
        )}
        <div className="relative min-h-24 flex-1">
          <div
            ref={streamRef}
            tabIndex={0}
            aria-label="Message history"
            onScroll={() => {
              const stream = streamRef.current;
              if (!stream) return;
              isNearBottom.current =
                stream.scrollHeight - stream.scrollTop - stream.clientHeight < 96;
              if (isNearBottom.current) setHasNewMessages(false);
            }}
            className={cn('h-full overflow-y-auto px-3 py-4 sm:px-6', theme.canvas)}
          >
            <div className="flex min-h-full flex-col">
              {messages.isPending ? (
                <div role="status" className="space-y-5">
                  <span className="sr-only">Loading messages</span>
                  <Skeleton className="h-20 w-2/3" />
                  <Skeleton className="ml-auto h-16 w-2/3" />
                </div>
              ) : messages.data?.length ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-2 pt-2 text-center">
                    <Avatar name={conversation.customerName} channel={conversation.channel} size="lg" />
                    <p className={cn('text-xs', isWhatsApp ? 'rounded-md bg-[#ffeecd] px-3 py-1.5 text-[#54656f] dark:bg-[#182229] dark:text-[#ffd279]' : 'text-content-muted')}>
                      {isWhatsApp ? 'WhatsApp conversation · recent history, up to 50 messages' : 'Instagram conversation · recent history, up to 50 messages'}
                    </p>
                  </div>
                  <ol>
                    {messages.data.map((message, index, all) => {
                      const previous = all[index - 1];
                      const next = all[index + 1];
                      const sameSide = (a?: typeof message, b?: typeof message) =>
                        Boolean(a && b && a.direction === b.direction && a.senderType === b.senderType &&
                          Math.abs(a.createdAt - b.createdAt) < 5 * 60 * 1000 &&
                          new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString());
                      const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                      return [
                        newDay && <DaySeparator key={`day-${message.id}`} at={message.createdAt} channel={conversation.channel} />,
                      <MessageItem
                        key={message.id}
                        message={message}
                        channel={conversation.channel}
                        isFirstInGroup={newDay || !sameSide(previous, message)}
                        isLastInGroup={!sameSide(message, next)}
                        customerName={conversation.customerName || 'Customer'}
                        isRetrying={retryMessage.isPending && retryMessage.variables === message.id}
                        onRetry={
                          message.direction === 'outbound' &&
                          message.deliveryStatus === 'failed' &&
                          !message.id.startsWith('optimistic_')
                            ? () => retryMessage.mutate(message.id)
                            : undefined
                        }
                      />,
                      ];
                    })}
                  </ol>
                </>
              ) : (
                !messages.isError && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-content-secondary">
                    <MessageSquare aria-hidden="true" className="size-6" />
                    <p className="text-sm">No messages in this conversation yet.</p>
                  </div>
                )
              )}
              <div className="mt-auto pt-5">
                {draftQuery.isError && (
                  <ErrorState
                    message="Could not refresh the AI draft. Refresh before reviewing."
                    onRetry={() => {
                      void draftQuery.refetch();
                    }}
                  />
                )}
                {pendingDraft && (
                  <DraftReview
                    draft={pendingDraft}
                    isEditing={draft.editing !== null}
                    isBusy={isBusy || draftQuery.isError || clear.isPending}
                    onEdit={() =>
                      update(id, {
                        editing: { id: pendingDraft.id, text: pendingDraft.suggestedText },
                        error: null,
                        notice: null,
                      })
                    }
                    onApprove={(acknowledgeNewMessages) => {
                      void handleReview('approve', { acknowledgeNewMessages });
                    }}
                    onReject={(nextAction) => {
                      void handleReview('reject', { nextAction });
                    }}
                    onRetry={(acknowledgeNewMessages) => {
                      void handleReview('retry', { acknowledgeNewMessages });
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          {hasNewMessages && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
              onClick={() => {
                const stream = streamRef.current;
                if (stream) stream.scrollTop = stream.scrollHeight;
                isNearBottom.current = true;
                setHasNewMessages(false);
              }}
            >
              <ArrowDown aria-hidden="true" className="size-3.5" />
              New messages
            </Button>
          )}
        </div>
        <MessageComposer
          draft={draft}
          customerName={conversation.customerName || 'customer'}
          channel={conversation.channel}
          isStaleEdit={
            isStaleEdit || Boolean(draft.editing && (draftQuery.isPending || draftQuery.isError))
          }
          isDisabled={messages.isPending || (!messages.data && messages.isError) || clear.isPending}
          onChange={(text) =>
            update(
              id,
              draft.editing
                ? { editing: { ...draft.editing, text }, error: null, notice: null }
                : { text, error: null, notice: null },
            )
          }
          onCancelEdit={() => update(id, { editing: null, error: null, notice: null })}
          onSend={() => {
            void handleSend();
          }}
        />
      </section>
      <aside
        aria-label="Customer details"
        className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-surface-panel min-[1440px]:block"
      >
        <h2 className="border-b border-border px-5 py-5 text-[13px] font-semibold">
          Customer details
        </h2>
        <CustomerDetails
          leadId={conversation.lead?.id ?? null}
          conversation={{ customerHandle: conversation.customerHandle ?? null, automationState }}
        />
      </aside>
      {isDetailsOpen && (
        <Dialog
          title="Customer details"
          onClose={() => setIsDetailsOpen(false)}
          className="mr-0 h-dvh max-h-dvh max-w-sm rounded-none"
        >
          <CustomerDetails
          leadId={conversation.lead?.id ?? null}
          conversation={{ customerHandle: conversation.customerHandle ?? null, automationState }}
        />
        </Dialog>
      )}
      {discardPrompt !== null && (
        <ConfirmAction
          title="Resume AI and discard held replies?"
          actionLabel="Discard and resume AI"
          onClose={() => setDiscardPrompt(null)}
          onConfirm={() => handleResume(true)}
        >
          {discardPrompt === 1 ? 'A reply is' : `${discardPrompt} replies are`} still waiting for approval or a
          retry. Resuming AI discards {discardPrompt === 1 ? 'it' : 'them'} without sending. To keep{' '}
          {discardPrompt === 1 ? 'it' : 'them'}, cancel and approve, edit or reject from the draft panel instead.
        </ConfirmAction>
      )}
      {isClearOpen && (
        <Dialog
          alert
          title="Clear conversation options"
          onClose={() => setIsClearOpen(false)}
          isBusy={clear.isPending}
        >
          <div className="space-y-4 p-4">
            <p className="text-sm leading-6 text-foreground/90">
              Choose how you would like to clear history for{' '}
              <strong className="font-semibold text-foreground">{conversation.customerName}</strong>. This cannot be undone:
            </p>

            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-accent/40 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="clearOption"
                  className="mt-1"
                  checked={!clearLeadData}
                  onChange={() => setClearLeadData(false)}
                  disabled={clear.isPending}
                />
                <div className="text-sm">
                  <div className="font-medium text-foreground">Just clear the chat</div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    Deletes messages and pending AI drafts. Retains the applicant profile in Leads CRM and keeps lead details intact.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="clearOption"
                  className="mt-1 text-destructive"
                  checked={clearLeadData}
                  onChange={() => setClearLeadData(true)}
                  disabled={clear.isPending}
                />
                <div className="text-sm">
                  <div className="font-medium text-destructive">Chat + Lead data (Full reset)</div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    Deletes messages, drafts, and completely removes the lead from the Leads section for clean re-testing.
                  </div>
                </div>
              </label>
            </div>

            {clear.isError && (
              <p role="alert" className="text-[13px] text-danger">
                Could not clear the conversation. Please try again.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={clear.isPending}
                onClick={() => setIsClearOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={clearLeadData ? 'destructive' : 'default'}
                disabled={clear.isPending}
                onClick={() =>
                  clear.mutate(
                    { deleteLead: clearLeadData },
                    {
                      onSuccess: () => {
                        setIsClearOpen(false);
                        update(id, {
                          editing: null,
                          error: null,
                          notice: clearLeadData
                            ? 'Chat history and lead data cleared.'
                            : 'Chat history cleared. Lead preserved.',
                        });
                      },
                    },
                  )
                }
              >
                {clear.isPending
                  ? 'Clearing…'
                  : clearLeadData
                    ? 'Clear chat & delete lead'
                    : 'Clear chat only'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
