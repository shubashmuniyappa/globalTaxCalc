"""
File encryption and decryption utilities
"""
import os
import base64
from pathlib import Path
from typing import Union, Tuple
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


class FileEncryption:
    """Service for encrypting and decrypting files"""

    def __init__(self):
        self.encryption_key = self._get_encryption_key()
        self.fernet = Fernet(self.encryption_key) if self.encryption_key else None

    def _get_encryption_key(self) -> bytes:
        """Get or generate encryption key"""
        try:
            if settings.file_encryption_key:
                # Use provided key
                return base64.urlsafe_b64decode(settings.file_encryption_key)
            elif settings.file_encryption_password:
                # Derive key from password
                salt = settings.file_encryption_salt.encode() if settings.file_encryption_salt else b'default_salt'
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=salt,
                    iterations=100000,
                )
                key = base64.urlsafe_b64encode(kdf.derive(settings.file_encryption_password.encode()))
                return key
            else:
                # Generate a new key (for development only)
                logger.warning("No encryption key configured, generating random key")
                return Fernet.generate_key()
        except Exception as e:
            logger.error(f"Error setting up encryption key: {str(e)}")
            return None

    def encrypt_file(self, file_path: Path) -> Tuple[bool, str]:
        """
        Encrypt a file in place

        Args:
            file_path: Path to the file to encrypt

        Returns:
            Tuple of (success, message)
        """
        try:
            if not self.fernet:
                return False, "Encryption not configured"

            if not file_path.exists():
                return False, "File does not exist"

            # Read file content
            with open(file_path, 'rb') as f:
                file_data = f.read()

            # Encrypt the data
            encrypted_data = self.fernet.encrypt(file_data)

            # Write encrypted data back to file
            with open(file_path, 'wb') as f:
                f.write(encrypted_data)

            logger.info(f"File encrypted: {file_path}")
            return True, "File encrypted successfully"

        except Exception as e:
            logger.error(f"Error encrypting file {file_path}: {str(e)}")
            return False, f"Encryption failed: {str(e)}"

    def decrypt_file(self, file_path: Path) -> Tuple[bool, str]:
        """
        Decrypt a file in place

        Args:
            file_path: Path to the encrypted file

        Returns:
            Tuple of (success, message)
        """
        try:
            if not self.fernet:
                return False, "Encryption not configured"

            if not file_path.exists():
                return False, "File does not exist"

            # Read encrypted file content
            with open(file_path, 'rb') as f:
                encrypted_data = f.read()

            # Decrypt the data
            file_data = self.fernet.decrypt(encrypted_data)

            # Write decrypted data back to file
            with open(file_path, 'wb') as f:
                f.write(file_data)

            logger.info(f"File decrypted: {file_path}")
            return True, "File decrypted successfully"

        except Exception as e:
            logger.error(f"Error decrypting file {file_path}: {str(e)}")
            return False, f"Decryption failed: {str(e)}"

    def encrypt_data(self, data: Union[str, bytes]) -> Union[bytes, None]:
        """
        Encrypt data

        Args:
            data: Data to encrypt (str or bytes)

        Returns:
            Encrypted data or None if failed
        """
        try:
            if not self.fernet:
                return None

            if isinstance(data, str):
                data = data.encode('utf-8')

            return self.fernet.encrypt(data)

        except Exception as e:
            logger.error(f"Error encrypting data: {str(e)}")
            return None

    def decrypt_data(self, encrypted_data: bytes) -> Union[bytes, None]:
        """
        Decrypt data

        Args:
            encrypted_data: Encrypted data to decrypt

        Returns:
            Decrypted data or None if failed
        """
        try:
            if not self.fernet:
                return None

            return self.fernet.decrypt(encrypted_data)

        except Exception as e:
            logger.error(f"Error decrypting data: {str(e)}")
            return None

    def is_file_encrypted(self, file_path: Path) -> bool:
        """
        Check if a file is encrypted

        Args:
            file_path: Path to the file to check

        Returns:
            True if file appears to be encrypted
        """
        try:
            if not file_path.exists():
                return False

            # Read first few bytes to check for Fernet token structure
            with open(file_path, 'rb') as f:
                header = f.read(32)

            # Fernet tokens start with version byte and timestamp
            # This is a basic check - not foolproof
            try:
                if self.fernet:
                    # Try to decrypt first 100 bytes to see if it's encrypted
                    with open(file_path, 'rb') as f:
                        sample = f.read(100)
                    if len(sample) > 0:
                        self.fernet.decrypt(sample[:min(len(sample), 100)])
                        return True
            except:
                pass

            return False

        except Exception as e:
            logger.error(f"Error checking if file is encrypted: {str(e)}")
            return False

    def secure_delete_file(self, file_path: Path) -> Tuple[bool, str]:
        """
        Securely delete a file by overwriting with random data

        Args:
            file_path: Path to the file to delete

        Returns:
            Tuple of (success, message)
        """
        try:
            if not file_path.exists():
                return True, "File does not exist"

            file_size = file_path.stat().st_size

            # Overwrite file with random data multiple times
            with open(file_path, 'r+b') as f:
                for _ in range(3):  # 3 passes
                    f.seek(0)
                    f.write(os.urandom(file_size))
                    f.flush()
                    os.fsync(f.fileno())

            # Delete the file
            file_path.unlink()

            logger.info(f"File securely deleted: {file_path}")
            return True, "File securely deleted"

        except Exception as e:
            logger.error(f"Error securely deleting file {file_path}: {str(e)}")
            return False, f"Secure deletion failed: {str(e)}"

    def get_encryption_status(self) -> dict:
        """Get encryption configuration status"""
        return {
            "enabled": self.fernet is not None,
            "key_configured": bool(settings.file_encryption_key or settings.file_encryption_password),
            "algorithm": "AES-128 (Fernet)" if self.fernet else None
        }