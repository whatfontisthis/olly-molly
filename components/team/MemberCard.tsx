'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface Member {
    id: string;
    role: string;
    name: string;
    avatar?: string | null;
    system_prompt: string;
}

interface MemberCardProps {
    member: Member;
    onClick: () => void;
}


export function MemberCard({ member, onClick }: MemberCardProps) {
    const roleLabels: Record<string, string> = {
        PM: 'Project Manager',
        FE_DEV: 'Frontend Developer',
        BACKEND_DEV: 'Backend Developer',
        QA: 'QA Engineer',
        DEVOPS: 'DevOps Engineer',
    };

    const roleColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'purple'> = {
        PM: 'purple',
        FE_DEV: 'info',
        BACKEND_DEV: 'success',
        QA: 'warning',
        DEVOPS: 'default',
    };

    const roleImages: Record<string, string> = {
        PM: '/profiles/pm.png',
        FE_DEV: '/profiles/dev-frontend.png',
        BACKEND_DEV: '/profiles/dev-backend.png',
        QA: '/profiles/qa.png',
    };

    const profileImage = roleImages[member.role];

    return (
        <div
            onClick={onClick}
            className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)] 
                 hover:border-[var(--border-secondary)] hover:bg-[var(--bg-card-hover)] 
                 cursor-pointer transition-all duration-200"
        >
            <div className="flex items-center gap-3">
                <Avatar
                    name={member.name}
                    src={profileImage}
                    emoji={!profileImage ? member.avatar : undefined}
                    badge={profileImage ? member.avatar : undefined}
                    size="lg"
                />
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--text-primary)] truncate">{member.name}</h3>
                    <Badge variant={roleColors[member.role]} size="sm">
                        {roleLabels[member.role] || member.role}
                    </Badge>
                </div>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)] line-clamp-2">
                {member.system_prompt.slice(0, 100)}...
            </p>
        </div>
    );
}

interface SystemPromptEditorProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member | null;
    onSave: (id: string, systemPrompt: string) => void;
}


export function SystemPromptEditor({ isOpen, onClose, member, onSave }: SystemPromptEditorProps) {
    const [prompt, setPrompt] = useState(member?.system_prompt || '');

    const roleImages: Record<string, string> = {
        PM: '/profiles/pm.png',
        FE_DEV: '/profiles/dev-frontend.png',
        BACKEND_DEV: '/profiles/dev-backend.png',
        QA: '/profiles/qa.png',
    };

    const profileImage = member ? roleImages[member.role] : undefined;

    const handleSave = () => {
        if (member) {
            onSave(member.id, prompt);
            onClose();
        }
    };

    // Update prompt when member changes
    if (member && member.system_prompt !== prompt && !isOpen) {
        setPrompt(member.system_prompt);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${member?.name}'s System Prompt`} size="xl">
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                    {member && (
                        <>
                            <Avatar
                                name={member.name}
                                src={profileImage}
                                emoji={!profileImage ? member.avatar : undefined}
                                badge={profileImage ? member.avatar : undefined}
                                size="md"
                            />
                            <div>
                                <p className="font-medium text-[var(--text-primary)]">{member.name}</p>
                                <p className="text-xs text-[var(--text-tertiary)]">{member.role}</p>
                            </div>
                        </>
                    )}
                </div>

                <Textarea
                    label="System Prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={12}
                    placeholder="Enter the system prompt for this AI agent..."
                />

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave}>Save Changes</Button>
                </div>
            </div>
        </Modal>
    );
}
