'use client';

import { Modal } from './Modal';

interface CLIWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CLIWarningModal({ isOpen, onClose }: CLIWarningModalProps) {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="CLI 도구 설치 필요" size="md">
            <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-[var(--status-error-bg)] rounded-lg border border-[var(--status-error-text)]/20">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <p className="text-sm text-[var(--text-primary)] font-medium">
                            AI 에이전트를 실행하려면 OpenCode 또는 Claude CLI가 설치되어 있어야 합니다.
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            아래 명령어로 설치할 수 있습니다.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-[var(--text-secondary)]">🟢 OpenCode 설치</span>
                            <button
                                onClick={() => copyToClipboard('brew install sst/tap/opencode')}
                                className="text-xs text-[var(--accent-primary)] hover:underline"
                            >
                                복사
                            </button>
                        </div>
                        <code className="text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded block">
                            brew install sst/tap/opencode
                        </code>
                    </div>

                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-[var(--text-secondary)]">🟣 Claude CLI 설치</span>
                            <button
                                onClick={() => copyToClipboard('brew install anthropics/tap/claude-code')}
                                className="text-xs text-[var(--accent-primary)] hover:underline"
                            >
                                복사
                            </button>
                        </div>
                        <code className="text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded block">
                            brew install anthropics/tap/claude-code
                        </code>
                    </div>
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                    설치 후에 앱을 다시 시작하거나 이 창을 닫고 작업을 계속할 수 있습니다.
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-2 px-4 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors"
                >
                    확인
                </button>
            </div>
        </Modal>
    );
}
