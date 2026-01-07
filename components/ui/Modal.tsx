'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 min-h-screen"
            onClick={(e) => e.target === overlayRef.current && onClose()}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className={`
        relative w-full ${sizes[size]} bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] 
        shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200 max-h-[calc(100vh-4rem)] overflow-y-auto
      `}>
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
