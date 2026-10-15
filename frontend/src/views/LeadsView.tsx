import { Filter, ArrowUpDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function LeadsView() {
  const sampleLeads = [
    {
      id: '1',
      name: 'Maria Garcia',
      destination: 'Canada',
      category: 'Express Entry (FSW)',
      score: 78,
      status: 'collecting_information',
      channel: 'instagram',
      lastActive: '2m ago',
    },
    {
      id: '2',
      name: 'Rajesh Patel',
      destination: 'Germany',
      category: 'Student Visa',
      score: 65,
      status: 'collecting_information',
      channel: 'whatsapp',
      lastActive: '18m ago',
    },
    {
      id: '3',
      name: 'Chen Wei',
      destination: 'Australia',
      category: 'Partner Visa',
      score: 84,
      status: 'needs_human_review',
      channel: 'instagram',
      lastActive: '1h ago',
    },
    {
      id: '4',
      name: 'Elena Rostova',
      destination: 'UK',
      category: 'Skilled Worker',
      score: 92,
      status: 'qualified',
      channel: 'whatsapp',
      lastActive: '3h ago',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Status</span>
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort by Score</span>
          </Button>
        </div>

        <span className="text-xs text-muted-foreground">Showing 4 active leads</span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">Applicant</th>
                <th className="px-6 py-3 font-semibold">Destination & Category</th>
                <th className="px-6 py-3 font-semibold">Channel</th>
                <th className="px-6 py-3 font-semibold">Commercial Score</th>
                <th className="px-6 py-3 font-semibold">Pipeline Status</th>
                <th className="px-6 py-3 font-semibold">Last Active</th>
                <th className="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sampleLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground">{lead.name}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{lead.destination}</div>
                    <div className="text-[10px] text-muted-foreground">{lead.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={lead.channel === 'instagram' ? 'instagram' : 'whatsapp'} className="text-[10px]">
                      {lead.channel === 'instagram' ? 'Instagram' : 'WhatsApp'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold">
                    <span className={lead.score >= 80 ? 'text-emerald-400' : lead.score >= 60 ? 'text-indigo-400' : 'text-amber-400'}>
                      {lead.score} / 100
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        lead.status === 'qualified'
                          ? 'success'
                          : lead.status === 'needs_human_review'
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-[10px] capitalize"
                    >
                      {lead.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{lead.lastActive}</td>
                  <td className="px-6 py-4 text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
