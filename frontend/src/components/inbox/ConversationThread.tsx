import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowDown, PanelRight, Trash2, UserRound, MessageSquare } from 'lucide-react';
import type { ConversationWithDetails } from '@shared/types/crm.types';
import {
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
import { useComposerDraft } from '@/lib/ComposerContext';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { MessageItem } from './MessageItem';
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
  const clear = useClearConversationHistory(id);
  const { draft, update, start, finish } = useComposerDraft(id);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearLeadData, setClearLeadData] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const pendingDraft = draftQuery.data?.status === 'pending_review' ? draftQuery.data : null;
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
        await modify.mutateAsync({ draftId: draft.editing.id, modifiedText: text });
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

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!pendingDraft || !start(id, action)) return;
    try {
      if (action === 'approve') {
        isNearBottom.current = true;
        await approve.mutateAsync(pendingDraft.id);
      } else await reject.mutateAsync(pendingDraft.id);
      finish(id, {
        notice:
          action === 'approve'
            ? 'Draft approved. Check delivery status in the thread.'
            : 'Draft rejected. No reply was sent.',
      });
    } catch (error) {
      finish(id, {
        error:
          error instanceof ApiError && error.status === 409
            ? 'This draft was already reviewed. Refresh to see the latest state.'
            : action === 'approve'
              ? 'Could not confirm approval. Check the thread before trying again.'
              : 'Could not reject this draft. Please try again.',
      });
    }
  };

  return (
    <>
      <section
        aria-label={`Conversation with ${conversation.customerName}`}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to conversations"
              className="size-10 md:hidden"
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">
                {conversation.customerName || 'Unknown customer'}
              </h2>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {conversation.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
                {conversation.customerHandle ? ` · ${conversation.customerHandle}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear conversation history"
              title="Clear conversation history"
              className="size-10"
              disabled={isBusy || clear.isPending}
              onClick={() => setIsClearOpen(true)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              disabled={takeover.isPending || clear.isPending}
              onClick={() => takeover.mutate({ takeover: !conversation.humanTakeover })}
            >
              <UserRound aria-hidden="true" className="size-4" />
              {takeover.isPending
                ? 'Updating…'
                : conversation.humanTakeover
                  ? 'Release takeover'
                  : 'Take over'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 min-[1440px]:hidden"
              aria-label="Open customer details"
              onClick={() => setIsDetailsOpen(true)}
            >
              <PanelRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <div
          className={cn(
            'shrink-0 border-b border-border px-4 py-2 text-xs',
            conversation.humanTakeover ? 'bg-warning/10 text-warning' : 'text-muted-foreground',
          )}
        >
          {conversation.humanTakeover
            ? 'Human handling · AI replies paused'
            : `Conversation AI mode: ${conversation.aiMode === 'INHERIT' ? 'Inherit workspace setting' : conversation.aiMode === 'ON' ? 'On' : 'Off'}`}
        </div>
        {detailError && (
          <ErrorState message="Could not refresh conversation details." onRetry={onRetry} />
        )}
        {takeover.isError && (
          <ErrorState
            message="Could not change human handling. The previous state is unchanged."
            onRetry={() => takeover.mutate({ takeover: !conversation.humanTakeover })}
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
            className="h-full overflow-y-auto px-4 py-5 sm:px-5"
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
                  <p className="mb-6 text-center text-xs text-muted-foreground">
                    Recent history · up to 50 messages
                  </p>
                  <ol className="space-y-6">
                    {messages.data.map((message) => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        customerName={conversation.customerName || 'Customer'}
                      />
                    ))}
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
                    onApprove={() => {
                      void handleReview('approve');
                    }}
                    onReject={() => {
                      void handleReview('reject');
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
              className="absolute bottom-3 left-1/2 -translate-x-1/2"
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
        <CustomerDetails leadId={conversation.lead?.id ?? null} />
      </aside>
      {isDetailsOpen && (
        <Dialog
          title="Customer details"
          onClose={() => setIsDetailsOpen(false)}
          className="mr-0 h-dvh max-h-dvh max-w-sm rounded-none"
        >
          <CustomerDetails leadId={conversation.lead?.id ?? null} />
        </Dialog>
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
