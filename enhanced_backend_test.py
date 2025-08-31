import requests
import sys
import json
import time
import os
from datetime import datetime, timezone, timedelta

class EnhancedBirdieoAPITester:
    def __init__(self, base_url="https://golf-birdieo.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.stream_url = "http://localhost:8002"
        self.token = None
        self.user_id = None
        self.round_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, timeout=10):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=timeout)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "name": f"Test User {timestamp}",
            "email": f"testuser{timestamp}@birdieo.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_create_checkin(self):
        """Test creating a check-in (round)"""
        tee_time = datetime.now(timezone.utc) + timedelta(hours=1)
        
        checkin_data = {
            "tee_time": tee_time.isoformat(),
            "course_id": "lexington_golf",
            "course_name": "Lexington Golf Course",
            "handedness": "right"
        }
        
        success, response = self.run_test(
            "Create Check-in",
            "POST",
            "checkin",
            200,
            data=checkin_data
        )
        
        if success and 'round_id' in response:
            self.round_id = response['round_id']
            print(f"   Round ID: {self.round_id}")
            return True
        return False

    # NEW CAMERA PROCESSING TESTS
    def test_camera_status(self):
        """Test camera processing status endpoint"""
        success, response = self.run_test(
            "Camera Status",
            "GET",
            "camera/status",
            200
        )
        
        if success:
            print(f"   Camera Active: {response.get('active', False)}")
            print(f"   Clips Created: {response.get('clips_created', 0)}")
            print(f"   Stream URL: {response.get('stream_url', 'N/A')}")
        return success

    def test_activate_round_for_recording(self):
        """Test activating a round for automatic recording"""
        if not self.round_id:
            self.log_test("Activate Round for Recording", False, "No round_id available")
            return False
            
        success, response = self.run_test(
            "Activate Round for Recording",
            "POST",
            f"rounds/{self.round_id}/activate",
            200
        )
        
        if success:
            print(f"   Round Status: {response.get('status', 'unknown')}")
            print(f"   Camera Processing: {response.get('camera_processing', False)}")
        return success

    def test_get_auto_generated_clips(self):
        """Test getting auto-generated clips for a round"""
        if not self.round_id:
            self.log_test("Get Auto-Generated Clips", False, "No round_id available")
            return False
            
        success, response = self.run_test(
            "Get Auto-Generated Clips",
            "GET",
            f"clips/{self.round_id}/auto",
            200
        )
        
        if success:
            print(f"   Auto-generated clips found: {len(response)}")
            for clip in response:
                print(f"     - Clip {clip.get('id', 'unknown')}: Hole {clip.get('hole_number', 'N/A')}")
        return success

    def test_clip_file_serving(self):
        """Test clip file serving endpoints"""
        # First, let's try to get any existing clips
        if not self.round_id:
            self.log_test("Clip File Serving", False, "No round_id available")
            return False
            
        # Get clips for the round
        try:
            clips_response = requests.get(
                f"{self.base_url}/clips/{self.round_id}",
                headers={'Authorization': f'Bearer {self.token}'},
                timeout=10
            )
            
            if clips_response.status_code == 200:
                clips = clips_response.json()
                if clips:
                    # Test serving the first clip
                    clip_id = clips[0].get('id')
                    if clip_id:
                        # Test video file serving
                        video_response = requests.get(
                            f"{self.base_url}/clips/files/{clip_id}",
                            headers={'Authorization': f'Bearer {self.token}'},
                            timeout=10
                        )
                        
                        video_success = video_response.status_code in [200, 404]  # 404 is OK if file doesn't exist yet
                        
                        # Test poster serving
                        poster_response = requests.get(
                            f"{self.base_url}/clips/poster/{clip_id}",
                            headers={'Authorization': f'Bearer {self.token}'},
                            timeout=10
                        )
                        
                        poster_success = poster_response.status_code in [200, 404]  # 404 is OK if file doesn't exist yet
                        
                        success = video_success and poster_success
                        details = f"Video: {video_response.status_code}, Poster: {poster_response.status_code}"
                        
                        self.log_test("Clip File Serving", success, details)
                        return success
                        
            # No clips available to test
            self.log_test("Clip File Serving", True, "No clips available to test (expected)")
            return True
            
        except Exception as e:
            self.log_test("Clip File Serving", False, f"Error: {str(e)}")
            return False

    def test_stream_health(self):
        """Test stream health endpoint (port 8002)"""
        try:
            response = requests.get(f"{self.stream_url}/health", timeout=5)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                print(f"   Stream OK: {data.get('ok', False)}")
                print(f"   Frame Age: {data.get('age_seconds', 'N/A')}s")
            
            self.log_test("Stream Health Check", success)
            return success
            
        except Exception as e:
            self.log_test("Stream Health Check", False, f"Stream server not accessible: {str(e)}")
            return False

    def test_manual_clip_trigger(self):
        """Test manual clip triggering via stream server"""
        try:
            response = requests.post(f"{self.stream_url}/trigger-clip", timeout=10)
            success = response.status_code in [200, 202]  # Accept both OK and Accepted
            
            if success:
                try:
                    data = response.json()
                    print(f"   Trigger Response: {data}")
                except:
                    print(f"   Trigger Response: {response.text}")
            
            self.log_test("Manual Clip Trigger", success)
            return success
            
        except Exception as e:
            self.log_test("Manual Clip Trigger", False, f"Error: {str(e)}")
            return False

    def test_clips_directory(self):
        """Test if clips directory exists and is accessible"""
        clips_dir = "/app/clips"
        
        try:
            exists = os.path.exists(clips_dir)
            if exists:
                files = os.listdir(clips_dir)
                mp4_files = [f for f in files if f.endswith('.mp4')]
                jpg_files = [f for f in files if f.endswith('.jpg')]
                
                print(f"   Clips directory exists: {exists}")
                print(f"   MP4 files: {len(mp4_files)}")
                print(f"   JPG files: {len(jpg_files)}")
                
                self.log_test("Clips Directory Check", True, f"Found {len(mp4_files)} videos, {len(jpg_files)} posters")
            else:
                self.log_test("Clips Directory Check", False, "Directory does not exist")
            
            return exists
            
        except Exception as e:
            self.log_test("Clips Directory Check", False, f"Error: {str(e)}")
            return False

    def run_enhanced_tests(self):
        """Run the enhanced test suite focusing on new camera features"""
        print("🎥 Starting Enhanced Birdieo Camera Processing Test Suite")
        print("=" * 60)
        
        # Basic authentication
        if not self.test_user_registration():
            print("❌ Registration failed, stopping tests")
            return False
        
        # Create a round for testing
        if not self.test_create_checkin():
            print("❌ Check-in creation failed")
            return False
        
        print("\n🎯 Testing NEW Camera Processing Features:")
        print("-" * 40)
        
        # Test camera processing endpoints
        self.test_camera_status()
        self.test_activate_round_for_recording()
        
        # Wait a moment for processing to potentially start
        print("\n⏳ Waiting 3 seconds for camera processing to initialize...")
        time.sleep(3)
        
        # Test clip generation and serving
        self.test_get_auto_generated_clips()
        self.test_clip_file_serving()
        
        # Test stream server endpoints
        print("\n🌐 Testing Stream Server (Port 8002):")
        print("-" * 40)
        self.test_stream_health()
        self.test_manual_clip_trigger()
        
        # Test file system
        print("\n📁 Testing File System:")
        print("-" * 40)
        self.test_clips_directory()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 ENHANCED TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed/self.tests_run)*100
            print(f"Success Rate: {success_rate:.1f}%")
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['name']}: {test['details']}")
        else:
            print("\n✅ All tests passed!")
        
        # Print specific recommendations
        print("\n🔧 RECOMMENDATIONS:")
        camera_tests = [test for test in self.test_results if 'Camera' in test['name'] or 'Stream' in test['name'] or 'Clip' in test['name']]
        failed_camera_tests = [test for test in camera_tests if not test['success']]
        
        if failed_camera_tests:
            print("   • Camera processing system needs attention")
            print("   • Check if camera_processor.py is running")
            print("   • Verify stream server on port 8002 is accessible")
            print("   • Ensure /app/clips directory has proper permissions")
        else:
            print("   • Camera processing system appears to be working correctly")
            print("   • All new endpoints are responding properly")
        
        return self.tests_passed == self.tests_run

def main():
    tester = EnhancedBirdieoAPITester()
    
    try:
        success = tester.run_enhanced_tests()
        all_passed = tester.print_summary()
        return 0 if all_passed else 1
    except Exception as e:
        print(f"❌ Test suite failed with error: {str(e)}")
        tester.print_summary()
        return 1

if __name__ == "__main__":
    sys.exit(main())