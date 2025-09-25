"""
Virus scanning service using ClamAV
"""
import asyncio
import socket
from pathlib import Path
from typing import Dict, Any, Optional
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


class VirusScannerService:
    """Service for scanning files for viruses using ClamAV"""

    def __init__(self):
        self.enabled = settings.clamav_enabled
        self.host = settings.clamav_host
        self.port = settings.clamav_port
        self.timeout = settings.clamav_timeout

    async def scan_file(self, file_path: Path) -> Dict[str, Any]:
        """
        Scan a file for viruses

        Args:
            file_path: Path to the file to scan

        Returns:
            Dictionary with scan results
        """
        if not self.enabled:
            return {
                "status": "skipped",
                "details": "Virus scanning is disabled"
            }

        try:
            result = await self._scan_with_clamav(file_path)
            return result

        except Exception as e:
            logger.error(f"Error scanning file with ClamAV: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "details": f"Scan error: {str(e)}"
            }

    async def _scan_with_clamav(self, file_path: Path) -> Dict[str, Any]:
        """Scan file using ClamAV daemon"""
        try:
            # Connect to ClamAV daemon
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=self.timeout
            )

            # Send INSTREAM command
            writer.write(b"zINSTREAM\0")
            await writer.drain()

            # Send file content in chunks
            chunk_size = 4096
            with open(file_path, "rb") as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break

                    # Send chunk size (4 bytes, network byte order)
                    size = len(chunk).to_bytes(4, byteorder='big')
                    writer.write(size + chunk)
                    await writer.drain()

            # Send zero-length chunk to indicate end
            writer.write(b"\x00\x00\x00\x00")
            await writer.drain()

            # Read response
            response = await asyncio.wait_for(
                reader.read(1024),
                timeout=self.timeout
            )

            writer.close()
            await writer.wait_closed()

            # Parse response
            response_str = response.decode('utf-8').strip()

            if "OK" in response_str:
                return {
                    "status": "clean",
                    "details": "File is clean"
                }
            elif "FOUND" in response_str:
                virus_name = response_str.split(":")[1].strip() if ":" in response_str else "Unknown"
                return {
                    "status": "infected",
                    "details": f"Virus found: {virus_name}"
                }
            else:
                return {
                    "status": "error",
                    "details": f"Unexpected response: {response_str}"
                }

        except asyncio.TimeoutError:
            return {
                "status": "error",
                "details": "Scan timeout"
            }
        except ConnectionRefusedError:
            return {
                "status": "error",
                "details": "Cannot connect to ClamAV daemon"
            }
        except Exception as e:
            return {
                "status": "error",
                "details": f"Scan error: {str(e)}"
            }

    async def ping(self) -> bool:
        """Check if ClamAV daemon is responsive"""
        if not self.enabled:
            return True

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=5
            )

            writer.write(b"zPING\0")
            await writer.drain()

            response = await asyncio.wait_for(
                reader.read(1024),
                timeout=5
            )

            writer.close()
            await writer.wait_closed()

            return b"PONG" in response

        except Exception as e:
            logger.error(f"ClamAV ping failed: {str(e)}")
            return False

    def get_status(self) -> Dict[str, Any]:
        """Get virus scanner status"""
        return {
            "enabled": self.enabled,
            "host": self.host,
            "port": self.port,
            "timeout": self.timeout
        }