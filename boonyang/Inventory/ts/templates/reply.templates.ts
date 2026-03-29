/**
 * Reply Templates
 * Auto-reply system templates (from reply sheet)
 */

import { LineMessageOut } from '../types';

export function createReplyMessage(content: string): LineMessageOut {
  // Try to parse as JSON (for flex messages)
  try {
    const parsed = JSON.parse(content);
    return {
      type: 'flex',
      altText: 'Reply',
      contents: parsed,
    };
  } catch {
    // Regular text message
    return {
      type: 'text',
      text: content,
    };
  }
}

export function createTextReply(text: string): LineMessageOut {
  return {
    type: 'text',
    text,
  };
}

export function createQuickReplyMessage(
  text: string,
  options: string[]
): LineMessageOut {
  return {
    type: 'text',
    text,
    quickReply: {
      items: options.map((label) => ({
        type: 'action',
        action: {
          type: 'message',
          label,
          text: label,
        },
      })),
    },
  };
}

export function createErrorMessage(error: string): LineMessageOut {
  return {
    type: 'text',
    text: `❌ เกิดข้อผิดพลาด\n\n${error}\n\nกรุณาลองใหม่หรือติดต่อแอดมิน`,
  };
}

export function createSystemMessage(message: string): LineMessageOut {
  return {
    type: 'text',
    text: `⚙️ ${message}`,
  };
}
