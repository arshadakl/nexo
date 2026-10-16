import * as React from 'react';
import {
  X,
  User,
  MessageSquare,
  CheckCircle2,
  Save,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLead, useUpdateLead, useLeadNotes, useAddLeadNote } from '@/hooks/useLeads';
import type { LeadStatus } from '@shared/types/crm.types';

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onNavigateToInbox?: (conversationId: string) => void;
}

const LEAD_STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New Inquiry', value: 'new' },
  { label: 'Collecting Details', value: 'collecting_information' },
  { label: 'Qualified Hot Lead', value: 'qualified' },
  { label: 'Consultation Booked', value: 'consultation_booked' },
  { label: 'Client Converted', value: 'converted' },
  { label: 'Needs Human Review', value: 'needs_human_review' },
  { label: 'Unqualified', value: 'unqualified' },
  { label: 'Closed / Lost', value: 'closed_lost' },
];

export function LeadDrawer({ leadId, onClose, onNavigateToInbox }: LeadDrawerProps) {
  const { data: lead, isLoading } = useLead(leadId);
  const { data: notes } = useLeadNotes(leadId);
  const updateMutation = useUpdateLead(leadId);
  const addNoteMutation = useAddLeadNote(leadId);

  // Form state
  const [fullName, setFullName] = React.useState('');
  const [destinationCountry, setDestinationCountry] = React.useState('');
  const [visaCategory, setVisaCategory] = React.useState('');
  const [leadStatus, setLeadStatus] = React.useState<LeadStatus>('new');
  const [leadScore, setLeadScore] = React.useState(0);
  const [education, setEducation] = React.useState('');
  const [workExperience, setWorkExperience] = React.useState('');
  const [budgetRange, setBudgetRange] = React.useState('');
  const [timeline, setTimeline] = React.useState('');
  const [noteContent, setNoteContent] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  React.useEffect(() => {
    if (lead) {
      setFullName(lead.fullName || '');
      setDestinationCountry(lead.destinationCountry || '');
      setVisaCategory(lead.visaCategory || '');
      setLeadStatus(lead.leadStatus);
      setLeadScore(lead.leadScore);
      setEducation(lead.education || '');
      setWorkExperience(lead.workExperience || '');
      setBudgetRange(lead.budgetRange || '');
      setTimeline(lead.timeline || '');
    }
  }, [lead]);

  if (!leadId) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        fullName,
        destinationCountry,
        visaCategory,
        leadStatus,
        leadScore: Number(leadScore),
        education,
        workExperience,
        budgetRange,
        timeline,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        },
      }
    );
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteContent.trim();
    if (!trimmed) return;

    addNoteMutation.mutate(
      { content: trimmed },
      {
        onSuccess: () => {
          setNoteContent('');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Lead Dossier</span>
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : lead ? (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Linked Conversation Action */}
              {lead.linkedConversationIds && lead.linkedConversationIds.length > 0 && onNavigateToInbox && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">Active Chat Thread Available</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => {
                      const firstConvoId = lead.linkedConversationIds[0];
                      if (firstConvoId) {
                        onNavigateToInbox(firstConvoId);
                      }
                    }}
                  >
                    Open in Inbox
                  </Button>
                </div>
              )}

              {/* Status and Score */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Pipeline Status</label>
                  <select
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
                    className="w-full h-9 rounded-md border border-border bg-muted/40 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {LEAD_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Lead Score (0–100)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={leadScore}
                    onChange={(e) => setLeadScore(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Applicant Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Applicant name"
                  className="h-9 text-xs"
                />
              </div>

              {/* Target Country & Visa */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Destination</label>
                  <Input
                    value={destinationCountry}
                    onChange={(e) => setDestinationCountry(e.target.value)}
                    placeholder="e.g. Germany, Canada"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Visa Category</label>
                  <Input
                    value={visaCategory}
                    onChange={(e) => setVisaCategory(e.target.value)}
                    placeholder="e.g. Opportunity Card"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Education & Experience */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Education</label>
                <Input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. Bachelor in Computer Science"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Work Experience
                </label>
                <Input
                  value={workExperience}
                  onChange={(e) => setWorkExperience(e.target.value)}
                  placeholder="e.g. 5 years as Senior Software Engineer"
                  className="h-9 text-xs"
                />
              </div>

              {/* Budget & Timeline */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Budget Range</label>
                  <Input
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    placeholder="e.g. $10,000 - $15,000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Timeline</label>
                  <Input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. Next 3 months"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-full text-xs h-9 gap-1.5"
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Changes Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Lead Attributes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : null}

          {/* Internal Notes Section */}
          <div className="pt-5 border-t border-border space-y-3">
            <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Internal Counselor Notes
            </h5>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add private note for this applicant..."
                rows={2}
                className="w-full bg-muted/30 border border-border rounded-md p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Note</span>
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes && notes.length > 0 ? (
                notes.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
                    <p className="text-foreground whitespace-pre-wrap">{n.content}</p>
                    <span className="text-[10px] text-muted-foreground block">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No internal notes yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
