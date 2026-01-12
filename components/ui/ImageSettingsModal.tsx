'use client';

import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ImageGeneratorSettings {
    provider: 'comfyui' | 'nanobanana' | 'off';
    comfyuiServerUrl?: string;
    geminiApiKey?: string;
}

const STORAGE_KEY = 'imageGeneratorSettings';

const defaultSettings: ImageGeneratorSettings = {
    provider: 'off',
    comfyuiServerUrl: '',
    geminiApiKey: '',
};

export function getImageSettings(): ImageGeneratorSettings {
    if (typeof window === 'undefined') return defaultSettings;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch {
        // Ignore parse errors
    }
    return defaultSettings;
}

export function saveImageSettings(settings: ImageGeneratorSettings): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface ImageSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ImageSettingsModal({ isOpen, onClose }: ImageSettingsModalProps) {
    const [settings, setSettings] = useState<ImageGeneratorSettings>(defaultSettings);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSettings(getImageSettings());
            setTestStatus('idle');
            setTestMessage('');
        }
    }, [isOpen]);

    const handleSave = () => {
        saveImageSettings(settings);
        onClose();
    };

    const handleTest = async () => {
        setTestStatus('testing');
        setTestMessage('');

        try {
            const response = await fetch('/api/image/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Image-Settings': JSON.stringify(settings),
                },
                body: JSON.stringify({
                    prompt: 'A simple test image with colorful shapes',
                    width: 512,
                    height: 512,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setTestStatus('success');
                setTestMessage('연결 성공! 이미지가 생성되었습니다.');
            } else {
                setTestStatus('error');
                setTestMessage(data.error || '연결 실패');
            }
        } catch (error) {
            setTestStatus('error');
            setTestMessage(error instanceof Error ? error.message : '연결 실패');
        }
    };

    const isConfigured = () => {
        if (settings.provider === 'comfyui') {
            return !!settings.comfyuiServerUrl;
        }
        if (settings.provider === 'nanobanana') {
            return !!settings.geminiApiKey;
        }
        return false;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="🖼️ 이미지 생성 설정" size="md">
            <div className="space-y-6">
                {/* Provider Selection */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-3">
                        이미지 생성 Provider
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border border-[var(--border-primary)] hover:border-[var(--border-accent)] cursor-pointer transition-colors">
                            <input
                                type="radio"
                                name="provider"
                                value="off"
                                checked={settings.provider === 'off'}
                                onChange={() => setSettings({ ...settings, provider: 'off' })}
                                className="text-[var(--text-accent)]"
                            />
                            <div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">비활성화</div>
                                <div className="text-xs text-[var(--text-muted)]">이미지 생성 기능 사용 안함</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-[var(--border-primary)] hover:border-[var(--border-accent)] cursor-pointer transition-colors">
                            <input
                                type="radio"
                                name="provider"
                                value="comfyui"
                                checked={settings.provider === 'comfyui'}
                                onChange={() => setSettings({ ...settings, provider: 'comfyui' })}
                                className="text-[var(--text-accent)]"
                            />
                            <div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">ComfyUI</div>
                                <div className="text-xs text-[var(--text-muted)]">로컬/원격 ComfyUI 서버 사용</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-[var(--border-primary)] hover:border-[var(--border-accent)] cursor-pointer transition-colors">
                            <input
                                type="radio"
                                name="provider"
                                value="nanobanana"
                                checked={settings.provider === 'nanobanana'}
                                onChange={() => setSettings({ ...settings, provider: 'nanobanana' })}
                                className="text-[var(--text-accent)]"
                            />
                            <div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">NanoBanana (Gemini)</div>
                                <div className="text-xs text-[var(--text-muted)]">Google Gemini 이미지 생성 API</div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* ComfyUI Settings */}
                {settings.provider === 'comfyui' && (
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                            ComfyUI 서버 URL
                        </label>
                        <input
                            type="text"
                            value={settings.comfyuiServerUrl || ''}
                            onChange={(e) => setSettings({ ...settings, comfyuiServerUrl: e.target.value })}
                            placeholder="http://localhost:8188"
                            className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-accent)]"
                        />
                    </div>
                )}

                {/* NanoBanana Settings */}
                {settings.provider === 'nanobanana' && (
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                            Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={settings.geminiApiKey || ''}
                            onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                            placeholder="AIza..."
                            className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-accent)]"
                        />
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--text-accent)] hover:underline"
                            >
                                Google AI Studio
                            </a>
                            에서 API 키를 발급받으세요
                        </p>
                    </div>
                )}

                {/* Test Connection */}
                {settings.provider !== 'off' && isConfigured() && (
                    <div className="pt-2 border-t border-[var(--border-primary)]">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleTest}
                            disabled={testStatus === 'testing'}
                        >
                            {testStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
                        </Button>
                        {testStatus === 'success' && (
                            <p className="mt-2 text-xs text-green-500">{testMessage}</p>
                        )}
                        {testStatus === 'error' && (
                            <p className="mt-2 text-xs text-red-500">{testMessage}</p>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-[var(--border-primary)]">
                    <Button variant="ghost" onClick={onClose} className="flex-1">
                        취소
                    </Button>
                    <Button variant="primary" onClick={handleSave} className="flex-1">
                        저장
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
