"""
OCR processing service using Tesseract
"""
import cv2
import numpy as np
import pytesseract
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter
from pdf2image import convert_from_path
import tempfile
import os

from app.config import settings, OCR_PREPROCESSING, IMAGE_FORMATS
from app.utils.logging import get_logger

logger = get_logger(__name__)


class OCRService:
    """Service for optical character recognition using Tesseract"""

    def __init__(self):
        self.tesseract_path = settings.tesseract_path
        self.languages = settings.tesseract_lang
        self.dpi = settings.ocr_dpi
        self.confidence_threshold = settings.ocr_confidence_threshold

        # Set Tesseract path if specified
        if self.tesseract_path and os.path.exists(self.tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = self.tesseract_path

    async def process_document(self, file_path: Path) -> Dict[str, Any]:
        """
        Process a document and extract text using OCR

        Args:
            file_path: Path to the document file

        Returns:
            Dictionary containing OCR results
        """
        try:
            logger.info(f"Starting OCR processing for file: {file_path}")

            # Convert file to images if needed
            images = await self._convert_to_images(file_path)

            if not images:
                return {
                    "success": False,
                    "error": "Could not convert file to images for OCR processing",
                    "pages": [],
                    "raw_text": "",
                    "confidence": 0
                }

            # Process each page
            pages_data = []
            all_text = []
            total_confidence = 0

            for i, image in enumerate(images):
                page_result = await self._process_image(image, page_number=i + 1)
                pages_data.append(page_result)
                all_text.append(page_result["text"])
                total_confidence += page_result["confidence"]

            # Calculate overall confidence
            overall_confidence = total_confidence / len(images) if images else 0

            # Combine all text
            combined_text = "\n\n".join(all_text)

            result = {
                "success": True,
                "pages": pages_data,
                "page_count": len(images),
                "raw_text": combined_text,
                "confidence": overall_confidence,
                "processing_info": {
                    "tesseract_version": pytesseract.get_tesseract_version(),
                    "languages": self.languages,
                    "dpi": self.dpi
                }
            }

            logger.info(
                f"OCR processing completed successfully",
                extra={
                    "page_count": len(images),
                    "confidence": overall_confidence,
                    "text_length": len(combined_text)
                }
            )

            return result

        except Exception as e:
            logger.error(f"Error in OCR processing: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "pages": [],
                "raw_text": "",
                "confidence": 0
            }

    async def _convert_to_images(self, file_path: Path) -> List[Image.Image]:
        """Convert file to images for OCR processing"""
        try:
            file_extension = file_path.suffix.lower().lstrip(".")

            if file_extension == "pdf":
                return await self._convert_pdf_to_images(file_path)
            elif file_extension in ["jpg", "jpeg", "png", "tiff", "tif"]:
                return [Image.open(file_path)]
            else:
                logger.error(f"Unsupported file format for OCR: {file_extension}")
                return []

        except Exception as e:
            logger.error(f"Error converting file to images: {str(e)}", exc_info=True)
            return []

    async def _convert_pdf_to_images(self, pdf_path: Path) -> List[Image.Image]:
        """Convert PDF to images"""
        try:
            # Convert PDF to images
            images = convert_from_path(
                pdf_path,
                dpi=self.dpi,
                fmt='RGB',
                thread_count=2,
                poppler_path=None  # Use system poppler
            )

            logger.info(f"Converted PDF to {len(images)} images")
            return images

        except Exception as e:
            logger.error(f"Error converting PDF to images: {str(e)}", exc_info=True)
            return []

    async def _process_image(self, image: Image.Image, page_number: int = 1) -> Dict[str, Any]:
        """Process a single image with OCR"""
        try:
            # Preprocess image for better OCR accuracy
            processed_image = await self._preprocess_image(image)

            # Perform OCR with detailed output
            custom_config = f'--oem 3 --psm 6 -l {self.languages}'

            # Get detailed OCR data
            ocr_data = pytesseract.image_to_data(
                processed_image,
                config=custom_config,
                output_type=pytesseract.Output.DICT
            )

            # Extract text with confidence filtering
            text_parts = []
            word_confidences = []
            word_locations = []

            for i in range(len(ocr_data['text'])):
                word = ocr_data['text'][i].strip()
                confidence = int(ocr_data['conf'][i])

                if word and confidence > self.confidence_threshold:
                    text_parts.append(word)
                    word_confidences.append(confidence)
                    word_locations.append({
                        'x': ocr_data['left'][i],
                        'y': ocr_data['top'][i],
                        'width': ocr_data['width'][i],
                        'height': ocr_data['height'][i],
                        'word': word,
                        'confidence': confidence
                    })

            # Reconstruct text with proper spacing
            full_text = await self._reconstruct_text(ocr_data)

            # Calculate average confidence
            avg_confidence = np.mean(word_confidences) if word_confidences else 0

            return {
                "page_number": page_number,
                "text": full_text,
                "confidence": avg_confidence,
                "word_count": len(text_parts),
                "word_locations": word_locations,
                "image_dimensions": {
                    "width": processed_image.width,
                    "height": processed_image.height
                }
            }

        except Exception as e:
            logger.error(f"Error processing image for OCR: {str(e)}", exc_info=True)
            return {
                "page_number": page_number,
                "text": "",
                "confidence": 0,
                "word_count": 0,
                "word_locations": [],
                "error": str(e)
            }

    async def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Preprocess image to improve OCR accuracy"""
        try:
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Convert PIL image to OpenCV format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            # Apply preprocessing steps
            if OCR_PREPROCESSING.get("denoise", False):
                cv_image = cv2.fastNlMeansDenoisingColored(cv_image, None, 10, 10, 7, 21)

            if OCR_PREPROCESSING.get("deskew", False):
                cv_image = await self._deskew_image(cv_image)

            if OCR_PREPROCESSING.get("contrast_enhancement", False):
                cv_image = await self._enhance_contrast(cv_image)

            if OCR_PREPROCESSING.get("resolution_enhancement", False):
                cv_image = await self._enhance_resolution(cv_image)

            if OCR_PREPROCESSING.get("morphology", False):
                cv_image = await self._apply_morphology(cv_image)

            # Convert back to PIL Image
            rgb_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
            processed_image = Image.fromarray(rgb_image)

            return processed_image

        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}", exc_info=True)
            return image

    async def _deskew_image(self, image: np.ndarray) -> np.ndarray:
        """Correct skew in the image"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = cv2.bitwise_not(gray)

            # Detect lines using HoughLinesP
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=100, maxLineGap=10)

            if lines is not None:
                angles = []
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
                    angles.append(angle)

                # Calculate median angle
                median_angle = np.median(angles)

                # Rotate image to correct skew
                if abs(median_angle) > 0.5:  # Only rotate if significant skew
                    (h, w) = image.shape[:2]
                    center = (w // 2, h // 2)
                    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                    image = cv2.warpAffine(image, rotation_matrix, (w, h),
                                         flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

            return image

        except Exception as e:
            logger.error(f"Error deskewing image: {str(e)}")
            return image

    async def _enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Enhance image contrast"""
        try:
            # Convert to LAB color space
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)

            # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)

            # Merge channels and convert back
            lab = cv2.merge([l, a, b])
            image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

            return image

        except Exception as e:
            logger.error(f"Error enhancing contrast: {str(e)}")
            return image

    async def _enhance_resolution(self, image: np.ndarray) -> np.ndarray:
        """Enhance image resolution for better OCR"""
        try:
            # Upscale image by 2x using cubic interpolation
            height, width = image.shape[:2]
            new_height, new_width = height * 2, width * 2

            enhanced = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)

            # Apply sharpening kernel
            sharpening_kernel = np.array([[-1, -1, -1],
                                        [-1,  9, -1],
                                        [-1, -1, -1]])
            enhanced = cv2.filter2D(enhanced, -1, sharpening_kernel)

            return enhanced

        except Exception as e:
            logger.error(f"Error enhancing resolution: {str(e)}")
            return image

    async def _apply_morphology(self, image: np.ndarray) -> np.ndarray:
        """Apply morphological operations to clean up the image"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Apply morphological operations to remove noise
            kernel = np.ones((1, 1), np.uint8)
            gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
            gray = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel)

            # Convert back to BGR
            image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

            return image

        except Exception as e:
            logger.error(f"Error applying morphology: {str(e)}")
            return image

    async def _reconstruct_text(self, ocr_data: Dict[str, List]) -> str:
        """Reconstruct text with proper spacing and line breaks"""
        try:
            text_lines = []
            current_line = []
            current_line_y = None

            for i in range(len(ocr_data['text'])):
                word = ocr_data['text'][i].strip()
                confidence = int(ocr_data['conf'][i])
                block_num = ocr_data['block_num'][i]
                par_num = ocr_data['par_num'][i]
                line_num = ocr_data['line_num'][i]
                word_num = ocr_data['word_num'][i]
                top = ocr_data['top'][i]

                if word and confidence > self.confidence_threshold:
                    # Check if this is a new line
                    if current_line_y is None:
                        current_line_y = top
                    elif abs(top - current_line_y) > 10:  # New line threshold
                        if current_line:
                            text_lines.append(' '.join(current_line))
                            current_line = []
                        current_line_y = top

                    current_line.append(word)

            # Add the last line
            if current_line:
                text_lines.append(' '.join(current_line))

            return '\n'.join(text_lines)

        except Exception as e:
            logger.error(f"Error reconstructing text: {str(e)}")
            return ' '.join([word for word in ocr_data['text'] if word.strip()])

    async def get_text_with_positions(self, file_path: Path) -> Dict[str, Any]:
        """
        Extract text with detailed position information

        Args:
            file_path: Path to the document file

        Returns:
            Dictionary containing text and position data
        """
        try:
            images = await self._convert_to_images(file_path)
            if not images:
                return {"success": False, "error": "Could not process file"}

            all_words = []
            for i, image in enumerate(images):
                processed_image = await self._preprocess_image(image)

                # Get word-level data
                custom_config = f'--oem 3 --psm 6 -l {self.languages}'
                word_data = pytesseract.image_to_data(
                    processed_image,
                    config=custom_config,
                    output_type=pytesseract.Output.DICT
                )

                page_words = []
                for j in range(len(word_data['text'])):
                    word = word_data['text'][j].strip()
                    confidence = int(word_data['conf'][j])

                    if word and confidence > self.confidence_threshold:
                        page_words.append({
                            'page': i + 1,
                            'word': word,
                            'confidence': confidence,
                            'bbox': {
                                'x': word_data['left'][j],
                                'y': word_data['top'][j],
                                'width': word_data['width'][j],
                                'height': word_data['height'][j]
                            },
                            'block_num': word_data['block_num'][j],
                            'par_num': word_data['par_num'][j],
                            'line_num': word_data['line_num'][j],
                            'word_num': word_data['word_num'][j]
                        })

                all_words.extend(page_words)

            return {
                "success": True,
                "words": all_words,
                "word_count": len(all_words),
                "page_count": len(images)
            }

        except Exception as e:
            logger.error(f"Error extracting text with positions: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}

    def get_tesseract_info(self) -> Dict[str, Any]:
        """Get Tesseract OCR engine information"""
        try:
            version = pytesseract.get_tesseract_version()
            languages = pytesseract.get_languages(config='')

            return {
                "version": str(version),
                "available_languages": languages,
                "configured_languages": self.languages.split('+'),
                "tesseract_path": self.tesseract_path,
                "dpi": self.dpi,
                "confidence_threshold": self.confidence_threshold
            }

        except Exception as e:
            logger.error(f"Error getting Tesseract info: {str(e)}")
            return {
                "version": "unknown",
                "available_languages": [],
                "configured_languages": self.languages.split('+'),
                "error": str(e)
            }