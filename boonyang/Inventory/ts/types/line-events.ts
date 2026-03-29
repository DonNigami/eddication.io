/**
 * LINE Messaging API - Webhook Event Types
 * Reference: https://developers.line.biz/en/reference/messaging-api/
 */

export interface LineWebhook {
  destination: string;
  events: LineEvent[];
}

export interface LineEvent {
  type: 'message' | 'follow' | 'unfollow' | 'postback' | 'join' | 'leave' | 'memberJoined' | 'memberLeft';
  source: LineSource;
  message?: LineMessage;
  replyToken?: string;
  timestamp?: number;
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery?: boolean;
  };
}

export interface LineSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface LineMessage {
  id: string;
  type: 'text' | 'image' | 'sticker' | 'audio';
  text?: string;
  quoteToken?: string;
  contentProvider?: {
    type: string;
  };
}

export interface LineMessageOut {
  type: 'text' | 'flex';
  text?: string;
  altText?: string;
  contents?: any;
  quoteToken?: string;
}

export interface LineReplyResponse {
  messages: LineMessageOut[];
  notificationDisabled?: boolean;
}
