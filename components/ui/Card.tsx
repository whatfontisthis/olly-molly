'use client';

import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
    return (
        <div
            className={`
        bg-[var(--bg-card)] backdrop-blur-sm rounded-xl border border-[var(--border-primary)]
        ${hoverable ? 'hover:border-[var(--border-secondary)] hover:bg-[var(--bg-card-hover)] cursor-pointer transition-all duration-200' : ''}
        ${className}
      `}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`px-4 py-3 border-b border-[var(--border-primary)] ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`p-4 ${className}`}>{children}</div>;
}
