import requests
import sys
import json
from datetime import datetime, timezone, timedelta

class AdditionalBirdieoAPITester:
    def __init__(self, base_url="https://golf-birdieo.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.round_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def setup_auth(self):
        """Setup authentication for testing"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "name": f"Test User {timestamp}",
            "email": f"testuser{timestamp}@birdieo.com",
            "password": "TestPass123!"
        }
        
        # Register user
        response = requests.post(f"{self.base_url}/auth/register", json=test_data)
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            self.user_id = data['user']['id']
            
            # Create a round for testing
            tee_time = datetime.now(timezone.utc) + timedelta(days=1)
            checkin_data = {
                "tee_time": tee_time.isoformat(),
                "course_id": "pebble_beach",
                "course_name": "Pebble Beach Golf Links",
                "handedness": "right"
            }
            
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            response = requests.post(f"{self.base_url}/checkin", json=checkin_data, headers=headers)
            if response.status_code == 200:
                self.round_id = response.json()['round_id']
                return True
        return False

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_analyze_photo(self):
        """Test AI photo analysis for clothing detection"""
        # Simple 1x1 pixel PNG in base64
        test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg=="
        
        success, response = self.run_test(
            "AI Photo Analysis",
            "POST",
            "/analyze-photo",
            200,
            data={
                "photo_base64": test_image_b64,
                "photo_type": "front"
            }
        )
        
        if success:
            print(f"   Analysis result: {response}")
        return success

    def test_vision_detection_event(self):
        """Test logging vision detection events"""
        if not self.round_id:
            print("❌ Skipping vision detection - no round ID available")
            return False
            
        success, response = self.run_test(
            "Log Vision Detection Event",
            "POST",
            "/vision/detection-event",
            200,
            data={
                "round_id": self.round_id,
                "hole_number": 1,
                "camera_angle": "front",
                "detections": [
                    {
                        "type": "person",
                        "confidence": 0.95,
                        "bbox": [100, 100, 200, 300]
                    }
                ]
            }
        )
        return success

    def test_trigger_shot_capture(self):
        """Test triggering shot capture"""
        if not self.round_id or not self.user_id:
            print("❌ Skipping shot capture trigger - missing round or user ID")
            return False
            
        success, response = self.run_test(
            "Trigger Shot Capture",
            "POST",
            "/vision/trigger-capture",
            200,
            data={
                "round_id": self.round_id,
                "player_id": self.user_id,
                "hole_number": 1,
                "camera_angle": "front",
                "trigger_reason": "swing_detected"
            }
        )
        return success

    def test_get_vision_events(self):
        """Test getting vision events for a round"""
        if not self.round_id:
            print("❌ Skipping vision events - no round ID available")
            return False
            
        success, response = self.run_test(
            "Get Vision Events",
            "GET",
            f"/vision/events/{self.round_id}",
            200
        )
        
        if success:
            print(f"   Found {len(response)} vision events")
        return success

    def test_pebble_beach_stream(self):
        """Test Pebble Beach live stream endpoint"""
        success, response = self.run_test(
            "Get Pebble Beach Stream",
            "GET",
            "/video/pebble-beach-stream",
            200
        )
        
        if success:
            print(f"   Stream info: {response.get('camera_name', 'N/A')}")
        return success

    def test_verify_clothing(self):
        """Test clothing verification endpoint"""
        if not self.round_id:
            print("❌ Skipping clothing verification - no round ID available")
            return False
            
        success, response = self.run_test(
            "Verify Clothing",
            "POST",
            "/verify-clothing",
            200,
            data={
                "round_id": self.round_id,
                "clothing_descriptor": {
                    "top_color": "blue",
                    "top_style": "polo",
                    "bottom_color": "khaki",
                    "hat_color": "white",
                    "shoes_color": "white",
                    "handedness": "right"
                },
                "confirmed": True
            }
        )
        return success

def main():
    print("🔍 Testing Additional Birdieo API Endpoints...")
    print("=" * 50)
    
    tester = AdditionalBirdieoAPITester()
    
    # Setup authentication
    if not tester.setup_auth():
        print("❌ Failed to setup authentication")
        return 1
    
    print("✅ Authentication setup successful")
    
    # Test additional endpoints
    test_results = []
    
    print("\n🤖 AI & VISION TESTS")
    print("-" * 30)
    test_results.append(("AI Photo Analysis", tester.test_analyze_photo()))
    test_results.append(("Vision Detection Event", tester.test_vision_detection_event()))
    test_results.append(("Trigger Shot Capture", tester.test_trigger_shot_capture()))
    test_results.append(("Get Vision Events", tester.test_get_vision_events()))
    test_results.append(("Verify Clothing", tester.test_verify_clothing()))
    
    print("\n📹 STREAMING TESTS")
    print("-" * 30)
    test_results.append(("Pebble Beach Stream", tester.test_pebble_beach_stream()))
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 ADDITIONAL TEST RESULTS")
    print("=" * 50)
    
    passed_tests = []
    failed_tests = []
    
    for test_name, result in test_results:
        if result:
            passed_tests.append(test_name)
            print(f"✅ {test_name}")
        else:
            failed_tests.append(test_name)
            print(f"❌ {test_name}")
    
    print(f"\n📈 Summary: {len(passed_tests)}/{len(test_results)} additional tests passed")
    
    if failed_tests:
        print(f"\n🚨 Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
        return 1
    else:
        print("\n🎉 All additional tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())