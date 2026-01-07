'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { TicketCard } from './TicketCard';
import { TicketModal } from './TicketModal';
import { Button } from '@/components/ui/Button';

interface Member {
    id: string;
    name: string;
    avatar?: string | null;
    role: string;
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

interface RunningJob {
    id: string;
    ticketId: string;
    agentName: string;
    status: 'running' | 'completed' | 'failed';
}

interface KanbanBoardProps {
    tickets: Ticket[];
    members: Member[];
    onTicketUpdate: (id: string, data: Partial<Ticket>) => void;
    onTicketCreate: (data: Partial<Ticket>) => void;
    onTicketDelete: (id: string) => void;
    hasActiveProject?: boolean;
    onRefresh?: () => void;
}

const columns = [
    { id: 'TODO', title: 'To Do', color: 'text-[var(--text-secondary)]', icon: '📋' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'text-blue-500', icon: '🔄' },
    { id: 'IN_REVIEW', title: 'In Review', color: 'text-purple-500', icon: '👀' },
    { id: 'NEED_FIX', title: 'Need Fix', color: 'text-orange-500', icon: '🛠️' },
    { id: 'COMPLETE', title: 'Complete', color: 'text-emerald-500', icon: '✅' },
    { id: 'ON_HOLD', title: 'On Hold', color: 'text-amber-500', icon: '⏸️' },
];

export function KanbanBoard({ tickets, members, onTicketUpdate, onTicketCreate, onTicketDelete, hasActiveProject, onRefresh }: KanbanBoardProps) {
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [runningJobs, setRunningJobs] = useState<RunningJob[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Poll for running jobs
    useEffect(() => {
        const fetchRunningJobs = async () => {
            try {
                const res = await fetch('/api/agent/status');
                const data = await res.json();
                setRunningJobs(data.jobs || []);

                // If any job just completed, refresh the board
                const hasCompleted = data.jobs?.some((job: RunningJob) => job.status !== 'running');
                if (hasCompleted) {
                    onRefresh?.();
                }
            } catch (error) {
                console.error('Failed to fetch running jobs:', error);
            }
        };

        fetchRunningJobs();
        const interval = setInterval(fetchRunningJobs, 3000);
        return () => clearInterval(interval);
    }, [onRefresh]);

    const isTicketRunning = useCallback((ticketId: string) => {
        return runningJobs.some(job => job.ticketId === ticketId && job.status === 'running');
    }, [runningJobs]);

    const handleDragStart = (event: DragStartEvent) => {
        const ticket = tickets.find(t => t.id === event.active.id);
        if (ticket) setActiveTicket(ticket);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTicket(null);

        if (!over) return;

        const ticketId = active.id as string;
        const overId = over.id as string;

        // Check if dropped on a column
        const targetColumn = columns.find(col => col.id === overId);
        if (targetColumn) {
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket && ticket.status !== targetColumn.id) {
                onTicketUpdate(ticketId, { status: targetColumn.id });
            }
        }
    };

    const handleTicketClick = useCallback((ticket: Ticket) => {
        setSelectedTicket(ticket);
        setIsCreating(false);
        setIsModalOpen(true);
    }, []);

    const handleCreateClick = () => {
        setSelectedTicket(null);
        setIsCreating(true);
        setIsModalOpen(true);
    };

    const handleModalSave = (data: Partial<Ticket>) => {
        if (isCreating) {
            onTicketCreate(data);
        } else if (selectedTicket) {
            onTicketUpdate(selectedTicket.id, data);
        }
        setIsModalOpen(false);
    };

    const handleModalDelete = () => {
        if (selectedTicket) {
            onTicketDelete(selectedTicket.id);
            setIsModalOpen(false);
        }
    };

    const handleTicketStatusChange = useCallback(() => {
        onRefresh?.();
    }, [onRefresh]);

    const runningCount = runningJobs.filter(j => j.status === 'running').length;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Kanban Board</h2>
                        {runningCount > 0 && (
                            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                {runningCount} agent{runningCount > 1 ? 's' : ''} working
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                        Drag and drop tickets to change their status
                    </p>
                </div>
                <Button onClick={handleCreateClick} variant="primary">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Ticket
                </Button>
            </div>

            {/* Board */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {columns.map((column) => (
                        <KanbanColumn
                            key={column.id}
                            id={column.id}
                            title={column.title}
                            color={column.color}
                            icon={column.icon}
                            tickets={tickets.filter(t => t.status === column.id)}
                            onTicketClick={handleTicketClick}
                            runningTicketIds={runningJobs.filter(j => j.status === 'running').map(j => j.ticketId)}
                        />
                    ))}
                </div>

                <DragOverlay>
                    {activeTicket && (
                        <TicketCard
                            ticket={activeTicket}
                            onClick={() => { }}
                            isDragging
                            isRunning={isTicketRunning(activeTicket.id)}
                        />
                    )}
                </DragOverlay>
            </DndContext>

            {/* Modal */}
            <TicketModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                ticket={isCreating ? null : selectedTicket}
                members={members}
                onSave={handleModalSave}
                onDelete={isCreating ? undefined : handleModalDelete}
                hasActiveProject={hasActiveProject}
                onTicketStatusChange={handleTicketStatusChange}
            />
        </div>
    );
}
