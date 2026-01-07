'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTicket } from './SortableTicket';

interface Ticket {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    assignee?: {
        id: string;
        name: string;
        avatar?: string | null;
        role: string;
        system_prompt: string;
    } | null;
}

interface KanbanColumnProps {
    id: string;
    title: string;
    tickets: Ticket[];
    color: string;
    icon: string;
    onTicketClick: (ticket: Ticket) => void;
    runningTicketIds?: string[];
}

export function KanbanColumn({ id, title, tickets, color, icon, onTicketClick, runningTicketIds = [] }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`
        flex-1 min-w-[280px] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]
        flex flex-col max-h-[calc(100vh-200px)]
        ${isOver ? 'border-indigo-500/50 bg-indigo-500/5' : ''}
      `}
        >
            {/* Column Header */}
            <div className="p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h3 className={`font-semibold ${color}`}>{title}</h3>
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] rounded-full">
                        {tickets.length}
                    </span>
                </div>
            </div>

            {/* Tickets */}
            <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tickets.map((ticket) => (
                        <SortableTicket
                            key={ticket.id}
                            ticket={ticket}
                            onTicketClick={onTicketClick}
                            isRunning={runningTicketIds.includes(ticket.id)}
                        />
                    ))}
                </SortableContext>

                {tickets.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
                        No tickets
                    </div>
                )}
            </div>
        </div>
    );
}
