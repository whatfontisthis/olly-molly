'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (apiKey: string) => void;
}

export function ApiKeyModal({ isOpen, onClose, onSubmit }: ApiKeyModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setApiKey('');
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (apiKey.trim()) {
            onSubmit(apiKey.trim());
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-secondary border border-primary rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
                <h2 className="text-xl font-bold text-primary mb-4">🔑 OpenAI API Key Required</h2>

                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        To use AI agents, you need to provide an OpenAI API key. This key will be stored locally in your browser.
                    </p>

                    <div className="bg-tertiary border border-primary rounded-lg p-4 space-y-2">
                        <h3 className="font-semibold text-primary text-sm">📖 How to get your API key:</h3>
                        <ol className="text-xs text-muted space-y-1 list-decimal list-inside">
                            <li>Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">platform.openai.com/api-keys</a></li>
                            <li>Sign in or create an OpenAI account</li>
                            <li>Click "Create new secret key"</li>
                            <li>Give it a name (e.g., "AI Dev Team")</li>
                            <li>Copy the key (starts with "sk-")</li>
                            <li>Paste it below</li>
                        </ol>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-primary">API Key</label>
                        <div className="relative">
                            <Input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="pr-20"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmit();
                                }}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-primary"
                            >
                                {showKey ? '🙈 Hide' : '👁️ Show'}
                            </button>
                        </div>
                        <p className="text-xs text-amber-400">
                            ⚠️ Your API key is stored only in your browser's localStorage and never sent to our servers.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            onClick={handleSubmit}
                            variant="primary"
                            disabled={!apiKey.trim()}
                            className="flex-1"
                        >
                            💾 Save API Key
                        </Button>
                        <Button
                            onClick={onClose}
                            variant="ghost"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
