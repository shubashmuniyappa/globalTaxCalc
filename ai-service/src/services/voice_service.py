import asyncio
import tempfile
import os
from typing import Optional, Dict, Any, BinaryIO
from pathlib import Path
import speech_recognition as sr
import whisper
from pydub import AudioSegment
from pydub.effects import normalize
import librosa
import soundfile as sf
import webrtcvad
import numpy as np

from src.config import settings
from src.core import voice_logger


class VoiceProcessingService:
    """Service for processing voice input and converting to text."""

    def __init__(self):
        self.whisper_model = None
        self.speech_recognizer = sr.Recognizer()
        self.vad = webrtcvad.Vad(2)  # Aggressiveness level 2 (0-3)
        self.supported_formats = settings.supported_audio_formats

    async def initialize(self):
        """Initialize voice processing models."""
        try:
            voice_logger.info("Initializing voice processing service")

            # Load Whisper model
            self.whisper_model = whisper.load_model(
                settings.whisper_model,
                download_root=settings.model_cache_dir
            )

            # Configure speech recognizer
            self.speech_recognizer.energy_threshold = 300
            self.speech_recognizer.dynamic_energy_threshold = True
            self.speech_recognizer.pause_threshold = 0.8
            self.speech_recognizer.phrase_threshold = 0.3

            voice_logger.info("Voice processing service initialized successfully")

        except Exception as e:
            voice_logger.error("Failed to initialize voice service", error=str(e))
            raise

    async def transcribe_audio_file(
        self,
        audio_file: BinaryIO,
        filename: str,
        language: str = "en"
    ) -> Dict[str, Any]:
        """Transcribe audio file to text."""
        try:
            voice_logger.info("Starting audio transcription", filename=filename, language=language)

            # Validate file format
            file_extension = Path(filename).suffix.lower().lstrip('.')
            if file_extension not in self.supported_formats:
                raise ValueError(f"Unsupported audio format: {file_extension}")

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=f".{file_extension}", delete=False) as temp_file:
                temp_file.write(audio_file.read())
                temp_path = temp_file.name

            try:
                # Load and preprocess audio
                audio_data = await self._preprocess_audio(temp_path)

                # Check duration
                duration = len(audio_data) / 16000  # Assuming 16kHz sample rate
                if duration > settings.max_audio_duration:
                    raise ValueError(f"Audio too long: {duration:.1f}s (max: {settings.max_audio_duration}s)")

                # Transcribe with Whisper
                result = await self._transcribe_with_whisper(audio_data, language)

                # Add confidence scoring
                result["confidence_score"] = self._calculate_transcription_confidence(result)

                # Validate and clean text
                result["cleaned_text"] = self._clean_transcription(result["text"])

                voice_logger.info("Audio transcription completed",
                                filename=filename,
                                duration=duration,
                                confidence=result["confidence_score"],
                                text_length=len(result["text"]))

                return result

            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

        except Exception as e:
            voice_logger.error("Audio transcription failed", filename=filename, error=str(e))
            return {
                "text": "",
                "confidence_score": 0.0,
                "error": str(e),
                "language": language
            }

    async def transcribe_realtime_audio(
        self,
        audio_chunks: list,
        sample_rate: int = 16000,
        language: str = "en"
    ) -> Dict[str, Any]:
        """Transcribe real-time audio chunks."""
        try:
            voice_logger.info("Starting real-time transcription", chunks=len(audio_chunks))

            # Combine audio chunks
            combined_audio = np.concatenate(audio_chunks)

            # Apply voice activity detection
            if self._has_speech(combined_audio, sample_rate):
                # Transcribe with Whisper
                result = await self._transcribe_with_whisper(combined_audio, language)
                result["confidence_score"] = self._calculate_transcription_confidence(result)
                result["cleaned_text"] = self._clean_transcription(result["text"])

                voice_logger.info("Real-time transcription completed",
                                confidence=result["confidence_score"],
                                text_length=len(result["text"]))
                return result
            else:
                voice_logger.info("No speech detected in audio")
                return {
                    "text": "",
                    "confidence_score": 0.0,
                    "language": language,
                    "no_speech_detected": True
                }

        except Exception as e:
            voice_logger.error("Real-time transcription failed", error=str(e))
            return {
                "text": "",
                "confidence_score": 0.0,
                "error": str(e),
                "language": language
            }

    async def _preprocess_audio(self, audio_path: str) -> np.ndarray:
        """Preprocess audio file for better transcription."""
        try:
            # Load audio with librosa
            audio, sr = librosa.load(audio_path, sr=16000, mono=True)

            # Apply noise reduction and normalization
            audio = self._reduce_noise(audio)
            audio = self._normalize_audio(audio)

            # Apply voice activity detection and trim silence
            audio = self._trim_silence(audio, sr)

            return audio

        except Exception as e:
            voice_logger.error("Audio preprocessing failed", error=str(e))
            raise

    def _reduce_noise(self, audio: np.ndarray) -> np.ndarray:
        """Apply basic noise reduction."""
        try:
            # Simple spectral subtraction for noise reduction
            # This is a basic implementation - in production, you might want more sophisticated methods

            # Calculate noise profile from first 0.5 seconds
            noise_sample_length = min(len(audio), 8000)  # 0.5 seconds at 16kHz
            noise_profile = np.mean(np.abs(np.fft.fft(audio[:noise_sample_length])))

            # Apply high-pass filter to reduce low-frequency noise
            from scipy.signal import butter, filtfilt
            b, a = butter(4, 300, btype='high', fs=16000)
            audio = filtfilt(b, a, audio)

            return audio

        except Exception:
            # If noise reduction fails, return original audio
            return audio

    def _normalize_audio(self, audio: np.ndarray) -> np.ndarray:
        """Normalize audio levels."""
        # Normalize to [-1, 1] range
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            audio = audio / max_val * 0.95  # Leave some headroom

        return audio

    def _trim_silence(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """Trim silence from beginning and end of audio."""
        try:
            # Use librosa to trim silence
            audio_trimmed, _ = librosa.effects.trim(
                audio,
                top_db=20,  # Consider anything below -20dB as silence
                frame_length=2048,
                hop_length=512
            )

            # Ensure we don't trim too much
            if len(audio_trimmed) < len(audio) * 0.1:  # If trimmed to less than 10%, use original
                return audio

            return audio_trimmed

        except Exception:
            return audio

    def _has_speech(self, audio: np.ndarray, sample_rate: int) -> bool:
        """Detect if audio contains speech using VAD."""
        try:
            # Convert to 16-bit PCM
            audio_int16 = (audio * 32767).astype(np.int16)

            # VAD requires specific sample rates (8000, 16000, 32000, 48000)
            if sample_rate not in [8000, 16000, 32000, 48000]:
                # Resample to 16000 Hz
                audio_resampled = librosa.resample(audio, orig_sr=sample_rate, target_sr=16000)
                audio_int16 = (audio_resampled * 32767).astype(np.int16)
                sample_rate = 16000

            # Split audio into frames (10ms each)
            frame_duration = 0.01  # 10ms
            frame_size = int(sample_rate * frame_duration)

            speech_frames = 0
            total_frames = 0

            for i in range(0, len(audio_int16) - frame_size, frame_size):
                frame = audio_int16[i:i + frame_size]
                total_frames += 1

                # VAD requires frames to be bytes
                frame_bytes = frame.tobytes()
                if self.vad.is_speech(frame_bytes, sample_rate):
                    speech_frames += 1

            # Consider speech if more than 30% of frames contain speech
            speech_ratio = speech_frames / total_frames if total_frames > 0 else 0
            return speech_ratio > 0.3

        except Exception as e:
            voice_logger.warning("VAD failed, assuming speech present", error=str(e))
            return True  # Conservative fallback

    async def _transcribe_with_whisper(self, audio: np.ndarray, language: str) -> Dict[str, Any]:
        """Transcribe audio using Whisper model."""
        try:
            # Run Whisper transcription in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.whisper_model.transcribe(
                    audio,
                    language=language if language != "auto" else None,
                    task="transcribe",
                    fp16=False,  # Use fp32 for better compatibility
                    verbose=False
                )
            )

            return {
                "text": result["text"].strip(),
                "language": result.get("language", language),
                "segments": result.get("segments", []),
                "raw_result": result
            }

        except Exception as e:
            voice_logger.error("Whisper transcription failed", error=str(e))
            raise

    def _calculate_transcription_confidence(self, result: Dict[str, Any]) -> float:
        """Calculate confidence score for transcription."""
        try:
            # Use segment-level confidence if available
            segments = result.get("segments", [])
            if segments:
                # Average no_speech_prob (lower is better)
                no_speech_probs = [seg.get("no_speech_prob", 0.5) for seg in segments]
                avg_no_speech_prob = np.mean(no_speech_probs)
                confidence = 1.0 - avg_no_speech_prob

                # Adjust based on text length and quality
                text = result.get("text", "")
                if len(text.strip()) < 5:  # Very short transcriptions are less reliable
                    confidence *= 0.7

                # Check for repeated words (often indicates poor quality)
                words = text.lower().split()
                if len(words) > 0:
                    unique_words = len(set(words))
                    repetition_ratio = unique_words / len(words)
                    if repetition_ratio < 0.7:  # High repetition
                        confidence *= 0.8

                return max(0.0, min(1.0, confidence))

            else:
                # Fallback confidence based on text quality
                text = result.get("text", "")
                if len(text.strip()) > 10:
                    return 0.7
                elif len(text.strip()) > 0:
                    return 0.5
                else:
                    return 0.0

        except Exception:
            return 0.5  # Default confidence

    def _clean_transcription(self, text: str) -> str:
        """Clean and improve transcription text."""
        if not text:
            return ""

        # Remove extra whitespace
        text = " ".join(text.split())

        # Fix common transcription errors
        replacements = {
            " i ": " I ",  # Capitalize "I"
            "dont": "don't",
            "cant": "can't",
            "wont": "won't",
            "im ": "I'm ",
            "ive ": "I've ",
            "thats": "that's",
            "its ": "it's ",
            "youre": "you're",
            "theyre": "they're",
            "were ": "we're ",
        }

        text_lower = text.lower()
        for wrong, correct in replacements.items():
            text = text.replace(wrong, correct)

        # Capitalize first letter
        if text:
            text = text[0].upper() + text[1:]

        return text.strip()

    async def get_supported_formats(self) -> Dict[str, Any]:
        """Get information about supported audio formats."""
        return {
            "supported_formats": self.supported_formats,
            "max_duration_seconds": settings.max_audio_duration,
            "recommended_sample_rate": 16000,
            "recommended_format": "wav",
            "max_file_size_mb": 100  # Reasonable limit
        }

    async def health_check(self) -> Dict[str, Any]:
        """Check health of voice processing service."""
        try:
            status = {
                "whisper_model_loaded": self.whisper_model is not None,
                "speech_recognizer_ready": self.speech_recognizer is not None,
                "vad_ready": self.vad is not None,
                "supported_formats": len(self.supported_formats),
                "status": "healthy"
            }

            if not all([status["whisper_model_loaded"], status["speech_recognizer_ready"], status["vad_ready"]]):
                status["status"] = "degraded"

            return status

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "whisper_model_loaded": False,
                "speech_recognizer_ready": False,
                "vad_ready": False
            }


# Global service instance
voice_service = VoiceProcessingService()