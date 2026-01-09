'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import type { Conversation, ConversationMessage } from '@/lib/db';
import type { AgentProvider } from '@/lib/agent-jobs';

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

interface TicketSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: Ticket | null;
    members: Member[];
    onTicketUpdate: (id: string, data: Partial<Ticket>) => void;
    onTicketDelete?: (id: string) => void;
    hasActiveProject?: boolean;
}

const statusOptions = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'NEED_FIX', label: 'Need Fix' },
    { value: 'COMPLETE', label: 'Complete' },
    { value: 'ON_HOLD', label: 'On Hold' },
];

const priorityOptions = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
];

export function TicketSidebar({
    isOpen,
    onClose,
    ticket,
    members,
    onTicketUpdate,
    onTicketDelete,
    hasActiveProject
}: TicketSidebarProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('TODO');
    const [priority, setPriority] = useState('MEDIUM');
    const [assigneeId, setAssigneeId] = useState('');
    const [feedback, setFeedback] = useState('');
    const [provider, setProvider] = useState<AgentProvider>('opencode');
    const [executing, setExecuting] = useState(false);

    // Conversations
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Update form fields when ticket changes
    useEffect(() => {
        if (ticket) {
            setTitle(ticket.title);
            setDescription(ticket.description || '');
            setStatus(ticket.status);
            setPriority(ticket.priority);
            setAssigneeId(ticket.assignee_id || '');
        }
    }, [ticket]);

    // Fetch conversations when ticket changes
    useEffect(() => {
        if (!ticket) {
            setConversations([]);
            setSelectedConversationId(null);
            return;
        }

        const fetchConversations = async () => {
            try {
                const res = await fetch(`/api/conversations?ticket_id=${ticket.id}`);
                const data = await res.json();
                setConversations(data.conversations || []);

                // Auto-select the most recent conversation if none selected
                if (!selectedConversationId && data.conversations?.length > 0) {
                    setSelectedConversationId(data.conversations[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch conversations:', error);
            }
        };

        fetchConversations();
        // Poll every 2 seconds to keep conversations updated
        const interval = setInterval(fetchConversations, 2000);
        return () => clearInterval(interval);
    }, [ticket, selectedConversationId]);

    // Fetch messages for selected conversation
    useEffect(() => {
        if (!selectedConversationId) {
            setConversationMessages([]);
            return;
        }

        const fetchMessages = async () => {
            try {
                const res = await fetch(`/api/conversations/${selectedConversationId}`);
                const data = await res.json();
                setConversationMessages(data.messages || []);

                // Check if conversation is still running
                if (data.conversation?.status === 'running') {
                    setExecuting(true);
                } else {
                    setExecuting(false);
                }
            } catch (error) {
                console.error('Failed to fetch messages:', error);
            }
        };

        fetchMessages();
        // Poll faster for real-time updates (500ms)
        pollIntervalRef.current = setInterval(fetchMessages, 500);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [selectedConversationId]);

    const handleSave = () => {
        if (!ticket) return;
        onTicketUpdate(ticket.id, {
            title,
            description: description || null,
            status,
            priority,
            assignee_id: assigneeId || null,
        });
    };

    const handleDelete = () => {
        if (!ticket || !onTicketDelete) return;
        if (confirm('Are you sure you want to delete this ticket?')) {
            onTicketDelete(ticket.id);
            onClose();
        }
    };

    const handleExecuteAgent = async () => {
        if (!ticket || !ticket.assignee_id) return;

        setExecuting(true);

        try {
            const res = await fetch('/api/agent/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: ticket.id,
                    feedback: feedback.trim() || undefined,
                    provider,
                }),
            });

            const data = await res.json();

            if (data.success) {
                // Refresh conversations to include the new one
                const convRes = await fetch(`/api/conversations?ticket_id=${ticket.id}`);
                const convData = await convRes.json();
                setConversations(convData.conversations || []);

                // Select the new conversation
                if (data.conversation_id) {
                    setSelectedConversationId(data.conversation_id);
                }

                // Clear feedback
                setFeedback('');

                // Update ticket status
                setStatus('IN_PROGRESS');
            } else {
                alert(data.error || 'Failed to start agent');
                setExecuting(false);
            }
        } catch (error) {
            alert('Failed to start agent: ' + String(error));
            setExecuting(false);
        }
    };

    const memberOptions = [
        { value: '', label: 'Unassigned' },
        ...members.map(m => ({ value: m.id, label: `${m.avatar} ${m.name}` }))
    ];

    const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
    const isConversationRunning = selectedConversation?.status === 'running';

    if (!isOpen || !ticket) return null;

    return (
        <div
            className={`fixed right-0 top-[73px] bottom-0 w-[700px] bg-secondary border-l border-primary
            transition-transform duration-300 z-30 flex flex-col
            ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
            {/* Header */}
            <div className="p-4 border-b border-primary flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold text-primary">Ticket Details</h2>
                <button
                    onClick={onClose}
                    className="p-2 text-tertiary hover:text-primary hover:bg-tertiary rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Ticket Info - Compact */}
            <div className="p-4 border-b border-primary space-y-3 flex-shrink-0">
                <Input
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-sm"
                />
                <Textarea
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                    <Select
                        label="Status"
                        value={status}
                        onChange={setStatus}
                        options={statusOptions}
                        className="text-sm"
                    />
                    <Select
                        label="Priority"
                        value={priority}
                        onChange={setPriority}
                        options={priorityOptions}
                        className="text-sm"
                    />
                    <Select
                        label="Assignee"
                        value={assigneeId}
                        onChange={setAssigneeId}
                        options={memberOptions}
                        className="text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSave} variant="primary" size="sm">Save</Button>
                    {onTicketDelete && (
                        <Button onClick={handleDelete} variant="danger" size="sm">Delete</Button>
                    )}
                </div>
            </div>

            {/* AI Agent Execution Section */}
            {ticket.assignee_id && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Agent Control Panel */}
                    <div className="p-4 border-b border-primary space-y-3 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-primary flex items-center gap-2">
                                <span>🤖</span> AI Agent Execution
                            </span>
                            {!executing && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleExecuteAgent}
                                    disabled={!hasActiveProject}
                                >
                                    🚀 Execute Agent
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <label className="text-sm text-tertiary">Provider:</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setProvider('claude')}
                                    disabled={executing}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${provider === 'claude'
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-tertiary text-tertiary hover:text-primary'
                                        } ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    🟣 Claude
                                </button>
                                <button
                                    onClick={() => setProvider('opencode')}
                                    disabled={executing}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${provider === 'opencode'
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-tertiary text-tertiary hover:text-primary'
                                        } ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    🟢 OpenCode
                                </button>
                            </div>
                        </div>

                        <Textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Optional feedback or instructions for the agent..."
                            rows={2}
                            className="text-sm bg-tertiary"
                            disabled={executing}
                        />

                        {!hasActiveProject && (
                            <p className="text-sm text-amber-400">⚠️ Select a project first</p>
                        )}
                    </div>

                    {/* Conversations Section */}
                    <div className="flex-1 flex min-h-0">
                        {/* Conversation List */}
                        <div className="w-56 border-r border-primary overflow-y-auto flex-shrink-0">
                            <div className="p-2 bg-tertiary border-b border-primary">
                                <p className="text-xs font-medium text-muted">Execution History</p>
                            </div>
                            <ConversationList
                                conversations={conversations}
                                selectedId={selectedConversationId}
                                onSelect={setSelectedConversationId}
                            />
                        </div>

                        {/* Conversation View */}
                        <div className="flex-1 min-w-0">
                            <ConversationView
                                conversation={selectedConversation}
                                messages={conversationMessages}
                                isRunning={isConversationRunning}
                            />
                        </div>
                    </div>
                </div>
            )}

            {!ticket.assignee_id && (
                <div className="flex-1 flex items-center justify-center text-muted">
                    <div className="text-center">
                        <p className="text-lg mb-2">👤</p>
                        <p>Assign an agent to this ticket to execute tasks</p>
                    </div>
                </div>
            )}
        </div>
    );
}
