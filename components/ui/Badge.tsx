'use client';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
    size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
    const variants = {
        default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        danger: 'bg-red-500/20 text-red-400 border-red-500/30',
        info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
    };

    return (
        <span className={`
      inline-flex items-center font-medium rounded-full border
      ${variants[variant]} ${sizes[size]}
    `}>
            {children}
        </span>
    );
}

// Status-specific badge
export function StatusBadge({ status }: { status: string }) {
    const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
        TODO: { label: 'To Do', variant: 'default' },
        IN_PROGRESS: { label: 'In Progress', variant: 'info' },
        IN_REVIEW: { label: 'In Review', variant: 'purple' },
        COMPLETE: { label: 'Complete', variant: 'success' },
        ON_HOLD: { label: 'On Hold', variant: 'warning' },
    };

    const config = statusConfig[status] || { label: status, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Priority badge
export function PriorityBadge({ priority }: { priority: string }) {
    const priorityConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
        LOW: { label: 'Low', variant: 'default' },
        MEDIUM: { label: 'Medium', variant: 'info' },
        HIGH: { label: 'High', variant: 'warning' },
        CRITICAL: { label: 'Critical', variant: 'danger' },
    };

    const config = priorityConfig[priority] || { label: priority, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}
