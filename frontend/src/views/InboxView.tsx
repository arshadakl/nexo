import * as React from 'react';
import {
  Search,
  Send,
  PauseCircle,
  PlayCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function InboxView() {
  const [selectedConvoId, setSelectedConvoId] = React.useState('1');
  const [filterChannel, setFilterChannel] = React.useState<'all' | 'instagram' | 'whatsapp'>('all');

  const sampleConversations = [
    {
      id: '1',
      name: 'Maria Garcia',
      handle: '@mariag_22',
      channel: 'instagram' as const,
      preview: 'I have a 3-year bachelor degree and want to apply for Canada Express Entry...',
      time: '2m ago',
      unread: 1,
      aiMode: 'ON',
      humanTakeover: false,
      leadScore: 78,
      status: 'collecting_information',
    },
    {
      id: '2',
      name: 'Rajesh Patel',
      handle: '+91 98765 43210',
      channel: 'whatsapp' as const,
      preview: 'Is IELTS mandatory for Germany student visa intake in September?',
      time: '18m ago',
      unread: 0,
      aiMode: 'ON',
      humanTakeover: false,
      leadScore: 65,
      status: 'collecting_information',
    },
    {
      id: '3',
      name: 'Chen Wei',
      handle: '@chenwei_travel',
      channel: 'instagram' as const,
      preview: 'I am getting married next month, want to inquire about spouse sponsorship visa...',
      time: '1h ago',
      unread: 0,
      aiMode: 'OFF',
      humanTakeover: true,
      leadScore: 84,
      status: 'needs_human_review',
    },
  ];

  const activeConvo = sampleConversations.find((c) => c.id === selectedConvoId) || sampleConversations[0]!;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-xl border border-border bg-card/40 backdrop-blur-md overflow-hidden">
      {/* Left panel: Conversation List */}
      <div className="w-80 lg:w-96 border-r border-border flex flex-col shrink-0">
        {/* Search & Channel Filter */}
        <div className="p-3 border-b border-border space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input placeholder="Search applicants, handles..." className="pl-9 h-9 text-xs" />
          </div>
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
        </div>

        {/* Conversation List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {sampleConversations.map((convo) => {
            const isSelected = convo.id === selectedConvoId;
            return (
              <div
                key={convo.id}
                onClick={() => setSelectedConvoId(convo.id)}
                className={`p-3.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-secondary/70 border-l-2 border-primary' : 'hover:bg-secondary/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-foreground truncate">{convo.name}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {convo.time}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Badge variant={convo.channel === 'instagram' ? 'instagram' : 'whatsapp'} className="text-[10px] py-0 px-1.5">
                    {convo.channel === 'instagram' ? 'IG DM' : 'WhatsApp'}
                  </Badge>
                  {convo.humanTakeover ? (
                    <Badge variant="warning" className="text-[10px] py-0 px-1.5">Staff Takeover</Badge>
                  ) : (
                    <Badge variant="success" className="text-[10px] py-0 px-1.5">AI Replying</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">Score: {convo.leadScore}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{convo.preview}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center panel: Active Message Thread */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        {/* Thread header */}
        <div className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
              {activeConvo.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{activeConvo.name}</span>
                <span className="text-xs text-muted-foreground">{activeConvo.handle}</span>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                Channel: <span className="capitalize text-foreground font-medium">{activeConvo.channel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeConvo.humanTakeover ? (
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 text-emerald-400">
                <PlayCircle className="w-3.5 h-3.5" />
                Resume AI
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 text-amber-400">
                <PauseCircle className="w-3.5 h-3.5" />
                Take Over Conversation
              </Button>
            )}
          </div>
        </div>

        {/* Message Thread History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Inbound Customer Message */}
          <div className="flex flex-col items-start max-w-lg">
            <div className="p-3.5 rounded-2xl rounded-tl-sm bg-secondary/70 border border-border text-xs text-foreground leading-relaxed">
              Hi! I have a 3-year bachelor degree in Computer Science and 4 years of software developer experience.
              Am I eligible for Canada Express Entry or PNP?
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 ml-1">Applicant • 11:28 AM</span>
          </div>

          {/* AI Outbound Reply */}
          <div className="flex flex-col items-end max-w-lg ml-auto">
            <div className="p-3.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-xs leading-relaxed shadow-sm">
              <div className="flex items-center gap-1 text-[10px] text-primary-foreground/80 font-semibold mb-1">
                <Sparkles className="w-3 h-3" />
                Nexo AI Assistant
              </div>
              Hello Maria! With 4 years of experience as a software developer and a degree, you may have strong prospects for Express Entry (FSW) or targeted tech PNP draws. Have you already taken an English test like IELTS or CELPIP?
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 mr-1">Delivered • 11:29 AM</span>
          </div>
        </div>

        {/* Reply Composer */}
        <div className="p-4 border-t border-border bg-card/60">
          <div className="flex gap-2">
            <Input placeholder="Type a message as staff... (manual send pauses AI)" className="text-xs h-10" />
            <Button size="default" className="gap-1.5 h-10 px-4">
              <Send className="w-4 h-4" />
              <span>Send</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Right side panel: Extracted Applicant Fields */}
      <div className="w-72 border-l border-border p-4 shrink-0 overflow-y-auto space-y-4 hidden xl:block bg-card/20">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extracted Profile</h4>
        
        <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground">Target Destination</span>
            <p className="font-semibold text-foreground">Canada</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Visa Category</span>
            <p className="font-semibold text-foreground">Express Entry / PR</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Work Experience</span>
            <p className="font-semibold text-foreground">4 years (Software Dev)</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Language Test</span>
            <p className="font-semibold text-amber-400">Pending</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Commercial Readiness</span>
            <span className="font-bold text-emerald-400">78 / 100</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '78%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
