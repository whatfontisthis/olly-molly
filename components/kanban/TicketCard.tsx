'use client';

import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';

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

interface TicketCardProps {
    ticket: Ticket;
    onClick: () => void;
    isDragging?: boolean;
    isRunning?: boolean;
}

export function TicketCard({ ticket, onClick, isDragging, isRunning }: TicketCardProps) {
    const roleImages: Record<string, string> = {
        PM: '/profiles/pm.png',
        FE_DEV: '/profiles/dev-frontend.png',
        BACKEND_DEV: '/profiles/dev-backend.png',
    };

    const profileImage = ticket.assignee ? roleImages[ticket.assignee.role] : undefined;

    return (
        <div
            onClick={onClick}
            className={`
        p-3 bg-[var(--bg-card)] rounded-lg border cursor-pointer
        hover:border-[var(--border-secondary)] hover:bg-[var(--bg-card-hover)] transition-all duration-200
        ${isDragging ? 'opacity-50 scale-105 shadow-xl' : ''}
        ${isRunning ? 'border-blue-500/50 ring-2 ring-blue-500/20' : 'border-[var(--border-primary)]'}
      `}
        >
            <div className="flex items-start gap-2 mb-2">
                <h4 className="flex-1 text-sm font-medium text-[var(--text-primary)] line-clamp-2">
                    {isRunning && (
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1.5 align-middle" />
                    )}
                    {ticket.title}
                </h4>
                <PriorityBadge priority={ticket.priority} />
            </div>

            {ticket.description && (
                <p className="text-xs text-[var(--text-tertiary)] mb-3 line-clamp-2">
                    {ticket.description}
                </p>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {ticket.assignee ? (
                        <>
                            <Avatar
                                name={ticket.assignee.name}
                                src={profileImage}
                                emoji={!profileImage ? ticket.assignee.avatar : undefined}
                                badge={profileImage ? ticket.assignee.avatar : undefined}
                                size="sm"
                            />
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {isRunning ? (
                                    <span className="text-blue-400">작업 중...</span>
                                ) : (
                                    ticket.assignee.name
                                )}
                            </span>
                        </>
                    ) : (
                        <span className="text-xs text-[var(--text-muted)] italic">Unassigned</span>
                    )}
                </div>
                <StatusBadge status={ticket.status} />
            </div>
        </div>
    );
}
