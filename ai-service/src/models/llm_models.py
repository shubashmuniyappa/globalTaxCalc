import os
import torch
from typing import Optional, Dict, Any, List
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    pipeline,
    BitsAndBytesConfig
)
from src.config import settings
from src.core import ai_logger
import asyncio
from functools import lru_cache
import threading


class ModelManager:
    """Manages AI models with caching and optimization."""

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        self.pipelines: Dict[str, Any] = {}
        self.device = self._get_optimal_device()
        self.model_lock = threading.Lock()

    def _get_optimal_device(self) -> str:
        """Determine the best available device for inference."""
        if torch.cuda.is_available():
            device = "cuda"
            ai_logger.info("Using CUDA GPU for inference", gpu_count=torch.cuda.device_count())
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = "mps"
            ai_logger.info("Using Apple Metal Performance Shaders")
        else:
            device = "cpu"
            ai_logger.info("Using CPU for inference")
        return device

    def _get_quantization_config(self) -> Optional[BitsAndBytesConfig]:
        """Get quantization config for memory optimization."""
        if self.device == "cuda":
            return BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
        return None

    async def load_llama_model(self, model_name: str = "microsoft/DialoGPT-medium") -> bool:
        """Load Llama model with optimization."""
        try:
            ai_logger.info("Loading LLM model", model=model_name, device=self.device)

            # For now, using DialoGPT as a placeholder for Llama 3.2-1B
            # In production, you would use: "meta-llama/Llama-3.2-1B"

            with self.model_lock:
                if model_name in self.models:
                    ai_logger.info("Model already loaded", model=model_name)
                    return True

                # Load tokenizer
                tokenizer = AutoTokenizer.from_pretrained(
                    model_name,
                    cache_dir=settings.model_cache_dir,
                    trust_remote_code=True,
                    use_auth_token=settings.huggingface_token
                )

                # Add padding token if missing
                if tokenizer.pad_token is None:
                    tokenizer.pad_token = tokenizer.eos_token

                # Load model with optimization
                model_kwargs = {
                    "cache_dir": settings.model_cache_dir,
                    "trust_remote_code": True,
                    "torch_dtype": torch.float16 if self.device != "cpu" else torch.float32,
                }

                if settings.huggingface_token:
                    model_kwargs["use_auth_token"] = settings.huggingface_token

                # Add quantization for GPU
                quantization_config = self._get_quantization_config()
                if quantization_config:
                    model_kwargs["quantization_config"] = quantization_config

                model = AutoModelForCausalLM.from_pretrained(model_name, **model_kwargs)

                if not quantization_config:  # Only move to device if not quantized
                    model = model.to(self.device)

                # Set to evaluation mode
                model.eval()

                # Store model and tokenizer
                self.models[model_name] = model
                self.tokenizers[model_name] = tokenizer

                # Create text generation pipeline
                self.pipelines[model_name] = pipeline(
                    "text-generation",
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if self.device == "cuda" else -1,
                    torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
                    max_length=settings.llama_max_length,
                    temperature=settings.llama_temperature,
                    top_p=settings.llama_top_p,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id
                )

                ai_logger.info("Model loaded successfully", model=model_name)
                return True

        except Exception as e:
            ai_logger.error("Failed to load model", model=model_name, error=str(e))
            return False

    async def generate_text(
        self,
        prompt: str,
        model_name: str = "microsoft/DialoGPT-medium",
        max_new_tokens: int = 150,
        temperature: float = None,
        top_p: float = None
    ) -> Optional[str]:
        """Generate text using the loaded model."""
        try:
            if model_name not in self.pipelines:
                success = await self.load_llama_model(model_name)
                if not success:
                    return None

            # Use custom parameters if provided
            generation_kwargs = {
                "max_new_tokens": max_new_tokens,
                "temperature": temperature or settings.llama_temperature,
                "top_p": top_p or settings.llama_top_p,
                "do_sample": True,
                "return_full_text": False,
                "clean_up_tokenization_spaces": True
            }

            # Generate in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.pipelines[model_name](prompt, **generation_kwargs)
            )

            if result and len(result) > 0:
                generated_text = result[0]["generated_text"].strip()
                ai_logger.debug("Text generated", prompt_length=len(prompt), response_length=len(generated_text))
                return generated_text

            return None

        except Exception as e:
            ai_logger.error("Text generation failed", error=str(e), model=model_name)
            return None

    def unload_model(self, model_name: str) -> bool:
        """Unload a model to free memory."""
        try:
            with self.model_lock:
                if model_name in self.models:
                    del self.models[model_name]
                    del self.tokenizers[model_name]
                    del self.pipelines[model_name]

                    # Clear GPU cache if using CUDA
                    if self.device == "cuda":
                        torch.cuda.empty_cache()

                    ai_logger.info("Model unloaded", model=model_name)
                    return True
                return False
        except Exception as e:
            ai_logger.error("Failed to unload model", model=model_name, error=str(e))
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models."""
        return {
            "device": self.device,
            "loaded_models": list(self.models.keys()),
            "memory_usage": self._get_memory_usage(),
            "cuda_available": torch.cuda.is_available(),
            "model_count": len(self.models)
        }

    def _get_memory_usage(self) -> Dict[str, Any]:
        """Get memory usage information."""
        if self.device == "cuda" and torch.cuda.is_available():
            return {
                "gpu_memory_allocated": torch.cuda.memory_allocated() / 1024**3,  # GB
                "gpu_memory_cached": torch.cuda.memory_reserved() / 1024**3,  # GB
                "gpu_memory_free": (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated()) / 1024**3
            }
        return {"cpu_memory": "N/A"}


# Global model manager instance
model_manager = ModelManager()


@lru_cache(maxsize=1)
def get_model_manager() -> ModelManager:
    """Get the global model manager instance."""
    return model_manager