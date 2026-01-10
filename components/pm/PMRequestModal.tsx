'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface CreatedTicket {
    id: string;
    title: string;
    description: string;
    priority: string;
    assigned_role: string;
    assignee?: {
        name: string;
        avatar: string;
    };
}

interface PMRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTicketsCreated: () => void;
    projectId?: string;
}

export function PMRequestModal({ isOpen, onClose, onTicketsCreated, projectId }: PMRequestModalProps) {
    const [request, setRequest] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        message: string;
        summary?: string;
        tickets: CreatedTicket[];
    } | null>(null);

    const handleSubmit = async () => {
        if (!request.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const apiKey = localStorage.getItem('openai_api_key');
            const res = await fetch('/api/pm/breakdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request: request.trim(),
                    project_id: projectId,
                    api_key: apiKey,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to process request');
            }

            if (data.success) {
                setResult({
                    message: data.message,
                    summary: data.ai_summary,
                    tickets: data.tickets,
                });
                onTicketsCreated();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setRequest('');
        setResult(null);
        setError(null);
        onClose();
    };

    const roleColors: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
        FE_DEV: 'info',
        BACKEND_DEV: 'success',
        QA: 'warning',
        DEVOPS: 'default',
    };

    const roleLabels: Record<string, string> = {
        FE_DEV: 'Frontend',
        BACKEND_DEV: 'Backend',
        QA: 'QA',
        DEVOPS: 'DevOps',
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="🤖 PM에게 기능 요청하기" size="lg">
            {!result ? (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                        <Avatar name="PM Agent" emoji="👔" size="md" />
                        <div>
                            <p className="font-medium text-[var(--text-primary)]">PM Agent</p>
                            <p className="text-sm text-[var(--text-tertiary)]">
                                어떤 기능을 만들고 싶으신가요? AI가 요청을 분석해서 적절한 태스크로 분해하고 팀원들에게 자동 할당해 드릴게요.
                            </p>
                        </div>
                    </div>

                    <Textarea
                        label="기능 요청"
                        value={request}
                        onChange={(e) => setRequest(e.target.value)}
                        placeholder="예: 사용자 로그인 기능을 만들어줘. 이메일과 비밀번호로 로그인하고, 로그인 성공하면 대시보드로 이동해야 해."
                        rows={4}
                    />

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-red-400 text-sm">❌ {error}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={handleClose}>취소</Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={!request.trim() || loading}
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    AI 분석 중...
                                </>
                            ) : (
                                <>🧠 AI로 분석하기</>
                            )}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-emerald-400 font-medium">✅ {result.message}</p>
                    </div>

                    {result.summary && (
                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-sm text-[var(--text-secondary)]">
                                <span className="font-medium">🤖 AI 분석: </span>
                                {result.summary}
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-[var(--text-secondary)]">생성된 태스크:</h4>
                        {result.tickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[var(--text-primary)] text-sm">
                                            {ticket.title}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                                            {ticket.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant={roleColors[ticket.assigned_role]} size="sm">
                                                {roleLabels[ticket.assigned_role]}
                                            </Badge>
                                            {ticket.assignee && (
                                                <span className="text-xs text-[var(--text-tertiary)]">
                                                    → {ticket.assignee.avatar} {ticket.assignee.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end">
                        <Button variant="primary" onClick={handleClose}>확인</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
