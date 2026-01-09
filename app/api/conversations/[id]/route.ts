import { NextRequest, NextResponse } from 'next/server';
import { conversationService, conversationMessageService } from '@/lib/db';

interface RouteParams {
    params: {
        id: string;
    };
}

// GET /api/conversations/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const conversation = conversationService.getById(params.id);

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        const messages = conversationMessageService.getByConversationId(params.id);

        return NextResponse.json({
            conversation,
            messages
        });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        return NextResponse.json({
            error: 'Failed to fetch conversation',
            details: String(error)
        }, { status: 500 });
    }
}
