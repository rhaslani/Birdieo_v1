import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Camera, X, RotateCcw, Check, AlertTriangle, Settings, User, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

// Silhouette SVG components for user guidance
const FaceSilhouette = () => (
  <svg viewBox="0 0 200 200" className="w-96 h-96 text-emerald-300 opacity-80">
    <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="8,8"/>
    <circle cx="100" cy="80" r="40" fill="none" stroke="currentColor" strokeWidth="3"/>
    <circle cx="85" cy="70" r="6" fill="currentColor"/>
    <circle cx="115" cy="70" r="6" fill="currentColor"/>
    <path d="M85 90 Q100 105 115 90" fill="none" stroke="currentColor" strokeWidth="3"/>
    <text x="100" y="180" textAnchor="middle" className="text-sm fill-current font-bold">Face Photo</text>
  </svg>
);

const FrontSilhouette = () => (
  <svg viewBox="0 0 200 200" className="w-96 h-96 text-emerald-300 opacity-80">
    <rect x="70" y="40" width="60" height="120" rx="30" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="8,8"/>
    <circle cx="100" cy="60" r="15" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="85" y="80" width="30" height="40" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="75" y="125" width="20" height="35" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="105" y="125" width="20" height="35" fill="none" stroke="currentColor" strokeWidth="3"/>
    <text x="100" y="180" textAnchor="middle" className="text-sm fill-current font-bold">Front View</text>
  </svg>
);

const SideSilhouette = () => (
  <svg viewBox="0 0 200 200" className="w-96 h-96 text-emerald-300 opacity-80">
    <path d="M80 40 Q90 45 90 60 L90 120 Q85 140 85 160" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="8,8"/>
    <circle cx="85" cy="60" r="12" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="85" y="80" width="25" height="35" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="85" y="120" width="15" height="40" fill="none" stroke="currentColor" strokeWidth="3"/>
    <text x="100" y="180" textAnchor="middle" className="text-sm fill-current font-bold">Side Profile</text>
  </svg>
);

const BackSilhouette = () => (
  <svg viewBox="0 0 200 200" className="w-96 h-96 text-emerald-300 opacity-80">
    <rect x="70" y="40" width="60" height="120" rx="30" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="8,8"/>
    <circle cx="100" cy="60" r="15" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="85" y="80" width="30" height="40" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="75" y="125" width="20" height="35" fill="none" stroke="currentColor" strokeWidth="3"/>
    <rect x="105" y="125" width="20" height="35" fill="none" stroke="currentColor" strokeWidth="3"/>
    <text x="100" y="180" textAnchor="middle" className="text-sm fill-current font-bold">Back View</text>
  </svg>
);

const getSilhouetteComponent = (photoType) => {
  switch (photoType) {
    case 'face': return <FaceSilhouette />;
    case 'front': return <FrontSilhouette />;
    case 'side': return <SideSilhouette />;
    case 'back': return <BackSilhouette />;
    default: return <FaceSilhouette />;
  }
};

export const EnhancedCameraCapture = ({ isOpen, onClose, onCapture, photoType, roundId }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt');
  const [facingMode, setFacingMode] = useState('user');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSilhouette, setShowSilhouette] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      checkCameraPermission();
      // Keep silhouette visible - don't auto-hide
      setShowSilhouette(true);
    } else {
      stopCamera();
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
    }
    
    return () => {
      stopCamera();
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && permissionState === 'granted') {
      startCamera();
    }
  }, [facingMode, permissionState, isOpen]);

  const checkCameraPermission = async () => {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' });
        setPermissionState(permission.state);
        
        if (permission.state === 'granted') {
          startCamera();
        }
        
        permission.onchange = () => {
          setPermissionState(permission.state);
          if (permission.state === 'granted') {
            startCamera();
          } else {
            stopCamera();
          }
        };
      } else {
        startCamera();
      }
    } catch (err) {
      console.error('Error checking camera permission:', err);
      startCamera();
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.');
      }

      // Try with high quality first, fallback to basic if needed
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready - extend timeout to prevent 5-second error
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Video load timeout')), 20000); // Increased to 20 seconds
          
          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            resolve();
          };
          
          videoRef.current.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Video failed to load'));
          };
        });
        
        await videoRef.current.play();
        setIsStreaming(true);
        setPermissionState('granted');
        toast.success('Camera started successfully');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setIsStreaming(false);
      
      // Only show errors that are actually actionable, not timeout errors during loading
      if (err.message !== 'Video load timeout') {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionState('denied');
          setError('Camera permission denied. Please allow camera access to take photos.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found on this device. Please check your camera connection.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is being used by another application. Please close other apps using the camera.');
        } else if (err.name === 'OverconstrainedError') {
          setError('Camera configuration not supported. Trying with basic settings...');
          retryWithBasicConstraints();
        } else {
          setError(err.message || 'Failed to access camera. Please check your camera and permissions.');
        }
      }
    }
  };

  const retryWithBasicConstraints = async () => {
    try {
      const basicConstraints = {
        video: { facingMode: facingMode },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setError(null);
        toast.success('Camera started with basic settings');
      }
    } catch (err) {
      setError('Unable to access camera with current settings.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    setIsStreaming(false);
    setCapturedImage(null);
  };

  const startCountdown = () => {
    if (isCountingDown) return;
    
    setIsCountingDown(true);
    setCountdown(5);
    
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setIsCountingDown(false);
          // Actually capture the photo after countdown
          setTimeout(() => captureActualPhoto(), 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const captureActualPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 with high quality
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    
    // Add camera shutter effect
    if (videoRef.current) {
      videoRef.current.style.filter = 'brightness(2)';
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.style.filter = 'brightness(1)';
        }
      }, 150);
    }
    
    toast.success('Photo captured successfully!');
  };

  const capturePhoto = () => {
    startCountdown();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowSilhouette(true);
    setCountdown(0);
    setIsCountingDown(false);
  };

  const confirmPhoto = async () => {
    if (!capturedImage) return;
    
    setIsProcessing(true);
    try {
      // Process and save the photo
      await processAndSavePhoto(capturedImage, photoType, roundId);
      
      // Call the original onCapture callback
      onCapture(capturedImage);
      setCapturedImage(null);
      onClose();
      
      toast.success(`${photoType.charAt(0).toUpperCase() + photoType.slice(1)} photo saved and processed successfully!`);
    } catch (error) {
      console.error('Error processing photo:', error);
      toast.error('Failed to process photo. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process and save photo with AI analysis
  const processAndSavePhoto = async (imageData, type, roundId) => {
    try {
      // Clean base64 data
      const base64Data = imageData.split(',')[1];
      
      // Save photo to backend
      const saveResponse = await fetch('/api/photos/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('birdieo_token')}`
        },
        body: JSON.stringify({
          photo_data: base64Data,
          photo_type: type,
          round_id: roundId,
          timestamp: new Date().toISOString()
        })
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save photo');
      }

      // If it's a clothing photo (front, side, back), analyze with AI
      if (type !== 'face') {
        const analysisResponse = await fetch('/api/analyze-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('birdieo_token')}`
          },
          body: JSON.stringify({
            photo_base64: base64Data,
            photo_type: type
          })
        });

        if (analysisResponse.ok) {
          const analysis = await analysisResponse.json();
          console.log(`${type} photo analysis:`, analysis);
          
          // Store analysis results
          await fetch('/api/photos/analysis', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('birdieo_token')}`
            },
            body: JSON.stringify({
              round_id: roundId,
              photo_type: type,
              analysis_results: analysis
            })
          });
        }
      }
    } catch (error) {
      console.error('Error in processAndSavePhoto:', error);
      throw error;
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setCapturedImage(null);
  };

  const requestPermissionAgain = () => {
    setError(null);
    setPermissionState('prompt');
    startCamera();
  };

  const getPhotoTypeInstructions = () => {
    const instructions = {
      face: 'Position your face clearly in the center of the frame for identification. Look directly at the camera.',
      front: 'Stand facing the camera to capture your full outfit from the front. Step back to show your complete attire.',
      side: 'Turn to your side to show your profile and clothing details. Stand sideways to the camera.',
      back: 'Turn around to capture your outfit from behind. Face away from the camera to show the back of your clothing.'
    };
    return instructions[photoType] || 'Position yourself for the photo';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                {photoType === 'face' ? <User className="w-5 h-5 text-emerald-600" /> : <UserCheck className="w-5 h-5 text-emerald-600" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-800 capitalize">
                  Capture {photoType} Photo
                </h3>
                <p className="text-sm text-emerald-600">
                  Step {photoType === 'face' ? '1' : photoType === 'front' ? '2' : photoType === 'side' ? '3' : '4'} of 4
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="rounded-full p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-emerald-600 text-sm mb-4">
            {getPhotoTypeInstructions()}
          </p>

          {/* Permission Denied Error - same as before but shorter */}
          {permissionState === 'denied' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-red-800 font-semibold mb-2">Camera Permission Required</h4>
                  <p className="text-red-700 text-sm mb-3">
                    Please allow camera access to take photos. Look for the camera icon in your browser's address bar.
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      onClick={requestPermissionAgain}
                      className="bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Errors */}
          {error && permissionState !== 'denied' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-orange-800 text-sm font-medium">Camera Error</p>
                  <p className="text-orange-700 text-sm mt-1 mb-2">{error}</p>
                  <Button
                    onClick={requestPermissionAgain}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    size="sm"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Camera Preview with Silhouette Overlay */}
          <div className="relative bg-black rounded-lg overflow-hidden mb-4">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-80 object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Silhouette Overlay */}
                {showSilhouette && isStreaming && !capturedImage && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black bg-opacity-20">
                    <div className="flex flex-col items-center justify-center">
                      {getSilhouetteComponent(photoType)}
                      <p className="text-white text-lg mt-4 bg-black bg-opacity-70 px-6 py-2 rounded-lg font-semibold">
                        Align yourself with the guide
                      </p>
                    </div>
                  </div>
                )}

                {/* Countdown Overlay */}
                {isCountingDown && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black bg-opacity-50">
                    <div className="text-center">
                      <div className="text-8xl font-bold text-white mb-4 animate-pulse">
                        {countdown}
                      </div>
                      <p className="text-white text-xl font-semibold">
                        Get ready for your {photoType} photo!
                      </p>
                    </div>
                  </div>
                )}
                
                {isStreaming && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                    <Button
                      onClick={() => setShowSilhouette(!showSilhouette)}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-full p-3"
                      title="Toggle Guide"
                    >
                      <UserCheck className="h-5 w-5 text-white" />
                    </Button>
                    
                    <Button
                      onClick={switchCamera}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-full p-3"
                      title="Switch Camera"
                    >
                      <RotateCcw className="h-5 w-5 text-white" />
                    </Button>
                    
                    <Button
                      onClick={capturePhoto}
                      disabled={isCountingDown}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-500 rounded-full p-4 shadow-lg"
                      title={isCountingDown ? "Taking Photo..." : "Take Photo (5s Timer)"}
                    >
                      {isCountingDown ? (
                        <span className="text-white text-lg font-bold">{countdown}</span>
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </Button>
                  </div>
                )}
                
                {!isStreaming && !error && permissionState !== 'denied' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Camera className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                      <p className="text-lg font-semibold mb-2">Starting Camera...</p>
                      <p className="text-sm opacity-75">Please wait while we access your camera</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <img 
                  src={capturedImage} 
                  alt="Captured photo"
                  className="w-full h-80 object-cover"
                />
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                  <Button
                    onClick={retakePhoto}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 py-3"
                    disabled={isProcessing}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retake
                  </Button>
                  
                  <Button
                    onClick={confirmPhoto}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 py-3"
                    disabled={isProcessing}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isProcessing ? 'Processing...' : 'Use Photo'}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Camera Info */}
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Camera: {facingMode === 'user' ? 'Front' : 'Back'}</span>
            {isStreaming ? (
              <span className="text-green-600">📹 Camera active - Ready to capture</span>
            ) : (
              <span className="text-red-600">Camera not active</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};