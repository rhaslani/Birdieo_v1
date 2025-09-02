import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Users, 
  Calendar, 
  Shirt, 
  Video, 
  RefreshCw, 
  Eye,
  Play,
  Shield,
  Database
} from 'lucide-react';
import { useAuth } from '../App';
import { toast } from 'sonner';

export const AdminDashboard = () => {
  const { apiRequest, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    users: [],
    rounds: [],
    clothing: [],
    clips: []
  });
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'course_manager') {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadRounds(),
        loadClothingData(),
        loadClips()
      ]);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const result = await apiRequest('GET', '/admin/users');
    if (result.success) {
      setData(prev => ({ ...prev, users: result.data }));
    }
  };

  const loadRounds = async () => {
    const result = await apiRequest('GET', '/admin/rounds');
    if (result.success) {
      setData(prev => ({ ...prev, rounds: result.data }));
    }
  };

  const loadClothingData = async () => {
    const result = await apiRequest('GET', '/admin/clothing');
    if (result.success) {
      setData(prev => ({ ...prev, clothing: result.data }));
    }
  };

  const loadClips = async () => {
    const result = await apiRequest('GET', '/admin/clips');
    if (result.success) {
      setData(prev => ({ ...prev, clips: result.data }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatConfidence = (confidence) => {
    if (typeof confidence === 'number') {
      return `${(confidence * 100).toFixed(1)}%`;
    }
    return 'N/A';
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

  const tabButtons = [
    { id: 'users', label: 'Users', icon: Users, count: data.users.length },
    { id: 'rounds', label: 'Rounds', icon: Calendar, count: data.rounds.length },
    { id: 'clothing', label: 'Clothing', icon: Shirt, count: data.clothing.length },
    { id: 'clips', label: 'Videos', icon: Video, count: data.clips.length }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-emerald-800 mb-2">
                Admin Dashboard
              </h1>
              <p className="text-emerald-600">
                System overview and data management
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => window.location.href = '/admin/streams'}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Live Streams
              </Button>
              <Button 
                onClick={loadAllData}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
          {tabButtons.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === id
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <Badge variant={activeTab === id ? "secondary" : "outline"} className="ml-1">
                {count}
              </Badge>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Users Table */}
          {activeTab === 'users' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Registered Users ({data.users.length})
                </CardTitle>
                <CardDescription>
                  All users registered in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Name</th>
                        <th className="text-left p-3 font-semibold">Email</th>
                        <th className="text-left p-3 font-semibold">Role</th>
                        <th className="text-left p-3 font-semibold">Handedness</th>
                        <th className="text-left p-3 font-semibold">Created</th>
                        <th className="text-left p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((userItem) => (
                        <tr key={userItem.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{userItem.name}</td>
                          <td className="p-3 text-gray-600">{userItem.email}</td>
                          <td className="p-3">
                            <Badge variant={userItem.role === 'admin' ? 'default' : 'secondary'}>
                              {userItem.role}
                            </Badge>
                          </td>
                          <td className="p-3">{userItem.handedness || 'N/A'}</td>
                          <td className="p-3 text-sm text-gray-600">
                            {formatDate(userItem.created_at)}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-green-600">
                              Active
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.users.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No users found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rounds Table */}
          {activeTab === 'rounds' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Golf Rounds ({data.rounds.length})
                </CardTitle>
                <CardDescription>
                  All golf rounds in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">User</th>
                        <th className="text-left p-3 font-semibold">Course</th>
                        <th className="text-left p-3 font-semibold">Tee Time</th>
                        <th className="text-left p-3 font-semibold">Status</th>
                        <th className="text-left p-3 font-semibold">Clips</th>
                        <th className="text-left p-3 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rounds.map((round) => (
                        <tr key={round.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{round.user_name || 'Unknown'}</td>
                          <td className="p-3">{round.course_name}</td>
                          <td className="p-3 text-sm">
                            {formatDate(round.tee_time)}
                          </td>
                          <td className="p-3">
                            <Badge variant={round.status === 'active' ? 'default' : 'secondary'}>
                              {round.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {round.clip_count || 0} clips
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {formatDate(round.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.rounds.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No rounds found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clothing Analysis Table */}
          {activeTab === 'clothing' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shirt className="h-5 w-5" />
                  Clothing Analysis ({data.clothing.length})
                </CardTitle>
                <CardDescription>
                  AI-analyzed clothing data for user identification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Round ID</th>
                        <th className="text-left p-3 font-semibold">User</th>
                        <th className="text-left p-3 font-semibold">Top</th>
                        <th className="text-left p-3 font-semibold">Bottom</th>
                        <th className="text-left p-3 font-semibold">Hat</th>
                        <th className="text-left p-3 font-semibold">Confidence</th>
                        <th className="text-left p-3 font-semibold">Photos</th>
                        <th className="text-left p-3 font-semibold">Analyzed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clothing.map((clothing, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs">
                            {clothing.round_id?.substring(0, 8)}...
                          </td>
                          <td className="p-3">{clothing.user_name || 'Unknown'}</td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{clothing.top_color}</span>
                              <span className="text-xs text-gray-500">{clothing.top_style}</span>
                            </div>
                          </td>
                          <td className="p-3">{clothing.bottom_color}</td>
                          <td className="p-3">{clothing.hat_color || 'None'}</td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {formatConfidence(clothing.confidence)}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary">
                              {clothing.analysis_count || 0} photos
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {formatDate(clothing.analyzed_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.clothing.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No clothing analysis found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Videos/Clips Table */}
          {activeTab === 'clips' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Video Clips ({data.clips.length})
                </CardTitle>
                <CardDescription>
                  Auto-generated and manual video clips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Clip ID</th>
                        <th className="text-left p-3 font-semibold">Round</th>
                        <th className="text-left p-3 font-semibold">Hole</th>
                        <th className="text-left p-3 font-semibold">Duration</th>
                        <th className="text-left p-3 font-semibold">Type</th>
                        <th className="text-left p-3 font-semibold">Camera</th>
                        <th className="text-left p-3 font-semibold">Created</th>
                        <th className="text-left p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clips.map((clip) => (
                        <tr key={clip.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs">
                            {clip.id?.substring(0, 8)}...
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {clip.round_id?.substring(0, 8)}...
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">
                              Hole {clip.hole_number}
                            </Badge>
                          </td>
                          <td className="p-3">{clip.duration_sec || 10}s</td>
                          <td className="p-3">
                            <Badge variant={clip.auto_generated ? 'default' : 'secondary'}>
                              {clip.auto_generated ? 'Auto' : 'Manual'}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-gray-600">
                            {clip.camera_id}
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {formatDate(clip.published_at)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(`/api/clips/files/${clip.id}`, '_blank')}
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(`/api/clips/poster/${clip.id}`, '_blank')}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.clips.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No video clips found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-emerald-600">{data.users.length}</p>
                </div>
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Rounds</p>
                  <p className="text-2xl font-bold text-blue-600">{data.rounds.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Clothing Analyses</p>
                  <p className="text-2xl font-bold text-purple-600">{data.clothing.length}</p>
                </div>
                <Shirt className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Video Clips</p>
                  <p className="text-2xl font-bold text-red-600">{data.clips.length}</p>
                </div>
                <Video className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};