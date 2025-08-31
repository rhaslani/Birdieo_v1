import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Play, Pause, Video, Camera, Activity } from 'lucide-react';
import { useAuth } from '../App';
import { toast } from 'sonner';

export const LiveStreamViewer = ({ roundId = null }) => {
  const { apiRequest } = useAuth();
  const [isLive, setIsLive] = useState(false);
  const [streamHealth, setStreamHealth] = useState(null);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [autoClips, setAutoClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const STREAM_URL = 'https://golf-birdieo.preview.emergentagent.com:8002';

  useEffect(() => {
    checkStreamHealth();
    getCameraStatus();
    if (roundId) {
      getAutoClips();
    }
    
    // Set up periodic health checks
    const interval = setInterval(() => {
      checkStreamHealth();
      getCameraStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [roundId]);

  const checkStreamHealth = async () => {
    try {
      const response = await fetch(`${STREAM_URL}/health`);
      const data = await response.json();
      setStreamHealth(data);
    } catch (error) {
      console.error('Failed to check stream health:', error);
      setStreamHealth({ ok: false, error: error.message });
    }
  };

  const getCameraStatus = async () => {
    const result = await apiRequest('GET', '/camera/status');
    if (result.success) {
      setCameraStatus(result.data);
    }
  };

  const getAutoClips = async () => {
    if (!roundId) return;
    
    const result = await apiRequest('GET', `/clips/${roundId}/auto`);
    if (result.success) {
      setAutoClips(result.data);
    }
  };

  const startLiveStream = () => {
    if (videoRef.current && !isLive) {
      // Use MJPEG stream for real-time viewing
      videoRef.current.src = `${STREAM_URL}/stream.mjpg`;
      setIsLive(true);
      toast.success('Live stream started');
    }
  };

  const stopLiveStream = () => {
    if (videoRef.current && isLive) {
      videoRef.current.src = '';
      setIsLive(false);
      toast.info('Live stream stopped');
    }
  };

  const activateRoundForRecording = async () => {
    if (!roundId) {
      toast.error('No round selected');
      return;
    }

    setLoading(true);
    const result = await apiRequest('POST', `/rounds/${roundId}/activate`);
    if (result.success) {
      toast.success('Round activated for automatic recording');
      getCameraStatus();
      getAutoClips();
    }
    setLoading(false);
  };

  const triggerManualClip = async () => {
    try {
      const response = await fetch(`${STREAM_URL}/trigger-clip`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        toast.success('Manual clip generation triggered');
        setTimeout(getAutoClips, 2000); // Refresh clips after a delay
      } else {
        toast.error('Failed to trigger clip generation');
      }
    } catch (error) {
      toast.error('Failed to trigger clip generation');
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Live Stream Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Lexington Golf Course - Hole 1 Live Stream
          </CardTitle>
          <CardDescription>
            Real-time feed with automatic shot detection and clip generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stream Status */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Stream Status:</span>
              <Badge variant={streamHealth?.ok ? "default" : "destructive"}>
                {streamHealth?.ok ? "Live" : "Offline"}
              </Badge>
            </div>
            
            {cameraStatus && (
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span className="text-sm font-medium">Camera Processing:</span>
                <Badge variant={cameraStatus.active ? "default" : "secondary"}>
                  {cameraStatus.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            )}
          </div>

          {/* Video Player */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <img
              ref={videoRef}
              className="w-full h-64 sm:h-80 object-contain"
              alt="Live golf stream"
              style={{ display: isLive ? 'block' : 'none' }}
            />
            {!isLive && (
              <div className="w-full h-64 sm:h-80 flex items-center justify-center bg-gray-800 text-white">
                <div className="text-center">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Click Start Stream to view live feed</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={isLive ? stopLiveStream : startLiveStream}
              className="flex items-center gap-2"
            >
              {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isLive ? 'Stop Stream' : 'Start Stream'}
            </Button>

            {roundId && (
              <Button 
                onClick={activateRoundForRecording}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                {loading ? 'Activating...' : 'Activate Recording'}
              </Button>
            )}

            <Button 
              onClick={triggerManualClip}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Manual Clip
            </Button>
          </div>

          {/* Stream Info */}
          {streamHealth && (
            <div className="text-xs text-gray-600 space-y-1">
              <p>Last frame: {streamHealth.age_seconds ? `${streamHealth.age_seconds.toFixed(1)}s ago` : 'N/A'}</p>
              {cameraStatus && cameraStatus.clips_created !== undefined && (
                <p>Total clips created: {cameraStatus.clips_created}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Generated Clips */}
      {roundId && autoClips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Auto-Generated Clips - Hole 1
            </CardTitle>
            <CardDescription>
              Clips automatically captured during your round
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {autoClips.map((clip) => (
                <div key={clip.id} className="border rounded-lg p-3 space-y-2">
                  <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                    <video 
                      controls 
                      className="w-full h-full rounded"
                      poster={`/api/clips/poster/${clip.id}`}
                    >
                      <source src={`/api/clips/files/${clip.id}`} type="video/mp4" />
                      Your browser does not support video playback.
                    </video>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Hole {clip.hole_number}</span>
                      <Badge variant="secondary" className="text-xs">
                        {clip.duration_sec}s
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {formatTimestamp(clip.published_at)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Method: {clip.detection_method || 'Auto-detected'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Clips Message */}
      {roundId && autoClips.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Video className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Auto-Generated Clips Yet</h3>
            <p className="text-gray-600 mb-4">
              Clips will appear here automatically when shots are detected during your active round.
            </p>
            {roundId && (
              <Button onClick={activateRoundForRecording} disabled={loading}>
                {loading ? 'Activating...' : 'Activate Recording for This Round'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};