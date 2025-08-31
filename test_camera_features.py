#!/usr/bin/env python3
"""
Test script for the enhanced camera features including:
- Live stream processing
- Shot detection
- Automatic 10-second clip generation for hole 1
- Camera control APIs
"""

import requests
import sys
import json
import time
from datetime import datetime, timezone, timedelta

class CameraFeaturesTester:
    def __init__(self, base_url="https://golf-birdieo.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.stream_url = f"{base_url}:8002"
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
            "name": f"Camera Test User {timestamp}",
            "email": f"cameratest{timestamp}@birdieo.com",
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
        """Create a test round for camera testing"""
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

    def test_enhanced_stream_health(self):
        """Test enhanced live stream health endpoint"""
        try:
            response = requests.get(f"{self.stream_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Stream OK: {data.get('ok')}, Camera Processing: {data.get('camera_processing')}"
                features = data.get('features', [])
                if 'shot_detection' in features and 'auto_clip_generation' in features:
                    self.log_test("Enhanced Stream Health", True, details)
                    return True
                else:
                    self.log_test("Enhanced Stream Health", False, "Missing expected features")
                    return False
            else:
                self.log_test("Enhanced Stream Health", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Enhanced Stream Health", False, str(e))
            return False

    def test_stream_frame_endpoint(self):
        """Test stream frame endpoint"""
        try:
            response = requests.get(f"{self.stream_url}/frame", timeout=15)
            if response.status_code == 200 and response.headers.get('content-type') == 'image/jpeg':
                self.log_test("Stream Frame Endpoint", True, f"Frame size: {len(response.content)} bytes")
                return True
            else:
                self.log_test("Stream Frame Endpoint", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Stream Frame Endpoint", False, str(e))
            return False

    def test_camera_status_api(self):
        """Test camera status API endpoint"""
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        try:
            response = requests.get(f"{self.api_url}/camera/status", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Active: {data.get('active')}, Clips: {data.get('clips_created', 0)}"
                self.log_test("Camera Status API", True, details)
                return True
            else:
                self.log_test("Camera Status API", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Camera Status API", False, str(e))
            return False

    def test_round_activation(self):
        """Test round activation for recording"""
        if not self.round_id:
            self.log_test("Round Activation", False, "No round ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        try:
            response = requests.post(f"{self.api_url}/rounds/{self.round_id}/activate", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Status: {data.get('status')}, Camera Processing: {data.get('camera_processing')}"
                self.log_test("Round Activation", True, details)
                return True
            else:
                self.log_test("Round Activation", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Round Activation", False, str(e))
            return False

    def test_manual_clip_trigger(self):
        """Test manual clip generation trigger"""
        try:
            response = requests.post(f"{self.stream_url}/trigger-clip", timeout=15)
            if response.status_code == 200:
                data = response.json()
                details = f"Frames: {data.get('frame_count', 0)}"
                self.log_test("Manual Clip Trigger", True, details)
                return True
            else:
                self.log_test("Manual Clip Trigger", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Manual Clip Trigger", False, str(e))
            return False

    def test_clip_stats(self):
        """Test clip statistics endpoint"""
        try:
            response = requests.get(f"{self.stream_url}/clips/stats", timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Total clips: {data.get('total_clips', 0)}"
                self.log_test("Clip Statistics", True, details)
                return True
            else:
                self.log_test("Clip Statistics", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Clip Statistics", False, str(e))
            return False

    def test_auto_clips_api(self):
        """Test auto-generated clips API"""
        if not self.round_id:
            self.log_test("Auto Clips API", False, "No round ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        try:
            response = requests.get(f"{self.api_url}/clips/{self.round_id}/auto", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                details = f"Auto clips found: {len(data)}"
                self.log_test("Auto Clips API", True, details)
                return True
            else:
                self.log_test("Auto Clips API", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Auto Clips API", False, str(e))
            return False

    def run_all_tests(self):
        """Run all camera feature tests"""
        print("🎥 Starting Enhanced Camera Features Test Suite")
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
        print("📡 STREAM FUNCTIONALITY TESTS")
        print("-" * 40)
        self.test_enhanced_stream_health()
        self.test_stream_frame_endpoint()
        self.test_clip_stats()
        
        print("\n🎬 CAMERA PROCESSING TESTS")
        print("-" * 40)
        self.test_camera_status_api()
        self.test_round_activation()
        self.test_manual_clip_trigger()
        
        print("\n📂 CLIP MANAGEMENT TESTS")
        print("-" * 40)
        self.test_auto_clips_api()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 CAMERA FEATURES TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        print("\n🎯 NEW FEATURES TESTED:")
        print("• Enhanced live stream with shot detection")
        print("• Automatic 10-second clip generation for hole 1")
        print("• Camera processing control APIs")
        print("• Round activation for recording")
        print("• Manual clip triggering")
        print("• Auto-generated clips retrieval")
        print("• Real-time stream health monitoring")
        
        return self.tests_passed == self.tests_run

def main():
    tester = CameraFeaturesTester()
    
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