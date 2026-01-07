'use client';

import { useState, useEffect, useCallback } from 'react';
import { KanbanBoard } from '@/components/kanban';
import { TeamPanel } from '@/components/team';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PMRequestModal } from '@/components/pm';
import { ProjectSelector } from '@/components/project';
import { Button } from '@/components/ui/Button';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [membersRes, ticketsRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/tickets'),
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
    fetchData();
  }, [fetchData]);

  const handleTicketCreate = useCallback(async (data: Partial<Ticket>) => {
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const newTicket = await res.json();
      setTickets(prev => [newTicket, ...prev]);
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  }, []);

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
    fetchData(); // Refresh all data
  }, [fetchData]);

  const handleProjectChange = useCallback((project: Project | null) => {
    setActiveProject(project);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-tertiary">Loading AI Dev Team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary/80 backdrop-blur-xl border-b border-primary">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                            flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">AI Dev Team</h1>
              <p className="text-xs text-muted">Manage your AI development team</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Project Selector */}
            <ProjectSelector onProjectChange={handleProjectChange} />
            {/* PM Request Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPmModalOpen(true)}
              className="gap-2"
            >
              <span>👔</span>
              PM에게 요청
            </Button>
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-tertiary hover:text-primary hover:bg-tertiary rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={sidebarOpen
                    ? "M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Kanban Board */}
        <main className={`flex-1 p-6 transition-all duration-300 ${sidebarOpen ? 'mr-80' : ''}`}>
          <KanbanBoard
            tickets={tickets}
            members={members}
            onTicketCreate={handleTicketCreate}
            onTicketUpdate={handleTicketUpdate}
            onTicketDelete={handleTicketDelete}
            hasActiveProject={!!activeProject}
            onRefresh={fetchData}
          />
        </main>

        {/* Team Sidebar */}
        <aside className={`
          fixed right-0 top-[73px] bottom-0 w-80 bg-secondary border-l border-primary
          p-4 transition-transform duration-300 overflow-hidden
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
      />
    </div>
  );
}
