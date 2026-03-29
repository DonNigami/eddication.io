"""LINE Messaging API client wrapper"""
import logging
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class LineClient:
    """
    LINE Messaging API client wrapper

    Handles all LINE Bot API interactions including:
    - Sending messages
    - Downloading content (images)
    - Getting user profiles
    - Verifying signatures
    """

    def __init__(self, channel_access_token: str):
        """
        Initialize LINE client

        Args:
            channel_access_token: LINE Channel Access Token
        """
        self.channel_access_token = channel_access_token
        self.api_base_url = "https://api.line.me/v2/bot"
        self.data_base_url = "https://api-data.line.me/v2/bot"
        self.headers = {
            "Authorization": f"Bearer {channel_access_token}",
            "Content-Type": "application/json"
        }

    async def reply_message(self, reply_token: str, messages: List[Dict[str, Any]]):
        """
        Reply to a message from user

        Args:
            reply_token: Reply token from webhook event
            messages: List of message objects

        Example:
            >>> await line_client.reply_message(
            ...     reply_token="token",
            ...     messages=[{"type": "text", "text": "Hello!"}]
            ... )
        """
        url = f"{self.api_base_url}/message/reply"

        payload = {
            "replyToken": reply_token,
            "messages": messages
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Successfully replied message with token: {reply_token[:10]}...")
        except httpx.HTTPStatusError as e:
            logger.error(f"LINE API error: {e.response.status_code} - {e.response.text}")
            raise

    async def push_message(self, user_id: str, messages: List[Dict[str, Any]]):
        """
        Push a message to a user proactively

        Args:
            user_id: LINE User ID
            messages: List of message objects

        Example:
            >>> await line_client.push_message(
            ...     user_id="U1234567890",
            ...     messages=[{"type": "text", "text": "Hello!"}]
            ... )
        """
        url = f"{self.api_base_url}/message/push"

        payload = {
            "to": user_id,
            "messages": messages
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Successfully pushed message to user: {user_id}")
        except httpx.HTTPStatusError as e:
            logger.error(f"LINE API error: {e.response.status_code} - {e.response.text}")
            raise

    async def start_loading_animation(self, user_id: str, duration: int = 60):
        """
        Start LINE's native loading animation

        Uses LINE's built-in loading animation feature that shows a
        loading indicator in the chat.

        Args:
            user_id: LINE User ID
            duration: Loading duration in seconds (1-60, default: 60)

        Example:
            >>> await line_client.start_loading_animation("U1234567890", duration=30)
        """
        if duration < 1 or duration > 60:
            raise ValueError("Duration must be between 1 and 60 seconds")

        # LINE Loading Animation API endpoint (for 1-on-1 chat)
        url = f"{self.api_base_url}/chat/loading/start"

        payload = {
            "chatId": user_id,  # Use userId as chatId for 1-on-1
            "loadingSeconds": duration
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Started loading animation for user: {user_id} ({duration}s)")
        except httpx.HTTPStatusError as e:
            # 404 means loading animation API not available or not enabled
            if e.response.status_code == 404:
                logger.warning(f"Loading animation API returned 404. Feature may not be enabled. Skipping for user: {user_id}")
            else:
                logger.error(f"Failed to start loading animation: {e.response.status_code} - {e.response.text}")
            # Don't raise - allow system to continue without loading animation
        except Exception as e:
            logger.warning(f"Failed to start loading animation: {e}")
            # Don't raise - allow system to continue without loading animation

    async def send_loading_message(self, reply_token: str, user_id: str):
        """
        Send a loading message to show processing status

        Args:
            reply_token: Reply token from webhook event
            user_id: LINE User ID

        Example:
            >>> await line_client.send_loading_message(reply_token, "U1234567890")
        """
        loading_message = """⏳ กำลังประมวลผล...

🔍 ตรวจสอบรูปภาพ...
🤖 วิเคราะห์ด้วย AI...
📝 แยกข้อมูลเอกสาร...

กรุณารอสักครู่..."""

        await self.reply_message(
            reply_token,
            [self.format_text_message(loading_message)]
        )
        logger.info(f"Sent loading message to user: {user_id}")

    async def stop_loading_animation(self, user_id: str):
        """
        Stop LINE's native loading animation early

        Args:
            user_id: LINE User ID

        Example:
            >>> await line_client.stop_loading_animation("U1234567890")
        """
        url = f"{self.api_base_url}/chat/loading/end"

        payload = {
            "chatId": user_id  # Use userId as chatId for 1-on-1
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Stopped loading animation for user: {user_id}")
        except httpx.HTTPStatusError as e:
            logger.warning(f"Failed to stop loading animation: {e.response.status_code}")
            # Don't raise if stopping fails (animation will auto-stop on message send)

    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Get user profile information

        Args:
            user_id: LINE User ID

        Returns:
            Dict with user profile data: displayName, pictureUrl, etc.
        """
        url = f"{self.api_base_url}/profile/{user_id}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                profile = response.json()
                logger.info(f"Retrieved profile for user: {user_id}")
                return profile
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to get user profile: {e.response.status_code} - {e.response.text}")
            raise

    async def download_content(self, message_id: str) -> bytes:
        """
        Download content (image, video, etc.) from LINE

        Args:
            message_id: Message ID containing the content

        Returns:
            bytes: Raw content data

        Example:
            >>> image_bytes = await line_client.download_content("message_id")
        """
        url = f"{self.data_base_url}/message/{message_id}/content"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.channel_access_token}"}
                )
                response.raise_for_status()
                content = response.content
                logger.info(f"Downloaded content for message: {message_id}, size: {len(content)} bytes")
                return content
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to download content: {e.response.status_code}")
            raise

    def verify_signature(self, body: bytes, signature: str) -> bool:
        """
        Verify LINE webhook signature

        Args:
            body: Raw request body
            signature: X-Line-Signature header value

        Returns:
            bool: True if signature is valid

        Note:
            Requires CHANNEL_SECRET to be set in settings
        """
        import hmac
        import hashlib
        import base64

        hash_value = hmac.new(
            settings.LINE_CHANNEL_SECRET.encode('utf-8'),
            body,
            hashlib.sha256
        ).digest()

        expected_signature = base64.b64encode(hash_value).decode('utf-8')

        return hmac.compare_digest(expected_signature, signature)

    @staticmethod
    def format_text_message(text: str) -> Dict[str, str]:
        """
        Format a text message object

        Args:
            text: Message text

        Returns:
            Dict: Message object for LINE API
        """
        return {"type": "text", "text": text}

    @staticmethod
    def format_json_message(data: Dict[str, Any], title: str = "Receipt Data") -> Dict[str, str]:
        """
        Format JSON data as a readable text message

        Args:
            data: Data to format
            title: Message title

        Returns:
            Dict: Message object for LINE API
        """
        import json

        formatted_json = json.dumps(data, indent=2, ensure_ascii=False, default=str)
        message = f"✅ {title}\n\n```json\n{formatted_json}\n```"

        return {"type": "text", "text": message}
