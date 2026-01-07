'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ActivityLog } from '@/components/activity/ActivityLog';

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
    created_at?: string;
    updated_at?: string;
}

interface TicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket?: Ticket | null;
    members: Member[];
    onSave: (data: Partial<Ticket>) => void;
    onDelete?: () => void;
}

const statusOptions = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'COMPLETE', label: 'Complete' },
    { value: 'ON_HOLD', label: 'On Hold' },
];

const priorityOptions = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
];

export function TicketModal({ isOpen, onClose, ticket, members, onSave, onDelete }: TicketModalProps) {
    const [title, setTitle] = useState(ticket?.title || '');
    const [description, setDescription] = useState(ticket?.description || '');
    const [status, setStatus] = useState(ticket?.status || 'TODO');
    const [priority, setPriority] = useState(ticket?.priority || 'MEDIUM');
    const [assigneeId, setAssigneeId] = useState(ticket?.assignee_id || '');
    const [showLogs, setShowLogs] = useState(false);

    const isEditing = !!ticket;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            title,
            description: description || null,
            status,
            priority,
            assignee_id: assigneeId || null,
        });
    };

    const memberOptions = [
        { value: '', label: 'Unassigned' },
        ...members.map(m => ({ value: m.id, label: `${m.avatar} ${m.name}` }))
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Ticket' : 'Create Ticket'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter ticket title"
                    required
                />

                <Textarea
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter ticket description"
                    rows={4}
                />

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Status"
                        value={status}
                        onChange={setStatus}
                        options={statusOptions}
                    />
                    <Select
                        label="Priority"
                        value={priority}
                        onChange={setPriority}
                        options={priorityOptions}
                    />
                </div>

                <Select
                    label="Assignee"
                    value={assigneeId}
                    onChange={setAssigneeId}
                    options={memberOptions}
                />

                {isEditing && ticket && (
                    <div className="pt-4 border-t border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setShowLogs(!showLogs)}
                            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            {showLogs ? 'Hide Activity Log' : 'Show Activity Log'}
                        </button>

                        {showLogs && (
                            <div className="mt-4 max-h-48 overflow-y-auto">
                                <ActivityLog ticketId={ticket.id} />
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-3 pt-4">
                    {isEditing && onDelete && (
                        <Button type="button" variant="danger" onClick={onDelete}>
                            Delete
                        </Button>
                    )}
                    <div className="flex-1" />
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                        {isEditing ? 'Save Changes' : 'Create Ticket'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
