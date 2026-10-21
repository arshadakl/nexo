import * as React from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Phone,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import { Field } from '@/components/ui/Field';
import {
  useExperts,
  useCreateExpert,
  useDeleteExpert,
} from '@/hooks/useExperts';
import { partnersHref, navigate, type WorkspaceRoute } from '@/lib/navigation';
import type { VerifiedExpert } from '@shared/types/expert.types';

interface ExpertsViewProps {
  route?: WorkspaceRoute;
}

export function ExpertsView({ route }: ExpertsViewProps = {}) {
  const [sectorFilter, setSectorFilter] = React.useState<string>(route?.partnerSector || 'all');
  const [languageFilter, setLanguageFilter] = React.useState<string>('all');
  const [emirateFilter, setEmirateFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>(route?.search || '');
  const [showAddModal, setShowAddModal] = React.useState<boolean>(false);
  const [deletingPartner, setDeletingPartner] = React.useState<{ id: string; name: string } | null>(null);

  // Form state
  const [formName, setFormName] = React.useState('');
  const [formOrg, setFormOrg] = React.useState('');
  const [formSectors, setFormSectors] = React.useState('tech, consulting');
  const [formLanguages, setFormLanguages] = React.useState('en, ml');
  const [formEmirates, setFormEmirates] = React.useState('dubai, all');
  const [formPhone, setFormPhone] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');

  const {
    data: experts,
    isLoading,
    isError,
    refetch,
  } = useExperts({
    sector: sectorFilter === 'all' ? undefined : sectorFilter,
    language: languageFilter === 'all' ? undefined : languageFilter,
    emirate: emirateFilter === 'all' ? undefined : emirateFilter,
  });

  const createExpertMutation = useCreateExpert();
  const deleteExpertMutation = useDeleteExpert();

  const handleSectorChange = (sector: string) => {
    setSectorFilter(sector);
    navigate(partnersHref({ sector, search: searchQuery }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formOrg.trim()) return;

    const sectors = formSectors
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const languages = formLanguages
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const emirates = formEmirates
      .split(',')
      .map((em) => em.trim().toLowerCase())
      .filter(Boolean);

    createExpertMutation.mutate(
      {
        fullName: formName.trim(),
        organizationName: formOrg.trim(),
        sectors,
        languages,
        emirates,
        servicesOffered: ['business_setup', 'licensing'],
        contactPhone: formPhone.trim() || undefined,
        contactEmail: formEmail.trim() || undefined,
        isVerified: true,
        isAvailable: true,
      },
      {
        onSuccess: () => {
          setShowAddModal(false);
          setFormName('');
          setFormOrg('');
          setFormPhone('');
          setFormEmail('');
        },
      }
    );
  };

  const filteredExperts = (experts || []).filter((exp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      exp.fullName.toLowerCase().includes(q) ||
      exp.organizationName.toLowerCase().includes(q) ||
      exp.sectors.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content-primary flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" aria-hidden="true" />
            Verified consulting partners
          </h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Approved business setup consulting partners for UAE licensing, mainland, and sector handovers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5 bg-surface-panel border-border"
            onClick={() => { void refetch(); }}
            title="Refresh partners list"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add verified partner</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search partners, sectors…"
            className="pl-8 h-8 text-xs bg-surface-panel border-border"
            aria-label="Search partners"
          />
        </div>

        <select
          value={sectorFilter}
          onChange={(e) => handleSectorChange(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface-panel px-2.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Filter by sector"
        >
          <option value="all">All sectors</option>
          <option value="tech">Tech & software</option>
          <option value="e-commerce">E-Commerce & retail</option>
          <option value="f&b">Food & beverage</option>
          <option value="trading">General trading</option>
          <option value="consulting">Professional consulting</option>
        </select>

        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface-panel px-2.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Filter by language"
        >
          <option value="all">All languages</option>
          <option value="en">English (en)</option>
          <option value="ml">Malayalam (ml)</option>
          <option value="ar">Arabic (ar)</option>
          <option value="hi">Hindi (hi)</option>
        </select>

        <select
          value={emirateFilter}
          onChange={(e) => setEmirateFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface-panel px-2.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Filter by emirate"
        >
          <option value="all">All emirates</option>
          <option value="dubai">Dubai</option>
          <option value="abu_dhabi">Abu Dhabi</option>
          <option value="sharjah">Sharjah</option>
        </select>
      </div>

      {/* Directory Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-surface-panel">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-surface-base border-b border-border text-content-secondary text-[11px] uppercase tracking-wider font-medium">
            <tr>
              <th className="px-4 py-2.5">Partner</th>
              <th className="px-4 py-2.5">Sectors</th>
              <th className="px-4 py-2.5">Languages</th>
              <th className="px-4 py-2.5">Emirates</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-danger">
                  Could not load partners. Please check your connection and retry.
                </td>
              </tr>
            ) : filteredExperts && filteredExperts.length > 0 ? (
              filteredExperts.map((exp: VerifiedExpert) => (
                <tr
                  key={exp.id}
                  className="hover:bg-surface-hover/70 transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-content-primary flex items-center gap-1.5">
                      {exp.fullName}
                      {exp.isVerified && (
                        <span title="Verified Resider partner" aria-label="Verified">
                          <ShieldCheck className="w-3.5 h-3.5 text-success" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-content-secondary mt-0.5">
                      {exp.organizationName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {exp.sectors.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-surface-base text-content-secondary capitalize"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-content-primary uppercase text-[11px] font-mono">
                    {exp.languages.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-content-primary capitalize text-[11px]">
                    {exp.emirates.join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-[11px] font-medium ${
                        exp.isAvailable ? 'text-success' : 'text-content-secondary'
                      }`}
                    >
                      {exp.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-content-secondary text-[11px] font-mono space-y-0.5">
                    {exp.contactPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                        <span>{exp.contactPhone}</span>
                      </div>
                    )}
                    {exp.contactEmail && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                        <span>{exp.contactEmail}</span>
                      </div>
                    )}
                    {!exp.contactPhone && !exp.contactEmail && <span>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-danger hover:text-danger hover:bg-danger/10 px-2"
                      onClick={() => setDeletingPartner({ id: exp.id, name: exp.fullName })}
                      title={`Remove ${exp.fullName}`}
                      aria-label={`Remove partner ${exp.fullName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-content-secondary">
                  <p className="font-medium text-sm text-content-primary">No partners found</p>
                  <p className="text-xs mt-1">
                    Add consulting partners who handle UAE business setup, mainland licensing, or tax advisory.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Partner Dialog */}
      {showAddModal && (
        <Dialog
          title="Add verified consulting partner"
          onClose={() => setShowAddModal(false)}
          isBusy={createExpertMutation.isPending}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 p-5">
            <p className="text-xs text-content-secondary">
              Register an accredited partner who can receive qualified business setup referrals and customer handovers.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field
                required
                label="Partner full name *"
                placeholder="e.g. Shaji Rahman"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
              <Field
                required
                label="Organization / firm *"
                placeholder="e.g. Apex Corporate Services"
                value={formOrg}
                onChange={(e) => setFormOrg(e.target.value)}
              />
            </div>

            <Field
              required
              label="Sectors covered (comma-separated) *"
              placeholder="tech, e-commerce, consulting, trading"
              value={formSectors}
              onChange={(e) => setFormSectors(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                required
                label="Languages (e.g. en, ml, ar)"
                placeholder="en, ml"
                value={formLanguages}
                onChange={(e) => setFormLanguages(e.target.value)}
              />
              <Field
                required
                label="Emirates (e.g. dubai, all)"
                placeholder="dubai, all"
                value={formEmirates}
                onChange={(e) => setFormEmirates(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Direct phone / WhatsApp"
                placeholder="+971 50 999 8888"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
              <Field
                label="Email address"
                type="email"
                placeholder="partner@apexcorp.ae"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            {createExpertMutation.isError && (
              <p role="alert" className="text-xs text-danger">
                {createExpertMutation.error.message || 'Could not register partner.'}
              </p>
            )}

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={createExpertMutation.isPending}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createExpertMutation.isPending || !formName.trim() || !formOrg.trim()}
              >
                {createExpertMutation.isPending ? 'Saving…' : 'Register partner'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Remove Confirmation Dialog */}
      {deletingPartner && (
        <ConfirmAction
          title={`Remove ${deletingPartner.name}?`}
          actionLabel="Remove partner"
          onConfirm={async () => {
            await deleteExpertMutation.mutateAsync(deletingPartner.id);
          }}
          onClose={() => setDeletingPartner(null)}
        >
          Are you sure you want to remove this partner? Existing handover records will be preserved.
        </ConfirmAction>
      )}
    </div>
  );
}
