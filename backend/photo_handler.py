import os
import base64
import uuid
from datetime import datetime, timezone
from pathlib import Path
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

class PhotoHandler:
    """Handle photo saving, processing, and AI analysis"""
    
    def __init__(self):
        # MongoDB connection
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[os.environ.get('DB_NAME', 'birdieo_db')]
        
        # Create photos directory
        self.photos_dir = Path('/app/photos')
        self.photos_dir.mkdir(exist_ok=True)
        
        # Create subdirectories for each photo type
        for photo_type in ['face', 'front', 'side', 'back']:
            (self.photos_dir / photo_type).mkdir(exist_ok=True)
    
    async def save_photo(self, photo_data: str, photo_type: str, round_id: str, user_id: str) -> dict:
        """Save photo to filesystem and database"""
        try:
            # Generate unique photo ID
            photo_id = str(uuid.uuid4())
            
            # Decode base64 image
            image_data = base64.b64decode(photo_data)
            
            # Save to filesystem
            file_path = self.photos_dir / photo_type / f"{photo_id}.jpg"
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            # Create photo record
            photo_record = {
                "id": photo_id,
                "round_id": round_id,
                "user_id": user_id,
                "photo_type": photo_type,
                "file_path": str(file_path),
                "file_size": len(image_data),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "processed": False,
                "analysis_results": None
            }
            
            # Save to database
            await self.db.photos.insert_one(photo_record)
            
            logger.info(f"Photo saved: {photo_id} ({photo_type}) for round {round_id}")
            
            return {
                "photo_id": photo_id,
                "file_path": str(file_path),
                "file_size": len(image_data),
                "message": f"{photo_type.capitalize()} photo saved successfully"
            }
            
        except Exception as e:
            logger.error(f"Error saving photo: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save photo: {str(e)}")
    
    async def save_analysis_results(self, round_id: str, photo_type: str, analysis_results: dict) -> dict:
        """Save AI analysis results for a photo"""
        try:
            # Update photo record with analysis results
            result = await self.db.photos.update_one(
                {"round_id": round_id, "photo_type": photo_type},
                {
                    "$set": {
                        "analysis_results": analysis_results,
                        "processed": True,
                        "analyzed_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Analysis results saved for {photo_type} photo in round {round_id}")
                return {"message": "Analysis results saved successfully"}
            else:
                logger.warning(f"No photo found to update analysis for round {round_id}, type {photo_type}")
                return {"message": "Photo not found for analysis update"}
                
        except Exception as e:
            logger.error(f"Error saving analysis results: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save analysis: {str(e)}")
    
    async def get_round_photos(self, round_id: str, user_id: str) -> list:
        """Get all photos for a specific round"""
        try:
            cursor = self.db.photos.find({"round_id": round_id, "user_id": user_id})
            photos = await cursor.to_list(length=None)
            
            # Remove MongoDB _id field and convert dates
            result = []
            for photo in photos:
                photo.pop('_id', None)
                result.append(photo)
            
            return result
            
        except Exception as e:
            logger.error(f"Error retrieving photos: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve photos: {str(e)}")
    
    async def get_clothing_analysis_summary(self, round_id: str) -> dict:
        """Get consolidated clothing analysis from all clothing photos"""
        try:
            # Get analysis results for front, side, and back photos
            clothing_photos = await self.db.photos.find({
                "round_id": round_id,
                "photo_type": {"$in": ["front", "side", "back"]},
                "processed": True
            }).to_list(length=None)
            
            if not clothing_photos:
                return {"message": "No clothing analysis available"}
            
            # Consolidate analysis results
            consolidated_analysis = {
                "top_color": None,
                "top_style": None,
                "bottom_color": None,
                "hat_color": None,
                "shoes_color": None,
                "confidence": 0.0,
                "analysis_count": len(clothing_photos),
                "photos_analyzed": []
            }
            
            total_confidence = 0.0
            color_votes = {}
            style_votes = {}
            
            for photo in clothing_photos:
                analysis = photo.get('analysis_results', {})
                if analysis:
                    consolidated_analysis["photos_analyzed"].append(photo['photo_type'])
                    
                    # Vote-based consolidation for more accuracy
                    for key in ['top_color', 'top_style', 'bottom_color', 'hat_color', 'shoes_color']:
                        value = analysis.get(key)
                        if value and value != 'none':
                            if key not in color_votes:
                                color_votes[key] = {}
                            if value not in color_votes[key]:
                                color_votes[key][value] = 0
                            color_votes[key][value] += 1
                    
                    total_confidence += analysis.get('confidence', 0.0)
            
            # Determine final values based on votes
            for key, votes in color_votes.items():
                if votes:
                    most_common = max(votes.items(), key=lambda x: x[1])
                    consolidated_analysis[key] = most_common[0]
            
            consolidated_analysis["confidence"] = total_confidence / len(clothing_photos) if clothing_photos else 0.0
            
            return consolidated_analysis
            
        except Exception as e:
            logger.error(f"Error consolidating clothing analysis: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to consolidate analysis: {str(e)}")
    
    async def cleanup_old_photos(self, days_old: int = 30):
        """Clean up photos older than specified days"""
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            
            # Find old photos
            old_photos = await self.db.photos.find({
                "created_at": {"$lt": cutoff_date.isoformat()}
            }).to_list(length=None)
            
            deleted_count = 0
            for photo in old_photos:
                try:
                    # Delete file from filesystem
                    file_path = Path(photo['file_path'])
                    if file_path.exists():
                        file_path.unlink()
                    
                    # Delete from database
                    await self.db.photos.delete_one({"id": photo['id']})
                    deleted_count += 1
                    
                except Exception as e:
                    logger.error(f"Error deleting photo {photo['id']}: {e}")
            
            logger.info(f"Cleaned up {deleted_count} old photos")
            return {"deleted_count": deleted_count}
            
        except Exception as e:
            logger.error(f"Error in cleanup: {e}")
            return {"error": str(e)}

# Global photo handler instance
photo_handler = PhotoHandler()

def get_photo_handler() -> PhotoHandler:
    """Get the global photo handler instance"""
    return photo_handler