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

    // UI state
    const [showTicketDetails, setShowTicketDetails] = useState(false);
    const [showAgentControls, setShowAgentControls] = useState(false);

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
            // Reset executing state and conversation selection when switching tickets
            setExecuting(false);
            setSelectedConversationId(null);
        }
    }, [ticket?.id]);

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

        let isCancelled = false;
        let wasRunning = false;

        const fetchMessages = async () => {
            if (isCancelled) return;

            try {
                const res = await fetch(`/api/conversations/${selectedConversationId}`);
                const data = await res.json();

                if (isCancelled) return;

                setConversationMessages(data.messages || []);

                const isCurrentlyRunning = data.conversation?.status === 'running';

                // Check if conversation is still running
                if (isCurrentlyRunning) {
                    setExecuting(true);
                    wasRunning = true;
                } else {
                    setExecuting(false);
                    // If conversation just completed (was running, now not), refresh ticket status
                    if (wasRunning && ticket && !isCancelled) {
                        wasRunning = false;
                        // Fetch updated ticket status
                        const ticketRes = await fetch(`/api/tickets/${ticket.id}`);
                        const ticketData = await ticketRes.json();
                        if (ticketData.status && !isCancelled) {
                            setStatus(ticketData.status);
                            onTicketUpdate(ticket.id, { status: ticketData.status });
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch messages:', error);
            }
        };

        fetchMessages();
        // Poll faster for real-time updates (500ms)
        pollIntervalRef.current = setInterval(fetchMessages, 500);

        return () => {
            isCancelled = true;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [selectedConversationId, ticket?.id, onTicketUpdate]);

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
        if (!ticket || !assigneeId) return;

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

                // Update ticket status locally and in parent
                setStatus('IN_PROGRESS');
                onTicketUpdate(ticket.id, { status: 'IN_PROGRESS' });

                // Close agent controls after execution
                setShowAgentControls(false);
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
        ...members
            .filter(m => m.role !== 'PM') // PM은 담당자로 선택 불가
            .map(m => ({ value: m.id, label: `${m.avatar} ${m.name}` }))
    ];

    const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
    const isConversationRunning = selectedConversation?.status === 'running';

    if (!isOpen || !ticket) return null;

    return (
        <div className="h-full bg-secondary border-l border-primary flex flex-col overflow-hidden">
            {/* Minimal Header */}
            <div className="p-3 border-b border-primary flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-primary truncate">{ticket.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-tertiary text-muted">{ticket.status}</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Menu Button */}
                    <button
                        onClick={() => setShowTicketDetails(!showTicketDetails)}
                        className="p-2 text-tertiary hover:text-primary hover:bg-tertiary rounded-lg transition-colors"
                        title="Ticket Details"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d={showTicketDetails ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                        </svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-tertiary hover:text-primary hover:bg-tertiary rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Collapsible Ticket Details */}
            {showTicketDetails && (
                <div className="p-4 border-b border-primary space-y-3 flex-shrink-0 bg-tertiary">
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
                        <Button onClick={() => setShowTicketDetails(false)} variant="ghost" size="sm">Close</Button>
                    </div>
                </div>
            )}

            {/* AI Agent Execution Section */}
            {assigneeId && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Minimal Agent Control Bar */}
                    <div className="p-2 border-b border-primary flex items-center justify-between flex-shrink-0 bg-tertiary/50">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary">🤖 AI Agent</span>
                            {ticket.assignee && (
                                <span className="text-xs text-muted">
                                    {ticket.assignee.avatar} {ticket.assignee.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!showAgentControls && !executing && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleExecuteAgent}
                                    disabled={!hasActiveProject}
                                >
                                    🚀 Execute
                                </Button>
                            )}
                            <button
                                onClick={() => setShowAgentControls(!showAgentControls)}
                                className="p-1.5 text-xs text-tertiary hover:text-primary hover:bg-tertiary rounded transition-colors"
                            >
                                {showAgentControls ? '▲' : '▼'}
                            </button>
                        </div>
                    </div>

                    {/* Collapsible Agent Controls */}
                    {showAgentControls && (
                        <div className="p-3 border-b border-primary space-y-2 flex-shrink-0 bg-tertiary/30">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-tertiary">Provider:</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setProvider('claude')}
                                        disabled={executing}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${provider === 'claude'
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-tertiary text-tertiary hover:text-primary'
                                            } ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        🟣 Claude
                                    </button>
                                    <button
                                        onClick={() => setProvider('opencode')}
                                        disabled={executing}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${provider === 'opencode'
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
                                placeholder="Optional feedback or instructions..."
                                rows={2}
                                className="text-xs bg-secondary"
                                disabled={executing}
                            />

                            {!hasActiveProject && (
                                <p className="text-xs text-amber-400">⚠️ Select a project first</p>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleExecuteAgent}
                                    disabled={!hasActiveProject || executing}
                                >
                                    🚀 Execute Agent
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowAgentControls(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Conversations Section - Takes up remaining 90%+ */}
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

            {!assigneeId && (
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
