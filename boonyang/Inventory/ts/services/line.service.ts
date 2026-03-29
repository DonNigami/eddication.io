/**
 * LINE Messaging API Service
 * Handles LINE bot messaging operations
 */

import { LineMessageOut } from '../types';

export class LineService {
  private channelToken: string;

  constructor(channelToken: string) {
    this.channelToken = channelToken;
  }

  async replyMessage(replyToken: string, messages: LineMessageOut[]): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.channelToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API Error: ${error}`);
    }
  }

  async pushMessage(userId: string, messages: LineMessageOut[]): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.channelToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API Error: ${error}`);
    }
  }

  async getUserProfile(userId: string): Promise<{
    userId: string;
    displayName: string;
    pictureUrl: string;
    statusMessage?: string;
  }> {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.channelToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API Error: ${error}`);
    }

    return await response.json();
  }

  async startLoading(userId: string, seconds: number = 60): Promise<void> {
    await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.channelToken}`,
      },
      body: JSON.stringify({
        chatId: userId,
        loadingSeconds: seconds,
      }),
    });
  }
}

// Factory function to create LineService instance
export function createLineService(channelToken: string): LineService {
  return new LineService(channelToken);
}
