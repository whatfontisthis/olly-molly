import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Check if OPENAI_API_KEY exists in environment
        const hasKey = !!process.env.OPENAI_API_KEY;

        return NextResponse.json({ hasKey });
    } catch (error) {
        return NextResponse.json({ hasKey: false }, { status: 500 });
    }
}
