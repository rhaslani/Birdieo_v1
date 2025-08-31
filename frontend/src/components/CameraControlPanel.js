import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Camera, Play, Square, Activity, Settings, Zap } from 'lucide-react';
import { useAuth } from '../App';
import { toast } from 'sonner';

export const CameraControlPanel = () => {
  const { apiRequest, user } = useAuth();
  const [cameraStatus, setCameraStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamStats, setStreamStats] = useState(null);

  useEffect(() => {
    getCameraStatus();
    getStreamStats();
    
    // Set up periodic status updates
    const interval = setInterval(() => {
      getCameraStatus();
      getStreamStats();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getCameraStatus = async () => {
    const result = await apiRequest('GET', '/camera/status');
    if (result.success) {
      setCameraStatus(result.data);
    }
  };

  const getStreamStats = async () => {
    try {
      const response = await fetch('https://golf-birdieo.preview.emergentagent.com:8002/clips/stats');
      const data = await response.json();
      setStreamStats(data);
    } catch (error) {
      console.error('Failed to get stream stats:', error);
    }
  };

  const startCameraProcessing = async () => {
    setLoading(true);
    const result = await apiRequest('POST', '/camera/start');
    if (result.success) {
      toast.success('Camera processing started successfully');
      getCameraStatus();
    }
    setLoading(false);
  };

  const stopCameraProcessing = async () => {
    setLoading(true);
    const result = await apiRequest('POST', '/camera/stop');
    if (result.success) {
      toast.success('Camera processing stopped');
      getCameraStatus();
    }
    setLoading(false);
  };

  const canControlCamera = user?.role === 'admin' || user?.role === 'course_manager';

  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 0) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Camera Processing Control Panel
          </CardTitle>
          <CardDescription>
            Monitor and control the automatic shot detection system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-medium">Processing Status</span>
              </div>
              <Badge variant={cameraStatus?.active ? "default" : "secondary"} className="text-sm">
                {cameraStatus?.active ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">Total Clips</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {streamStats?.total_clips || 0}
              </span>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Last Detection</span>
              </div>
              <span className="text-xs text-gray-600">
                {formatTimestamp(cameraStatus?.last_motion_time)}
              </span>
            </div>
          </div>

          {/* Controls */}
          {canControlCamera ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={startCameraProcessing}
                  disabled={loading || cameraStatus?.active}
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {loading ? 'Starting...' : 'Start Processing'}
                </Button>

                <Button
                  onClick={stopCameraProcessing}
                  disabled={loading || !cameraStatus?.active}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  {loading ? 'Stopping...' : 'Stop Processing'}
                </Button>
              </div>

              {cameraStatus && (
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
                    Camera processing is {cameraStatus.active ? 'actively monitoring' : 'currently stopped'}. 
                    {cameraStatus.active && ` Monitoring stream: ${cameraStatus.stream_url}`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Camera control is restricted to administrators and course managers only.
                Current status: {cameraStatus?.active ? 'Processing Active' : 'Processing Inactive'}
              </AlertDescription>
            </Alert>
          )}

          {/* Recent Clips */}
          {streamStats?.recent_clips && streamStats.recent_clips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Recent Clips Generated
              </h4>
              <div className="space-y-1">
                {streamStats.recent_clips.map((clip, index) => (
                  <div key={index} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                    {clip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="pt-4 border-t space-y-2">
            <h4 className="text-sm font-medium">System Information</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Automatic shot detection using computer vision</p>
              <p>• 10-second clips generated for hole 1 of active rounds</p>
              <p>• Motion detection with background subtraction</p>
              <p>• Real-time processing of Lexington Golf Course stream</p>
              {cameraStatus?.clips_created !== undefined && (
                <p>• Total clips in system: {cameraStatus.clips_created}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};