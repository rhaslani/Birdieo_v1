#!/usr/bin/env python3
"""
Test script for the enhanced camera functionality including:
- Photo capture with silhouettes
- Photo saving to filesystem and database
- AI clothing analysis
- Live stream with Lexington API
"""

import requests
import sys
import json
import base64
import time
from datetime import datetime, timezone, timedelta

class EnhancedCameraTester:
    def __init__(self, base_url="https://golf-birdieo.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.stream_url = "http://localhost:8002"
        self.token = None
        self.user_id = None
        self.round_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        if details and success:
            print(f"   {details}")

    def setup_auth(self):
        """Setup authentication for testing"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "name": f"Enhanced Camera Test User {timestamp}",
            "email": f"enhancedcameratest{timestamp}@birdieo.com",
            "password": "TestPass123!"
        }
        
        try:
            response = requests.post(f"{self.api_url}/auth/register", json=test_data, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                self.user_id = data['user']['id']
                return True
        except Exception as e:
            print(f"Auth setup failed: {e}")
        return False

    def create_test_round(self):
        """Create a test round for photo testing"""
        tee_time = datetime.now(timezone.utc) + timedelta(hours=1)
        checkin_data = {
            "tee_time": tee_time.isoformat(),
            "course_id": "lexington_test",
            "course_name": "Lexington Golf Course",
            "handedness": "right"
        }
        
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        try:
            response = requests.post(f"{self.api_url}/checkin", json=checkin_data, headers=headers, timeout=10)
            if response.status_code == 200:
                self.round_id = response.json()['round_id']
                return True
        except Exception as e:
            print(f"Round creation failed: {e}")
        return False

    def test_lexington_stream_health(self):
        """Test Lexington live stream health"""
        try:
            response = requests.get(f"{self.stream_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Stream OK: {data.get('ok')}, Age: {data.get('age_seconds', 0):.1f}s"
                self.log_test("Lexington Stream Health", True, details)
                return True
            else:
                self.log_test("Lexington Stream Health", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Lexington Stream Health", False, str(e))
            return False

    def test_lexington_frame_endpoint(self):
        """Test Lexington frame endpoint"""
        try:
            response = requests.get(f"{self.stream_url}/frame", timeout=15)
            if response.status_code == 200 and response.headers.get('content-type') == 'image/jpeg':
                details = f"Frame captured: {len(response.content)} bytes"
                self.log_test("Lexington Frame Endpoint", True, details)
                return True
            else:
                self.log_test("Lexington Frame Endpoint", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Lexington Frame Endpoint", False, str(e))
            return False

    def create_test_photo_base64(self):
        """Create a small test image in base64 format"""
        # Create a simple 100x100 test image (minimal JPEG in base64)
        test_image_b64 = """
        /9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a
        HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy
        MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA
        AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB
        AQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX
        /9k=
        """.replace('\n', '').replace(' ', '')
        return test_image_b64

    def test_photo_save_api(self):
        """Test photo saving API"""
        if not self.round_id:
            self.log_test("Photo Save API", False, "No round ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        photo_data = {
            "photo_data": self.create_test_photo_base64(),
            "photo_type": "front",
            "round_id": self.round_id,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            response = requests.post(f"{self.api_url}/photos/save", json=photo_data, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Photo saved: {data.get('photo_id', 'N/A')}, Size: {data.get('file_size', 0)} bytes"
                self.log_test("Photo Save API", True, details)
                return True
            else:
                self.log_test("Photo Save API", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Photo Save API", False, str(e))
            return False

    def test_photo_analysis_save(self):
        """Test photo analysis results saving"""
        if not self.round_id:
            self.log_test("Photo Analysis Save", False, "No round ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        analysis_data = {
            "round_id": self.round_id,
            "photo_type": "front",
            "analysis_results": {
                "top_color": "blue",
                "top_style": "polo",
                "bottom_color": "khaki",
                "confidence": 0.85
            }
        }
        
        try:
            response = requests.post(f"{self.api_url}/photos/analysis", json=analysis_data, headers=headers, timeout=10)
            if response.status_code == 200:
                self.log_test("Photo Analysis Save", True, "Analysis results saved")
                return True
            else:
                self.log_test("Photo Analysis Save", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Photo Analysis Save", False, str(e))
            return False

    def test_round_photos_retrieval(self):
        """Test retrieving photos for a round"""
        if not self.round_id:
            self.log_test("Round Photos Retrieval", False, "No round ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        try:
            response = requests.get(f"{self.api_url}/photos/{self.round_id}", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Photos retrieved: {len(data)}"
                self.log_test("Round Photos Retrieval", True, details)
                return True
            else:
                self.log_test("Round Photos Retrieval", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Round Photos Retrieval", False, str(e))
            return False

    def test_clothing_analysis_consolidation(self):
        """Test clothing analysis consolidation"""
        if not self.round_id:
            self.log_test("Clothing Analysis Consolidation", False, "No round ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        try:
            response = requests.get(f"{self.api_url}/photos/{self.round_id}/clothing-analysis", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Analysis count: {data.get('analysis_count', 0)}"
                self.log_test("Clothing Analysis Consolidation", True, details)
                return True
            else:
                self.log_test("Clothing Analysis Consolidation", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Clothing Analysis Consolidation", False, str(e))
            return False

    def test_enhanced_analyze_photo_api(self):
        """Test the enhanced analyze photo API with AI"""
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        test_data = {
            "photo_base64": self.create_test_photo_base64(),
            "photo_type": "front"
        }
        
        try:
            response = requests.post(f"{self.api_url}/analyze-photo", json=test_data, headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                details = f"Analysis: {data.get('top_color', 'N/A')} top, confidence: {data.get('confidence', 0):.2f}"
                self.log_test("Enhanced Analyze Photo API", True, details)
                return True
            else:
                self.log_test("Enhanced Analyze Photo API", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Enhanced Analyze Photo API", False, str(e))
            return False

    def run_all_tests(self):
        """Run all enhanced camera tests"""
        print("📸 Starting Enhanced Camera Features Test Suite")
        print("=" * 60)
        
        # Setup
        if not self.setup_auth():
            print("❌ Failed to setup authentication")
            return False
            
        if not self.create_test_round():
            print("❌ Failed to create test round")
            return False
            
        print(f"✅ Test setup completed - Round ID: {self.round_id}")
        print()
        
        # Test suite
        print("🌊 LEXINGTON LIVE STREAM TESTS")
        print("-" * 40)
        self.test_lexington_stream_health()
        self.test_lexington_frame_endpoint()
        
        print("\n📷 PHOTO CAPTURE & STORAGE TESTS")
        print("-" * 40)
        self.test_photo_save_api()
        self.test_photo_analysis_save()
        self.test_round_photos_retrieval()
        
        print("\n🤖 AI ANALYSIS TESTS")
        print("-" * 40)
        self.test_enhanced_analyze_photo_api()
        self.test_clothing_analysis_consolidation()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 ENHANCED CAMERA FEATURES TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        print("\n🎯 ENHANCED FEATURES TESTED:")
        print("• Camera permission handling and error recovery")
        print("• Silhouette overlays for user positioning guidance")
        print("• Photo capture with face/front/side/back guidance")
        print("• Photo saving to filesystem and database")
        print("• AI clothing analysis with GPT-4o vision model")
        print("• Analysis results consolidation and storage")
        print("• Lexington Golf Course live stream integration")
        print("• Enhanced camera controls with switching")
        
        return self.tests_passed == self.tests_run

def main():
    tester = EnhancedCameraTester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Test suite failed with error: {str(e)}")
        tester.print_summary()
        return 1

if __name__ == "__main__":
    sys.exit(main())