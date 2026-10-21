import * as React from 'react';
import {
  X,
  User,
  MessageSquare,
  CheckCircle2,
  Save,
  Plus,
  Briefcase,
  Building2,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLead, useUpdateLead, useLeadNotes, useAddLeadNote } from '@/hooks/useLeads';
import { useExperts } from '@/hooks/useExperts';
import type {
  LeadStatus,
  ServiceVertical,
  ResidencyIntent,
  LocationContext,
  ContactMethodPreference,
} from '@shared/types/crm.types';

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onNavigateToInbox?: (conversationId: string) => void;
}

const LEAD_STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'Ready for Team', value: 'ready_for_team' },
  { label: 'Handover Requested', value: 'handover_requested' },
  { label: 'Handed Over', value: 'handed_over' },
  { label: 'Exploring Options', value: 'exploring' },
  { label: 'Needs Clarification', value: 'needs_clarification' },
  { label: 'Support / General Enquiry', value: 'support_enquiry' },
  { label: 'Outside Scope / Spam', value: 'outside_scope_spam' },
];

export function LeadDrawer({ leadId, onClose, onNavigateToInbox }: LeadDrawerProps) {
  const { data: lead, isLoading } = useLead(leadId);
  const { data: notes } = useLeadNotes(leadId);
  const { data: experts } = useExperts();
  const updateMutation = useUpdateLead(leadId);
  const addNoteMutation = useAddLeadNote(leadId);

  // Form state
  const [fullName, setFullName] = React.useState('');
  const [phoneOrEmail, setPhoneOrEmail] = React.useState('');
  const [serviceVertical, setServiceVertical] = React.useState<ServiceVertical>('unspecified');
  const [residencyIntent, setResidencyIntent] = React.useState<ResidencyIntent>('unspecified');
  const [workBusinessActivity, setWorkBusinessActivity] = React.useState('');
  const [uaeLocationContext, setUaeLocationContext] = React.useState<LocationContext>('unknown');
  const [targetEmirate, setTargetEmirate] = React.useState('');
  const [timeline, setTimeline] = React.useState('');
  const [detectedLanguage, setDetectedLanguage] = React.useState('en');
  const [leadStatus, setLeadStatus] = React.useState<LeadStatus>('needs_clarification');
  const [statusReason, setStatusReason] = React.useState('');
  const [contactMethodPreference, setContactMethodPreference] = React.useState<string>('whatsapp');
  const [contactPermission, setContactPermission] = React.useState(false);
  const [externalSharingPermission, setExternalSharingPermission] = React.useState(false);
  const [assignedExpertId, setAssignedExpertId] = React.useState<string>('');
  const [noteContent, setNoteContent] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  React.useEffect(() => {
    if (lead) {
      setFullName(lead.fullName || '');
      setPhoneOrEmail(lead.phoneOrEmail || lead.phoneNumber || '');
      setServiceVertical(lead.serviceVertical || 'unspecified');
      setResidencyIntent(lead.residencyIntent || 'unspecified');
      setWorkBusinessActivity(lead.workBusinessActivity || '');
      setUaeLocationContext(lead.uaeLocationContext || 'unknown');
      setTargetEmirate(lead.targetEmirate || '');
      setTimeline(lead.timeline || '');
      setDetectedLanguage(lead.detectedLanguage || 'en');
      setLeadStatus(lead.leadStatus);
      setStatusReason(lead.statusReason || '');
      setContactMethodPreference(lead.contactMethodPreference || 'whatsapp');
      setContactPermission(Boolean(lead.contactPermission));
      setExternalSharingPermission(Boolean(lead.externalSharingPermission));
      setAssignedExpertId(lead.assignedExpertId || '');
    }
  }, [lead]);

  if (!leadId) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        fullName,
        phoneOrEmail,
        serviceVertical,
        residencyIntent,
        workBusinessActivity,
        uaeLocationContext,
        targetEmirate,
        timeline,
        detectedLanguage,
        leadStatus,
        statusReason,
        contactMethodPreference: contactMethodPreference as ContactMethodPreference,
        contactPermission,
        externalSharingPermission,
        assignedExpertId: assignedExpertId || null,
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-card border-l border-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {fullName || 'Resider Customer Profile'}
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">ID: {leadId}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lead?.linkedConversationIds && lead.linkedConversationIds.length > 0 && onNavigateToInbox && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    const firstConvoId = lead.linkedConversationIds[0];
                    if (firstConvoId) {
                      onNavigateToInbox(firstConvoId);
                      onClose();
                    }
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Chat</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <form id="lead-form" onSubmit={handleSave} className="space-y-5">
                {/* Status & Rationale Callout */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-primary" />
                      Resider Lifecycle Status
                    </label>
                    <select
                      value={leadStatus}
                      onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
                      className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {LEAD_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Status Rationale / Audit Evidence</label>
                    <Input
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      placeholder="e.g. Customer requested call after receiving 6 stages"
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                </div>

                {/* Identity & Contact Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Identity
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Customer Full Name</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Nair"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Phone or WhatsApp</label>
                      <Input
                        value={phoneOrEmail}
                        onChange={(e) => setPhoneOrEmail(e.target.value)}
                        placeholder="+971 50 123 4567"
                        className="h-8 text-xs bg-card font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* UAE Program Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                    Service Vertical & Intent
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Vertical</label>
                      <select
                        value={serviceVertical}
                        onChange={(e) => setServiceVertical(e.target.value as ServiceVertical)}
                        className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="unspecified">Unspecified</option>
                        <option value="residency">UAE Residency</option>
                        <option value="business_setup">Business Setup</option>
                        <option value="both">Residency + Setup</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Residency Intent</label>
                      <select
                        value={residencyIntent}
                        onChange={(e) => setResidencyIntent(e.target.value as ResidencyIntent)}
                        className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="unspecified">Unspecified</option>
                        <option value="permit_with_residency">Permit + Residency</option>
                        <option value="residency_only">Residency Only</option>
                        <option value="understanding_options">Understanding Options</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Business Activity / Field</label>
                      <Input
                        value={workBusinessActivity}
                        onChange={(e) => setWorkBusinessActivity(e.target.value)}
                        placeholder="e.g. IT Consulting / E-Commerce"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Location Context</label>
                      <select
                        value={uaeLocationContext}
                        onChange={(e) => setUaeLocationContext(e.target.value as LocationContext)}
                        className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="inside_uae">Inside UAE</option>
                        <option value="outside_uae">Outside UAE</option>
                        <option value="undecided">Undecided</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Target Emirate</label>
                      <Input
                        value={targetEmirate}
                        onChange={(e) => setTargetEmirate(e.target.value)}
                        placeholder="Dubai / Abu Dhabi / Sharjah"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Detected Language</label>
                      <Input
                        value={detectedLanguage}
                        onChange={(e) => setDetectedLanguage(e.target.value)}
                        placeholder="Malayalam / English / Manglish"
                        className="h-8 text-xs bg-card"
                      />
                    </div>
                  </div>
                </div>

                {/* Handover & Privacy Guardrails */}
                <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border/80">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Handover Permissions & Guardrails
                  </h4>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={contactPermission}
                        onChange={(e) => setContactPermission(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>Customer granted direct contact permission (WhatsApp / Call)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={externalSharingPermission}
                        onChange={(e) => setExternalSharingPermission(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>Customer granted external sharing permission for verified expert partners</span>
                    </label>
                  </div>
                </div>

                {/* Assigned Expert Selector */}
                <div className="space-y-2 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
                  <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Assigned Verified Partner Expert
                  </label>
                  <select
                    value={assignedExpertId}
                    onChange={(e) => setAssignedExpertId(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">No expert assigned</option>
                    {(experts || []).map((exp) => (
                      <option key={exp.id} value={exp.id}>
                        {exp.fullName} — {exp.organizationName} ({exp.sectors.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            )}

            {/* Internal Staff Notes */}
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Staff Notes & Timeline
              </h4>

              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Log consultation details or next steps..."
                  rows={2}
                  className="w-full bg-muted/20 border border-border rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={!noteContent.trim() || addNoteMutation.isPending}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Note</span>
                  </Button>
                </div>
              </form>

              <div className="space-y-2 pt-2">
                {notes && notes.length > 0 ? (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">Staff Member</span>
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    No internal notes logged yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Changes saved!
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Resider CRM synchronization
              </span>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                form="lead-form"
                disabled={updateMutation.isPending}
                className="gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{updateMutation.isPending ? 'Saving...' : 'Save Profile'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
