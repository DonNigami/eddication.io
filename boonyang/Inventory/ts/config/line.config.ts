/**
 * LINE Configuration
 */

export const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

export const validateLineConfig = (): void => {
  if (!lineConfig.channelAccessToken) {
    throw new Error(
      'LINE_CHANNEL_TOKEN environment variable is required. ' +
      'Set it in .env file or deployment environment.'
    );
  }
};
