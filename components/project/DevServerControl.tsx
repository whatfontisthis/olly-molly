'use client';

import { useState, useEffect, useCallback } from 'react';

interface DevServerControlProps {
    projectId: string | null;
    projectName: string | null;
}

export function DevServerControl({ projectId, projectName }: DevServerControlProps) {
    const [running, setRunning] = useState(false);
    const [port, setPort] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Check server status
    const checkStatus = useCallback(async () => {
        if (!projectId) return;

        try {
            const res = await fetch(`/api/projects/dev?projectId=${projectId}`);
            const data = await res.json();
            setRunning(data.running);
            setPort(data.port || null);
        } catch (error) {
            console.error('Failed to check dev server status:', error);
        }
    }, [projectId]);

    useEffect(() => {
        checkStatus();
        // Poll status every 5 seconds
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    // Reset state when project changes
    useEffect(() => {
        setRunning(false);
        setPort(null);
        checkStatus();
    }, [projectId, checkStatus]);

    const handleStart = async () => {
        if (!projectId) return;

        setLoading(true);
        try {
            const res = await fetch('/api/projects/dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', projectId }),
            });

            const data = await res.json();
            if (data.success) {
                setRunning(true);
                setPort(data.port);
            } else {
                alert(data.error || 'Failed to start dev server');
            }
        } catch (error) {
            alert('Failed to start dev server');
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        if (!projectId) return;

        setLoading(true);
        try {
            const res = await fetch('/api/projects/dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop', projectId }),
            });

            const data = await res.json();
            if (data.success) {
                setRunning(false);
                setPort(null);
            }
        } catch (error) {
            console.error('Failed to stop dev server:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = () => {
        if (port) {
            window.open(`http://localhost:${port}`, '_blank');
        }
    };

    if (!projectId) return null;

    return (
        <div className="flex items-center gap-1">
            {!running ? (
                <button
                    onClick={handleStart}
                    disabled={loading}
                    className={`p-1.5 rounded-lg transition-colors ${loading
                            ? 'text-[var(--text-muted)] cursor-not-allowed'
                            : 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
                        }`}
                    title="Start dev server (npm run dev)"
                >
                    {loading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>
            ) : (
                <>
                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        :{port}
                    </span>
                    <button
                        onClick={handleOpen}
                        className="p-1.5 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 rounded-lg transition-colors"
                        title="Open in browser"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </button>
                    <button
                        onClick={handleStop}
                        disabled={loading}
                        className={`p-1.5 rounded-lg transition-colors ${loading
                                ? 'text-[var(--text-muted)] cursor-not-allowed'
                                : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                            }`}
                        title="Stop dev server"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );
}
