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

type TabType = 'existing' | 'create';

export function ProjectSelector({ onProjectChange }: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('existing');

    // Existing project form
    const [newPath, setNewPath] = useState('');
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Create project form
    const [createName, setCreateName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createProgress, setCreateProgress] = useState<string | null>(null);

    const storageKey = 'olly-active-project-id';
    const getStoredProjectId = () => {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem(storageKey);
    };
    const persistProjectId = (id: string | null) => {
        if (typeof window === 'undefined') return;
        if (id) {
            sessionStorage.setItem(storageKey, id);
        } else {
            sessionStorage.removeItem(storageKey);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            setProjects(data);
            const storedId = getStoredProjectId();
            const storedProject = storedId ? data.find((p: Project) => p.id === storedId) : null;
            const active = storedProject || data.find((p: Project) => p.is_active) || null;
            if (storedId && !storedProject) {
                persistProjectId(null);
            }
            if (active?.id && active.id !== storedId) {
                persistProjectId(active.id);
            }
            setActiveProject(active);
            onProjectChange?.(active);
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

    const handleCreateProject = async () => {
        if (!createName.trim()) return;

        setCreating(true);
        setCreateError(null);
        setCreateProgress('🚀 Next.js 프로젝트 생성 중... (1-2분 소요)');

        try {
            const res = await fetch('/api/projects/dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    projectName: createName.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to create project');
            }

            setCreateName('');
            setCreateProgress(null);
            await fetchProjects();

            // Auto-select the new project
            if (data.project?.id) {
                handleSelectProject(data.project.id);
            }

            alert(`✅ 프로젝트가 생성되었습니다!\n경로: ~/Projects/${createName.trim()}`);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setCreating(false);
            setCreateProgress(null);
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
                persistProjectId(id);
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
                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg">
                        <button
                            onClick={() => setActiveTab('existing')}
                            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'existing'
                                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                }`}
                        >
                            📂 기존 프로젝트 추가
                        </button>
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'create'
                                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                }`}
                        >
                            ✨ 새 Next.js 프로젝트
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'existing' ? (
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg space-y-3">
                            <Input
                                placeholder="/Users/username/my-project"
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
                    ) : (
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg space-y-3">
                            <p className="text-xs text-[var(--text-muted)]">
                                Next.js 프로젝트를 ~/Projects/ 폴더에 생성합니다
                            </p>
                            <Input
                                placeholder="my-awesome-app"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                                label="프로젝트 이름"
                            />
                            <p className="text-xs text-[var(--text-muted)]">
                                📍 경로: ~/Projects/{createName || 'project-name'}
                            </p>
                            {createProgress && (
                                <p className="text-sm text-blue-400">{createProgress}</p>
                            )}
                            {createError && (
                                <p className="text-sm text-red-400">{createError}</p>
                            )}
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleCreateProject}
                                disabled={!createName.trim() || creating}
                            >
                                {creating ? '생성 중...' : '🚀 프로젝트 생성'}
                            </Button>
                            <p className="text-xs text-[var(--text-muted)]">
                                TypeScript, Tailwind CSS, ESLint, App Router 포함
                            </p>
                        </div>
                    )}

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
