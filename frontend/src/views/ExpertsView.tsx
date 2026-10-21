import * as React from 'react';
import {
  Users,
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useExperts,
  useCreateExpert,
  useDeleteExpert,
} from '@/hooks/useExperts';
import type { VerifiedExpert } from '@shared/types/expert.types';

export function ExpertsView() {
  const [sectorFilter, setSectorFilter] = React.useState<string>('all');
  const [languageFilter, setLanguageFilter] = React.useState<string>('all');
  const [emirateFilter, setEmirateFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showAddModal, setShowAddModal] = React.useState<boolean>(false);

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
    refetch,
  } = useExperts({
    sector: sectorFilter === 'all' ? undefined : sectorFilter,
    language: languageFilter === 'all' ? undefined : languageFilter,
    emirate: emirateFilter === 'all' ? undefined : emirateFilter,
  });

  const createExpertMutation = useCreateExpert();
  const deleteExpertMutation = useDeleteExpert();

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

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} from verified partners?`)) {
      deleteExpertMutation.mutate(id);
    }
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
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Verified Consulting Experts
          </h2>
          <p className="text-xs text-muted-foreground">
            Approved business setup consulting partners for UAE licensing, mainland, and sector handovers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => refetch()}
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
            <span>Add Verified Partner</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search partners, sectors..."
            className="pl-8 h-8 text-xs bg-card"
          />
        </div>

        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Sectors</option>
          <option value="tech">Tech & Software</option>
          <option value="e-commerce">E-Commerce & Retail</option>
          <option value="f&b">Food & Beverage</option>
          <option value="trading">General Trading</option>
          <option value="consulting">Professional Consulting</option>
        </select>

        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Languages</option>
          <option value="en">English (en)</option>
          <option value="ml">Malayalam (ml)</option>
          <option value="ar">Arabic (ar)</option>
          <option value="hi">Hindi (hi)</option>
        </select>

        <select
          value={emirateFilter}
          onChange={(e) => setEmirateFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Emirates</option>
          <option value="dubai">Dubai</option>
          <option value="abu_dhabi">Abu Dhabi</option>
          <option value="sharjah">Sharjah</option>
        </select>
      </div>

      {/* Experts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-6 w-full" />
            </Card>
          ))
        ) : filteredExperts && filteredExperts.length > 0 ? (
          filteredExperts.map((exp: VerifiedExpert) => (
            <Card
              key={exp.id}
              className="p-4 shadow-sm border-border/80 hover:border-primary/40 transition-colors space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      {exp.fullName}
                      {exp.isVerified && (
                        <span title="Verified Resider Partner">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      {exp.organizationName}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      exp.isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {exp.isAvailable ? 'Available' : 'Busy'}
                  </Badge>
                </div>

                {/* Sectors */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Sectors:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {exp.sectors.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Languages & Emirates */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Languages:</span>
                    <span className="font-medium text-foreground uppercase text-[11px]">
                      {exp.languages.join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Emirates:</span>
                    <span className="font-medium text-foreground capitalize text-[11px]">
                      {exp.emirates.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                {(exp.contactPhone || exp.contactEmail) && (
                  <div className="space-y-1 pt-1 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
                    {exp.contactPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{exp.contactPhone}</span>
                      </div>
                    )}
                    {exp.contactEmail && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-primary" />
                        <span>{exp.contactEmail}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  Partner ID: {exp.id.slice(0, 8)}...
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 px-2"
                  onClick={() => handleDelete(exp.id, exp.fullName)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl space-y-2">
            <Users className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-xs font-medium">No verified experts registered</p>
            <p className="text-[11px] opacity-70">
              Add consulting partners who handle UAE business setup, mainland licensing, or tax advisory.
            </p>
          </div>
        )}
      </div>

      {/* Add Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border animate-in fade-in duration-200">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Add Verified Consulting Partner
              </CardTitle>
              <CardDescription className="text-xs">
                Register an expert who can receive qualified business setup referrals
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Expert Full Name *</label>
                    <Input
                      required
                      placeholder="e.g. Shaji Rahman"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Organization / Firm *</label>
                    <Input
                      required
                      placeholder="e.g. Apex Corporate Services"
                      value={formOrg}
                      onChange={(e) => setFormOrg(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Sectors Covered (comma-separated) *
                  </label>
                  <Input
                    required
                    placeholder="tech, e-commerce, consulting, trading"
                    value={formSectors}
                    onChange={(e) => setFormSectors(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Languages (e.g. en, ml, ar)</label>
                    <Input
                      required
                      placeholder="en, ml"
                      value={formLanguages}
                      onChange={(e) => setFormLanguages(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Emirates (e.g. dubai, all)</label>
                    <Input
                      required
                      placeholder="dubai, all"
                      value={formEmirates}
                      onChange={(e) => setFormEmirates(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Direct WhatsApp / Phone</label>
                    <Input
                      placeholder="+971 50 999 8888"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="partner@apexcorp.ae"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
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
                    disabled={createExpertMutation.isPending}
                    className="gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{createExpertMutation.isPending ? 'Saving...' : 'Register Partner'}</span>
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
