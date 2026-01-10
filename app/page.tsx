'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { KanbanBoard, TicketSidebar } from '@/components/kanban';
import { TeamPanel } from '@/components/team';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PMRequestModal } from '@/components/pm';
import { ProjectSelector } from '@/components/project';
import { Button } from '@/components/ui/Button';
import { ResizablePane } from '@/components/ui/ResizablePane';
import { ApiKeyModal } from '@/components/ui/ApiKeyModal';
import { CLIWarningModal } from '@/components/ui/CLIWarningModal';

interface RunningJob {
  id: string;
  ticketId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
}
interface Member {
  id: string;
  role: string;
  name: string;
  avatar?: string | null;
  system_prompt: string;
}

interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assignee_id?: string | null;
  assignee?: Member | null;
}

interface Project {
  id: string;
  name: string;
  path: string;
  is_active: number;
}

export default function Dashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketSidebarOpen, setTicketSidebarOpen] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [cliWarningModalOpen, setCliWarningModalOpen] = useState(false);
  const [runningJobs, setRunningJobs] = useState<RunningJob[]>([]);

  // Check for API key on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('openai_api_key');
    if (!storedKey) {
      // Check if there's an env variable
      fetch('/api/check-api-key')
        .then(res => res.json())
        .then(data => {
          if (!data.hasKey) {
            setApiKeyModalOpen(true);
          }
        })
        .catch(() => {
          // If check fails, show modal
          setApiKeyModalOpen(true);
        });
    }
  }, []);

  // Check for CLI tools on mount
  useEffect(() => {
    fetch('/api/check-cli')
      .then(res => res.json())
      .then(data => {
        if (!data.anyInstalled) {
          setCliWarningModalOpen(true);
        }
      })
      .catch(err => {
        console.error('Failed to check CLI installation:', err);
      });
  }, []);

  // Poll for running jobs
  useEffect(() => {
    const fetchRunningJobs = async () => {
      try {
        const res = await fetch('/api/agent/status');
        const data = await res.json();
        setRunningJobs(data.jobs || []);
      } catch (error) {
        console.error('Failed to fetch running jobs:', error);
      }
    };
    fetchRunningJobs();
    const interval = setInterval(fetchRunningJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data
  const fetchData = useCallback(async (projectId?: string) => {
    try {
      const ticketUrl = projectId
        ? `/api/tickets?projectId=${projectId}`
        : '/api/tickets';
      const [membersRes, ticketsRes] = await Promise.all([
        fetch('/api/members'),
        fetch(ticketUrl),
      ]);
      const [membersData, ticketsData] = await Promise.all([
        membersRes.json(),
        ticketsRes.json(),
      ]);
      setMembers(membersData);
      setTickets(ticketsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeProject?.id);
  }, [fetchData, activeProject]);

  const handleTicketCreate = useCallback(async (data: Partial<Ticket>) => {
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          project_id: activeProject?.id,
        }),
      });
      const newTicket = await res.json();
      setTickets(prev => [newTicket, ...prev]);
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  }, [activeProject]);

  const handleTicketUpdate = useCallback(async (id: string, data: Partial<Ticket>) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updatedTicket = await res.json();
      setTickets(prev => prev.map(t => t.id === id ? updatedTicket : t));
    } catch (error) {
      console.error('Failed to update ticket:', error);
    }
  }, []);

  const handleTicketDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete ticket:', error);
    }
  }, []);

  const handleMemberUpdate = useCallback(async (id: string, systemPrompt: string) => {
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      const updatedMember = await res.json();
      setMembers(prev => prev.map(m => m.id === id ? updatedMember : m));
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  }, []);

  const handlePMTicketsCreated = useCallback(() => {
    fetchData(activeProject?.id); // Refresh all data for current project
  }, [fetchData, activeProject]);

  const handleProjectChange = useCallback((project: Project | null) => {
    setActiveProject(project);
  }, []);

  const handleRefresh = useCallback(() => {
    fetchData(activeProject?.id);
  }, [fetchData, activeProject]);

  const handleApiKeySubmit = (apiKey: string) => {
    localStorage.setItem('openai_api_key', apiKey);
    setApiKeyModalOpen(false);
  };

  const handleCreateTicket = () => {
    handleTicketCreate({ title: 'New Ticket', status: 'TODO', priority: 'MEDIUM' });
  };

  const runningCount = runningJobs.filter(j => j.status === 'running').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/app-icon.png"
              alt="Olly Molly"
              width={28}
              height={28}
              className="opacity-80"
            />
            <h1 className="text-sm font-medium text-[var(--text-primary)]">Olly Molly</h1>
            {runningCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--status-progress-text)]">
                <span className="w-1.5 h-1.5 bg-[var(--status-progress-text)] rounded-full gentle-pulse" />
                {runningCount} working
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector onProjectChange={handleProjectChange} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPmModalOpen(true)}
            >
              PM 요청
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateTicket}
            >
              + New
            </Button>
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d={sidebarOpen
                    ? "M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-45px)]">
        <ResizablePane
          defaultLeftWidth={ticketSidebarOpen ? 55 : 100}
          minLeftWidth={30}
          minRightWidth={25}
          left={
            <div className="h-full overflow-auto">
              <KanbanBoard
                tickets={tickets}
                members={members}
                onTicketCreate={handleTicketCreate}
                onTicketUpdate={handleTicketUpdate}
                onTicketDelete={handleTicketDelete}
                hasActiveProject={!!activeProject}
                onRefresh={handleRefresh}
                onTicketSelect={(ticket) => {
                  setSelectedTicket(ticket);
                  setTicketSidebarOpen(true);
                }}
              />
            </div>
          }
          right={
            ticketSidebarOpen && selectedTicket ? (
              <TicketSidebar
                isOpen={ticketSidebarOpen}
                onClose={() => {
                  setTicketSidebarOpen(false);
                  setSelectedTicket(null);
                }}
                ticket={selectedTicket}
                members={members}
                onTicketUpdate={handleTicketUpdate}
                onTicketDelete={handleTicketDelete}
                hasActiveProject={!!activeProject}
              />
            ) : (
              <div className="h-full bg-secondary border-l border-primary flex items-center justify-center text-muted">
                <p>Select a ticket to view details</p>
              </div>
            )
          }
        />

        {/* Team Sidebar */}
        <aside className={`
          fixed right-0 top-[45px] bottom-0 w-72 bg-[var(--bg-secondary)] border-l border-[var(--border-primary)]
          p-4 transition-transform duration-200 overflow-hidden z-20
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <TeamPanel members={members} onUpdateMember={handleMemberUpdate} />
        </aside>
      </div>

      {/* PM Request Modal */}
      <PMRequestModal
        isOpen={pmModalOpen}
        onClose={() => setPmModalOpen(false)}
        onTicketsCreated={handlePMTicketsCreated}
        projectId={activeProject?.id}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => { }}
        onSubmit={handleApiKeySubmit}
      />

      {/* CLI Warning Modal */}
      <CLIWarningModal
        isOpen={cliWarningModalOpen}
        onClose={() => setCliWarningModalOpen(false)}
      />
    </div>
  );
}
