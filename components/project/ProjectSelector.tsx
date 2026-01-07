'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface Project {
    id: string;
    name: string;
    path: string;
    description: string | null;
    is_active: number;
}

interface ProjectSelectorProps {
    onProjectChange?: (project: Project | null) => void;
}

export function ProjectSelector({ onProjectChange }: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPath, setNewPath] = useState('');
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            setProjects(data);
            const active = data.find((p: Project) => p.is_active);
            setActiveProject(active || null);
            onProjectChange?.(active || null);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        }
    };

    const handleAddProject = async () => {
        if (!newPath.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: newPath.trim(),
                    name: newName.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error);
            }

            setNewPath('');
            setNewName('');
            await fetchProjects();

            // Auto-select if it's the first project
            if (projects.length === 0) {
                handleSelectProject(data.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add project');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProject = async (id: string) => {
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: true }),
            });

            if (res.ok) {
                await fetchProjects();
            }
        } catch (err) {
            console.error('Failed to select project:', err);
        }
    };

    const handleDeleteProject = async (id: string) => {
        try {
            await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            await fetchProjects();
        } catch (err) {
            console.error('Failed to delete project:', err);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                   bg-[var(--bg-tertiary)] border border-[var(--border-primary)]
                   hover:border-[var(--border-secondary)] transition-colors"
            >
                <span>📁</span>
                <span className="text-[var(--text-secondary)]">
                    {activeProject ? activeProject.name : '프로젝트 선택'}
                </span>
                {activeProject && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
                )}
            </button>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="📁 프로젝트 관리" size="lg">
                <div className="space-y-4">
                    {/* Add new project */}
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg space-y-3">
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">새 프로젝트 추가</h4>
                        <Input
                            placeholder="/Users/yongmin/my-project"
                            value={newPath}
                            onChange={(e) => setNewPath(e.target.value)}
                            label="프로젝트 경로"
                        />
                        <Input
                            placeholder="My Project (선택사항)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            label="프로젝트 이름"
                        />
                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleAddProject}
                            disabled={!newPath.trim() || loading}
                        >
                            {loading ? '추가 중...' : '프로젝트 추가'}
                        </Button>
                    </div>

                    {/* Project list */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-[var(--text-secondary)]">등록된 프로젝트</h4>
                        {projects.length === 0 ? (
                            <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                                등록된 프로젝트가 없습니다
                            </p>
                        ) : (
                            projects.map((project) => (
                                <div
                                    key={project.id}
                                    className={`p-3 rounded-lg border transition-colors ${project.is_active
                                            ? 'bg-indigo-500/10 border-indigo-500/30'
                                            : 'bg-[var(--bg-card)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-[var(--text-primary)]">{project.name}</span>
                                                {project.is_active && (
                                                    <span className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-muted)] truncate mt-1">{project.path}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {!project.is_active && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSelectProject(project.id)}
                                                >
                                                    선택
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteProject(project.id)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
}
