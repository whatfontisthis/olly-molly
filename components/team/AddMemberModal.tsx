'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { role: string; name: string; avatar: string; system_prompt: string }) => void;
}

const roleOptions = [
    { value: 'PM', label: 'Project Manager', emoji: '👔' },
    { value: 'FE_DEV', label: 'Frontend Developer', emoji: '🎨' },
    { value: 'BACKEND_DEV', label: 'Backend Developer', emoji: '⚙️' },
    { value: 'QA', label: 'QA Engineer', emoji: '🔍' },
    { value: 'DEVOPS', label: 'DevOps Engineer', emoji: '🚀' },
    { value: 'BUG_HUNTER', label: 'Bug Hunter', emoji: '🐛' },
];

const defaultPrompts: Record<string, string> = {
    PM: 'You are a Project Manager AI agent. Your responsibilities include:\n- Creating and managing project tickets\n- Assigning tasks to appropriate team members based on their expertise\n- Setting priorities and deadlines',
    FE_DEV: 'You are a Frontend Developer AI agent. Your responsibilities include:\n- Implementing user interfaces using React and Next.js\n- Writing clean, maintainable TypeScript/JavaScript code\n- Creating responsive and accessible designs',
    BACKEND_DEV: 'You are a Backend Developer AI agent. Your responsibilities include:\n- Designing and implementing REST APIs\n- Working with databases\n- Writing server-side logic and business rules',
    QA: 'You are a QA Engineer AI agent. Your responsibilities include:\n- Testing features moved to "In Review" status\n- Writing and executing test cases\n- Reporting bugs and issues',
    DEVOPS: 'You are a DevOps Engineer AI agent. Your responsibilities include:\n- Setting up CI/CD pipelines\n- Managing deployment processes\n- Configuring infrastructure and environments',
    BUG_HUNTER: 'You are a Bug Hunter AI agent. Your responsibilities include:\n- Quickly diagnosing and fixing bugs reported by users\n- Debugging both frontend and backend issues\n- Writing fixes with minimal side effects',
};

export function AddMemberModal({ isOpen, onClose, onSave }: AddMemberModalProps) {
    const [role, setRole] = useState('');
    const [name, setName] = useState('');
    const [avatar, setAvatar] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');

    const handleRoleSelect = (selectedRole: string, emoji: string, prompt: string) => {
        setRole(selectedRole);
        setSystemPrompt(prompt);
        if (!avatar) {
            setAvatar(emoji);
        }
    };

    const handleSave = () => {
        if (role.trim() && name.trim() && systemPrompt.trim()) {
            onSave({
                role: role.trim(),
                name: name.trim(),
                avatar: avatar.trim() || '👤',
                system_prompt: systemPrompt.trim(),
            });
            // Reset form
            setRole('');
            setName('');
            setAvatar('');
            setSystemPrompt('');
            onClose();
        }
    };

    const handleClose = () => {
        // Reset form on close
        setRole('');
        setName('');
        setAvatar('');
        setSystemPrompt('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Add Team Member" size="xl">
            <div className="space-y-4">
                {/* Role Input */}
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Role *
                    </label>
                    <Input
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="e.g., Frontend Specialist, Data Analyst, Designer"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Suggested roles (click to use):
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {roleOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleRoleSelect(option.label, option.emoji, defaultPrompts[option.value])}
                                className="px-2 py-1 text-xs rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-card-hover)] 
                                         border border-[var(--border-primary)] transition-colors"
                            >
                                {option.emoji} {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Name Input */}
                <Input
                    label="Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Custom Frontend Agent"
                />

                {/* Avatar/Emoji Input */}
                <Input
                    label="Avatar (emoji)"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="e.g., 🌟 (leave empty for default 👤)"
                    maxLength={2}
                />

                {/* System Prompt */}
                <Textarea
                    label="System Prompt *"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={10}
                    placeholder="Enter the system prompt for this AI agent..."
                />

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={!role.trim() || !name.trim() || !systemPrompt.trim()}
                    >
                        Create Member
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
