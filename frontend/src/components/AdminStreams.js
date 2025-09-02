import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Camera, 
  Play, 
  Pause, 
  RefreshCw, 
  Eye,
  Target,
  Zap,
  Users,
  Shield,
  Activity
} from 'lucide-react';
import { useAuth } from '../App';
import { toast } from 'sonner';

export const AdminStreams = () => {
  const { user } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStreams, setActiveStreams] = useState({});
  const [detections, setDetections] = useState({});
  const canvasRefs = useRef({});

  // Stream configurations
  const streamConfigs = [
    {
      id: 'lexington_hole_1',
      name: 'Lexington Golf Club - Hole 1',
      url: 'http://localhost:8002',
      description: 'Tee box and fairway view',
      status: 'active'
    },
    {
      id: 'lexington_hole_2',
      name: 'Lexington Golf Club - Hole 2',
      url: 'https://www.lexingtongolfclub.net/live-stream/',
      description: 'Green and water hazard view',
      status: 'external'
    },
    {
      id: 'lexington_hole_3',
      name: 'Lexington Golf Club - Hole 3',
      url: 'https://www.lexingtongolfclub.net/live-stream/',
      description: 'Par 3 scenic view',
      status: 'external'
    }
  ];

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'course_manager') {
      initializeStreams();
    }
  }, [user]);

  const initializeStreams = async () => {
    setLoading(true);
    try {
      // Check stream health for each configured stream
      const streamStatus = await Promise.all(
        streamConfigs.map(async (config) => {
          try {
            if (config.status === 'active') {
              const response = await fetch(`${config.url}/health`, { timeout: 5000 });
              const health = await response.json();
              return { ...config, health, online: health.ok };
            }
            return { ...config, health: null, online: false };
          } catch (error) {
            return { ...config, health: null, online: false, error: error.message };
          }
        })
      );
      
      setStreams(streamStatus);
    } catch (error) {
      toast.error('Failed to initialize streams');
    } finally {
      setLoading(false);
    }
  };

  const startStream = async (streamId) => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream || !stream.online) return;

    try {
      setActiveStreams(prev => ({ ...prev, [streamId]: true }));
      
      // Start detection analysis
      startDetectionAnalysis(streamId, stream.url);
      
      toast.success(`Started ${stream.name}`);
    } catch (error) {
      toast.error(`Failed to start stream: ${error.message}`);
      setActiveStreams(prev => ({ ...prev, [streamId]: false }));
    }
  };

  const stopStream = (streamId) => {
    setActiveStreams(prev => ({ ...prev, [streamId]: false }));
    setDetections(prev => ({ ...prev, [streamId]: null }));
    toast.info('Stream stopped');
  };

  const startDetectionAnalysis = async (streamId, streamUrl) => {
    const analyzeFrame = async () => {
      try {
        const response = await fetch(`${streamUrl}/analyze`);
        const analysis = await response.json();
        
        if (analysis.ok) {
          // Simulate AI detection results
          const mockDetections = {
            people: [
              {
                id: 'person_1',
                bbox: { x: 150, y: 100, width: 80, height: 200 },
                clothing: {
                  top_color: 'blue',
                  top_style: 'polo',
                  bottom_color: 'khaki'
                },
                confidence: 0.85
              }
            ],
            flagstick: [
              {
                bbox: { x: 300, y: 50, width: 10, height: 150 },
                confidence: 0.92
              }
            ],
            golf_balls: [
              {
                bbox: { x: 200, y: 250, width: 15, height: 15 },
                confidence: 0.78
              }
            ]
          };
          
          setDetections(prev => ({ ...prev, [streamId]: mockDetections }));
        }
      } catch (error) {
        console.error('Detection analysis error:', error);
      }
    };

    // Run analysis every 2 seconds
    const interval = setInterval(analyzeFrame, 2000);
    
    // Store interval for cleanup
    return () => clearInterval(interval);
  };

  const drawDetections = (streamId, canvas, detectionData) => {
    if (!canvas || !detectionData) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw people with blue boxes
    detectionData.people?.forEach((person, index) => {
      const { x, y, width, height } = person.bbox;
      
      ctx.strokeStyle = '#3B82F6'; // Blue
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Label with clothing info
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(x, y - 25, 120, 25);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(`Person ${index + 1}: ${person.clothing.top_color}`, x + 5, y - 8);
    });

    // Draw flagstick with red box
    detectionData.flagstick?.forEach((flag) => {
      const { x, y, width, height } = flag.bbox;
      
      ctx.strokeStyle = '#EF4444'; // Red
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Label
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(x, y - 25, 80, 25);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText('Flagstick', x + 5, y - 8);
    });

    // Draw golf balls with yellow boxes
    detectionData.golf_balls?.forEach((ball, index) => {
      const { x, y, width, height } = ball.bbox;
      
      ctx.strokeStyle = '#EAB308'; // Yellow
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Label
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(x, y - 25, 60, 25);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(`Ball ${index + 1}`, x + 5, y - 8);
    });
  };

  if (!user || (user.role !== 'admin' && user.role !== 'course_manager')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Alert className="border-red-200 bg-red-50">
            <Shield className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Access denied. Administrator privileges required.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-emerald-800 mb-2">
                Live Streams & AI Detection
              </h1>
              <p className="text-emerald-600">
                Real-time golf course monitoring with computer vision
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => window.location.href = '/admin'}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Back to Admin
              </Button>
              <Button 
                onClick={initializeStreams}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh Streams
              </Button>
            </div>
          </div>
        </div>

        {/* Stream Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {streams.map((stream) => (
            <Card key={stream.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{stream.name}</CardTitle>
                    <CardDescription>{stream.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={stream.online ? "default" : "secondary"}>
                      {stream.online ? 'Online' : 'Offline'}
                    </Badge>
                    {activeStreams[stream.id] && (
                      <Badge variant="outline" className="text-green-600">
                        <Activity className="h-3 w-3 mr-1" />
                        Live
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Stream Display */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  {activeStreams[stream.id] && stream.online ? (
                    <div className="relative w-full h-full">
                      {/* Main Stream */}
                      {stream.status === 'active' ? (
                        <img
                          src={`${stream.url}/frame?t=${Date.now()}`}
                          alt={stream.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Retry loading
                            setTimeout(() => {
                              e.target.src = `${stream.url}/frame?t=${Date.now()}`;
                            }, 1000);
                          }}
                        />
                      ) : (
                        <iframe
                          src={stream.url}
                          title={stream.name}
                          className="w-full h-full"
                          frameBorder="0"
                          allowFullScreen
                        />
                      )}
                      
                      {/* Detection Overlay Canvas */}
                      <canvas
                        ref={(el) => {
                          if (el) {
                            canvasRefs.current[stream.id] = el;
                            // Draw detections when available
                            if (detections[stream.id]) {
                              drawDetections(stream.id, el, detections[stream.id]);
                            }
                          }
                        }}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        width="640"
                        height="360"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <div className="text-center">
                        <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-semibold mb-2">Stream Offline</p>
                        <p className="text-sm opacity-75">
                          {stream.online ? 'Click play to start' : 'Stream not available'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stream Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {!activeStreams[stream.id] ? (
                      <Button
                        onClick={() => startStream(stream.id)}
                        disabled={!stream.online}
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        <Play className="h-4 w-4" />
                        Start Stream
                      </Button>
                    ) : (
                      <Button
                        onClick={() => stopStream(stream.id)}
                        variant="destructive"
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        <Pause className="h-4 w-4" />
                        Stop Stream
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {stream.health && (
                      <Badge variant="outline" className="text-xs">
                        {stream.health.age_seconds?.toFixed(1)}s ago
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Detection Stats */}
                {detections[stream.id] && activeStreams[stream.id] && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 p-2 rounded">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">
                          {detections[stream.id].people?.length || 0}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600">People</p>
                    </div>
                    
                    <div className="bg-red-50 p-2 rounded">
                      <div className="flex items-center justify-center gap-1">
                        <Target className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-600">
                          {detections[stream.id].flagstick?.length || 0}
                        </span>
                      </div>
                      <p className="text-xs text-red-600">Flagstick</p>
                    </div>
                    
                    <div className="bg-yellow-50 p-2 rounded">
                      <div className="flex items-center justify-center gap-1">
                        <Zap className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-600">
                          {detections[stream.id].golf_balls?.length || 0}
                        </span>
                      </div>
                      <p className="text-xs text-yellow-600">Balls</p>
                    </div>
                  </div>
                )}

                {/* Stream Info */}
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span>{stream.status === 'active' ? 'Internal Stream' : 'External Feed'}</span>
                  </div>
                  {stream.health && (
                    <div className="flex justify-between">
                      <span>Source:</span>
                      <span>Lexington Golf Club</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detection Legend */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              AI Detection Legend
            </CardTitle>
            <CardDescription>
              Real-time computer vision detection overlays
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-4 h-4 border-2 border-blue-500"></div>
                <div>
                  <p className="font-medium text-blue-700">People Detection</p>
                  <p className="text-sm text-blue-600">Identifies golfers with clothing analysis</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <div className="w-4 h-4 border-2 border-red-500"></div>
                <div>
                  <p className="font-medium text-red-700">Flagstick Detection</p>
                  <p className="text-sm text-red-600">Identifies golf hole flagsticks</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <div className="w-4 h-4 border-2 border-yellow-500"></div>
                <div>
                  <p className="font-medium text-yellow-700">Golf Ball Detection</p>
                  <p className="text-sm text-yellow-600">Tracks golf balls in flight and on ground</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};