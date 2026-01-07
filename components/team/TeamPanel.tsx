'use client';

import { useState } from 'react';
import { MemberCard, SystemPromptEditor } from './MemberCard';

interface Member {
    id: string;
    role: string;
    name: string;
    avatar?: string | null;
    system_prompt: string;
}

interface TeamPanelProps {
    members: Member[];
    onUpdateMember: (id: string, systemPrompt: string) => void;
}

export function TeamPanel({ members, onUpdateMember }: TeamPanelProps) {
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const handleMemberClick = (member: Member) => {
        setSelectedMember(member);
        setIsEditorOpen(true);
    };

    const handleSave = (id: string, systemPrompt: string) => {
        onUpdateMember(id, systemPrompt);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Members</h2>
                <p className="text-sm text-[var(--text-tertiary)]">Click to edit system prompts</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto">
                {members.map((member) => (
                    <MemberCard
                        key={member.id}
                        member={member}
                        onClick={() => handleMemberClick(member)}
                    />
                ))}
            </div>

            <SystemPromptEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                member={selectedMember}
                onSave={handleSave}
            />
        </div>
    );
}
