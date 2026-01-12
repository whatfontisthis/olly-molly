import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export interface ImageGeneratorSettings {
    provider: 'comfyui' | 'nanobanana' | 'off';
    comfyuiServerUrl?: string;
    geminiApiKey?: string;
}

// Store settings in a file in the db directory (persistent across restarts)
const SETTINGS_FILE = path.join(process.cwd(), 'db', 'image-settings.json');

const defaultSettings: ImageGeneratorSettings = {
    provider: 'off',
    comfyuiServerUrl: '',
    geminiApiKey: '',
};

export function loadSettingsFromFile(): ImageGeneratorSettings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return { ...defaultSettings, ...JSON.parse(content) };
        }
    } catch (error) {
        console.error('Error loading image settings:', error);
    }
    return defaultSettings;
}

function saveSettingsToFile(settings: ImageGeneratorSettings): void {
    try {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving image settings:', error);
        throw error;
    }
}

// GET - Load settings
export async function GET() {
    try {
        const settings = loadSettingsFromFile();
        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load settings' },
            { status: 500 }
        );
    }
}

// POST - Save settings
export async function POST(request: NextRequest) {
    try {
        const settings: ImageGeneratorSettings = await request.json();
        saveSettingsToFile(settings);
        return NextResponse.json({ success: true, settings });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save settings' },
            { status: 500 }
        );
    }
}
