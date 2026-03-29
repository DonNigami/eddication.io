"""
MLSTMS - PTG eZView Integration Client (Python)
===============================================

ระบบดึงข้อมูล Trips และ Trip Details จาก PTG eZView API
สามารถรันเป็น service บน server หรือใช้งานแบบ standalone

ขั้นตอนการติดตั้ง:
1. pip install -r requirements.txt
2. cp .env.example .env
3. แก้ไขค่า config ใน .env
4. python ptg_ezview_client.py

หรือรันแบบ service:
python ptg_ezview_client.py --daemon
"""

import os
import sys
import json
import time
import logging
import argparse
import requests
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
import csv
import sqlite3
import threading
import signal

# ============================================
# CONFIGURATION
# ============================================

@dataclass
class Config:
    """Configuration class"""
    # API Configuration
    base_url: str = "http://203.151.215.230:9000/eZViewIntegrationService/web-service/api"
    username: str = ""
    password: str = ""

    # Device Info
    device_id: str = "python-integration"
    device_name: str = "Python Integration Client"
    device_type: str = "server"
    os: str = "Python"

    # Query Parameters
    status_id: str = ""
    start_date: str = ""
    end_date: str = ""
    limit: int = 50

    # Rate Limiting
    rate_limit_ms: int = 1000
    fast_mode: bool = False

    # Performance
    adaptive_rate_limit: bool = True
    min_rate_limit_ms: int = 100
    max_rate_limit_ms: int = 1000
    target_response_time_ms: int = 500
    log_level: str = "INFO"

    # Storage
    storage_type: str = "sqlite"  # sqlite, csv, postgresql
    sqlite_path: str = "ptg_data.db"
    csv_path: str = "csv_output"

    # Schedule
    schedule_interval_minutes: int = 60
    daemon_mode: bool = False

    @classmethod
    def from_env(cls) -> 'Config':
        """Load configuration from environment variables"""
        return cls(
            base_url=os.getenv("PTG_BASE_URL", cls.base_url),
            username=os.getenv("PTG_USERNAME", ""),
            password=os.getenv("PTG_PASSWORD", ""),
            device_id=os.getenv("PTG_DEVICE_ID", cls.device_id),
            device_name=os.getenv("PTG_DEVICE_NAME", cls.device_name),
            device_type=os.getenv("PTG_DEVICE_TYPE", cls.device_type),
            os=os.getenv("PTG_OS", cls.os),
            status_id=os.getenv("PTG_STATUS_ID", ""),
            start_date=os.getenv("PTG_START_DATE", ""),
            end_date=os.getenv("PTG_END_DATE", ""),
            limit=int(os.getenv("PTG_LIMIT", str(cls.limit))),
            rate_limit_ms=int(os.getenv("PTG_RATE_LIMIT_MS", str(cls.rate_limit_ms))),
            fast_mode=os.getenv("PTG_FAST_MODE", "false").lower() == "true",
            adaptive_rate_limit=os.getenv("PTG_ADAPTIVE_RATE_LIMIT", "true").lower() == "true",
            min_rate_limit_ms=int(os.getenv("PTG_MIN_RATE_LIMIT_MS", str(cls.min_rate_limit_ms))),
            max_rate_limit_ms=int(os.getenv("PTG_MAX_RATE_LIMIT_MS", str(cls.max_rate_limit_ms))),
            target_response_time_ms=int(os.getenv("PTG_TARGET_RESPONSE_TIME_MS", str(cls.target_response_time_ms))),
            log_level=os.getenv("PTG_LOG_LEVEL", cls.log_level),
            storage_type=os.getenv("PTG_STORAGE_TYPE", cls.storage_type),
            sqlite_path=os.getenv("PTG_SQLITE_PATH", cls.sqlite_path),
            csv_path=os.getenv("PTG_CSV_PATH", cls.csv_path),
            schedule_interval_minutes=int(os.getenv("PTG_SCHEDULE_MINUTES", str(cls.schedule_interval_minutes))),
            daemon_mode=False
        )

# ============================================
# LOGGER SETUP
# ============================================

def setup_logger(log_level: str) -> logging.Logger:
    """Setup logger with specified level"""
    logger = logging.getLogger("PTG_eZView")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger

# ============================================
# API CLIENT
# ============================================

class PTG_eZViewClient:
    """PTG eZView API Client"""

    def __init__(self, config: Config, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.session = requests.Session()
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.current_delay = config.rate_limit_ms / 1000

    def login(self) -> bool:
        """Login to get access token"""
        url = f"{self.config.base_url}/v1/login"
        payload = {
            "username": self.config.username,
            "password": self.config.password,
            "deviceInfo": {
                "deviceId": self.config.device_id,
                "deviceName": self.config.device_name,
                "deviceType": self.config.device_type,
                "os": self.config.os
            }
        }

        try:
            response = self.session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            if data.get("data", {}).get("accessToken"):
                self.access_token = data["data"]["accessToken"]
                self.refresh_token = data["data"].get("refreshToken")
                self.token_expires_at = datetime.now() + timedelta(minutes=55)
                self.logger.info("✅ Login successful!")
                return True
            else:
                self.logger.error("❌ Invalid response format: missing accessToken")
                return False

        except Exception as e:
            self.logger.error(f"❌ Login error: {e}")
            return False

    def ensure_authenticated(self) -> bool:
        """Ensure we have a valid access token"""
        if not self.access_token or not self.token_expires_at:
            return self.login()

        if datetime.now() >= self.token_expires_at:
            return self.login()

        return True

    def refresh_access_token(self) -> bool:
        """Refresh access token"""
        if not self.refresh_token:
            return self.login()

        url = f"{self.config.base_url}/v1/refresh-token"
        payload = {"refreshToken": self.refresh_token}

        try:
            response = self.session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                self.access_token = data["data"]["accessToken"]
                self.refresh_token = data["data"].get("refreshToken")
                self.token_expires_at = datetime.now() + timedelta(minutes=55)
                self.logger.info("✅ Token refreshed!")
                return True
            else:
                return self.login()

        except Exception as e:
            self.logger.error(f"❌ Refresh token error: {e}")
            return self.login()

    def adaptive_sleep(self, response_time: float):
        """Adaptive sleep based on response time"""
        if self.config.fast_mode or not self.config.adaptive_rate_limit:
            return

        response_time_ms = response_time * 1000

        if response_time_ms < self.config.target_response_time_ms:
            # API responding fast, decrease delay
            self.current_delay = max(
                self.config.min_rate_limit_ms / 1000,
                self.current_delay * 0.9
            )
        else:
            # API responding slow, increase delay
            self.current_delay = min(
                self.config.max_rate_limit_ms / 1000,
                self.current_delay * 1.1
            )

        self.logger.debug(f"⏱️  Sleeping {self.current_delay:.2f}s (response: {response_time_ms:.0f}ms)")
        time.sleep(self.current_delay)

    def get_trips(
        self,
        status_id: str = "",
        start_date: str = "",
        end_date: str = "",
        limit: int = 50,
        offset: int = 0
    ) -> Optional[Dict[str, Any]]:
        """Get trips list"""
        if not self.ensure_authenticated():
            return None

        url = f"{self.config.base_url}/v1/trips"
        params = {}
        if status_id:
            params["statusId"] = status_id
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset

        try:
            start_time = time.time()
            response = self.session.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=30
            )
            response_time = time.time() - start_time

            if response.status_code == 401:
                if self.refresh_access_token():
                    return self.get_trips(status_id, start_date, end_date, limit, offset)
                return None

            response.raise_for_status()
            self.adaptive_sleep(response_time)

            return response.json()

        except Exception as e:
            self.logger.error(f"❌ Get trips error: {e}")
            return None

    def get_all_trips(self) -> List[Dict[str, Any]]:
        """Get all trips (paginated)"""
        all_trips = []
        offset = 0
        limit = 100
        page = 0

        self.logger.info("🔄 Fetching all trips (paginated)...")

        while True:
            page += 1
            self.logger.info(f"📄 Fetching page {page}...")

            result = self.get_trips(
                status_id=self.config.status_id,
                limit=limit,
                offset=offset
            )

            if not result:
                self.logger.error(f"❌ Failed to fetch page {page}")
                break

            trips = result.get("data", [])
            if not trips:
                self.logger.info(f"✅ No more trips (total: {len(all_trips)})")
                break

            all_trips.extend(trips)
            self.logger.info(f"📦 Page {page}: {len(trips)} trips (total: {len(all_trips)})")

            if len(trips) < limit:
                break

            offset += limit

        return all_trips

    def get_trip_details(self, trip_id: str) -> Optional[Dict[str, Any]]:
        """Get trip details"""
        if not self.ensure_authenticated():
            return None

        url = f"{self.config.base_url}/v1/trips/{trip_id}"

        try:
            start_time = time.time()
            response = self.session.get(
                url,
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=30
            )
            response_time = time.time() - start_time

            if response.status_code == 401:
                if self.refresh_access_token():
                    return self.get_trip_details(trip_id)
                return None

            if response.status_code != 200:
                self.logger.warning(f"⚠️  Trip {trip_id}: status {response.status_code}")
                return None

            self.adaptive_sleep(response_time)
            return response.json()

        except Exception as e:
            self.logger.error(f"❌ Get trip details error for {trip_id}: {e}")
            return None

    def fetch_all_data(self) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Fetch all trips and their details"""
        trips = self.get_all_trips()
        if not trips:
            return [], []

        self.logger.info(f"🔄 Fetching details for {len(trips)} trips...")

        trip_details = []
        for i, trip in enumerate(trips, 1):
            trip_id = trip.get("tripId") or trip.get("id")
            if not trip_id:
                continue

            self.logger.info(f"📦 [{i}/{len(trips)}] Fetching details for trip {trip_id}...")

            details = self.get_trip_details(trip_id)
            if details:
                trip_details.append(details)

        self.logger.info(f"✅ Fetched {len(trip_details)} trip details")
        return trips, trip_details

# ============================================
# STORAGE HANDLERS
# ============================================

class SQLiteStorage:
    """SQLite storage handler"""

    def __init__(self, db_path: str, logger: logging.Logger):
        self.db_path = db_path
        self.logger = logger
        self._init_db()

    def _init_db(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Trips table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id TEXT UNIQUE,
                data JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Trip details table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trip_details (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id TEXT UNIQUE,
                data JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()
        self.logger.info(f"✅ SQLite database initialized: {self.db_path}")

    def save_trips(self, trips: List[Dict[str, Any]]) -> int:
        """Save trips to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        count = 0

        for trip in trips:
            trip_id = trip.get("tripId") or trip.get("id")
            if not trip_id:
                continue

            data_json = json.dumps(trip, ensure_ascii=False)

            cursor.execute('''
                INSERT OR REPLACE INTO trips (trip_id, data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (trip_id, data_json))
            count += 1

        conn.commit()
        conn.close()
        self.logger.info(f"✅ Saved {count} trips to SQLite")
        return count

    def save_trip_details(self, trip_details: List[Dict[str, Any]]) -> int:
        """Save trip details to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        count = 0

        for detail in trip_details:
            trip_id = detail.get("tripId") or detail.get("id")
            if not trip_id:
                continue

            data_json = json.dumps(detail, ensure_ascii=False)

            cursor.execute('''
                INSERT OR REPLACE INTO trip_details (trip_id, data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (trip_id, data_json))
            count += 1

        conn.commit()
        conn.close()
        self.logger.info(f"✅ Saved {count} trip details to SQLite")
        return count

class CSVStorage:
    """CSV storage handler"""

    def __init__(self, csv_path: str, logger: logging.Logger):
        self.csv_path = csv_path
        self.logger = logger
        os.makedirs(csv_path, exist_ok=True)

    def save_trips(self, trips: List[Dict[str, Any]]) -> int:
        """Save trips to CSV"""
        if not trips:
            return 0

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.csv_path, f"trips_{timestamp}.csv")

        # Flatten nested JSON
        flattened = []
        for trip in trips:
            flat = self._flatten_dict(trip)
            flattened.append(flat)

        # Get all unique keys
        fieldnames = set()
        for item in flattened:
            fieldnames.update(item.keys())
        fieldnames = sorted(fieldnames)

        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(flattened)

        self.logger.info(f"✅ Saved {len(trips)} trips to {filename}")
        return len(trips)

    def save_trip_details(self, trip_details: List[Dict[str, Any]]) -> int:
        """Save trip details to CSV"""
        if not trip_details:
            return 0

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.csv_path, f"trip_details_{timestamp}.csv")

        # Flatten nested JSON
        flattened = []
        for detail in trip_details:
            flat = self._flatten_dict(detail)
            flattened.append(flat)

        # Get all unique keys
        fieldnames = set()
        for item in flattened:
            fieldnames.update(item.keys())
        fieldnames = sorted(fieldnames)

        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(flattened)

        self.logger.info(f"✅ Saved {len(trip_details)} trip details to {filename}")
        return len(trip_details)

    def _flatten_dict(self, d: Dict[str, Any], parent_key: str = "", sep: str = "_") -> Dict[str, Any]:
        """Flatten nested dictionary"""
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                items.append((new_key, json.dumps(v, ensure_ascii=False)))
            else:
                items.append((new_key, v))
        return dict(items)

# ============================================
# MAIN APPLICATION
# ============================================

class PTG_eZViewApp:
    """Main application"""

    def __init__(self, config: Config):
        self.config = config
        self.logger = setup_logger(config.log_level)
        self.client = PTG_eZViewClient(config, self.logger)
        self.storage = self._init_storage()
        self.running = False
        self.shutdown_event = threading.Event()

    def _init_storage(self):
        """Initialize storage based on config"""
        if self.config.storage_type == "sqlite":
            return SQLiteStorage(self.config.sqlite_path, self.logger)
        elif self.config.storage_type == "csv":
            return CSVStorage(self.config.csv_path, self.logger)
        else:
            raise ValueError(f"Unknown storage type: {self.config.storage_type}")

    def run_once(self) -> bool:
        """Run data fetch once"""
        self.logger.info("=" * 50)
        self.logger.info("🚀 Starting data fetch...")

        try:
            trips, trip_details = self.client.fetch_all_data()

            if trips:
                self.storage.save_trips(trips)

            if trip_details:
                self.storage.save_trip_details(trip_details)

            self.logger.info("✅ Data fetch completed!")
            return True

        except Exception as e:
            self.logger.error(f"❌ Error during data fetch: {e}")
            return False

    def run_scheduled(self):
        """Run in scheduled mode"""
        self.running = True
        self.logger.info(f"🔄 Scheduled mode: running every {self.config.schedule_interval_minutes} minutes")

        while self.running and not self.shutdown_event.is_set():
            self.run_once()

            # Wait for next interval or shutdown signal
            self.logger.info(f"⏳ Next run in {self.config.schedule_interval_minutes} minutes...")
            self.shutdown_event.wait(timeout=self.config.schedule_interval_minutes * 60)

        self.logger.info("🛑 Scheduled mode stopped")

    def shutdown(self):
        """Graceful shutdown"""
        self.logger.info("🛑 Shutting down...")
        self.running = False
        self.shutdown_event.set()

# ============================================
# SIGNAL HANDLERS
# ============================================

def signal_handler(app: PTG_eZViewApp, signum, frame):
    """Handle shutdown signals"""
    app.shutdown()

# ============================================
# MAIN ENTRY POINT
# ============================================

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="PTG eZView API Integration Client",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--daemon", "-d",
        action="store_true",
        help="Run as daemon (scheduled mode)"
    )

    parser.add_argument(
        "--once", "-o",
        action="store_true",
        help="Run once and exit"
    )

    parser.add_argument(
        "--config", "-c",
        type=str,
        help="Path to config file (JSON)"
    )

    parser.add_argument(
        "--status-id",
        type=str,
        help="Filter by status ID"
    )

    parser.add_argument(
        "--start-date",
        type=str,
        help="Start date (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--end-date",
        type=str,
        help="End date (YYYY-MM-DD)"
    )

    args = parser.parse_args()

    # Load config
    if args.config and os.path.exists(args.config):
        with open(args.config, 'r') as f:
            config_dict = json.load(f)
            config = Config(**config_dict)
    else:
        config = Config.from_env()

    # Override with CLI args
    if args.status_id:
        config.status_id = args.status_id
    if args.start_date:
        config.start_date = args.start_date
    if args.end_date:
        config.end_date = args.end_date
    if args.daemon:
        config.daemon_mode = True

    # Validate credentials
    if not config.username or not config.password:
        print("❌ Error: PTG_USERNAME and PTG_PASSWORD must be set")
        print("💡 Set them in .env file or environment variables")
        sys.exit(1)

    # Create and run app
    app = PTG_eZViewApp(config)

    # Setup signal handlers
    signal.signal(signal.SIGINT, lambda s, f: signal_handler(app, s, f))
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler(app, s, f))

    try:
        if args.once or not config.daemon_mode:
            success = app.run_once()
            sys.exit(0 if success else 1)
        else:
            app.run_scheduled()
    except KeyboardInterrupt:
        app.shutdown()
        sys.exit(0)

if __name__ == "__main__":
    main()
