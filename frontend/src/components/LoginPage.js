import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { useAuth } from '../App';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

export const LoginPage = () => {
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    userType: 'user' // 'user' or 'admin'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(loginData.email, loginData.password);
    if (result.success) {
      // Redirect based on user type selection and actual user role
      if (loginData.userType === 'admin' && (result.user?.role === 'admin' || result.user?.role === 'course_manager')) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen hero-background flex items-center justify-center p-4">
      <div className="w-full max-width-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="https://customer-assets.emergentagent.com/job_b432ac39-e954-4a9f-affa-6f7c24334e04/artifacts/hv3qu3ev_Birdieo-logo.png" 
              alt="Birdieo" 
              className="birdieo-logo"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to Birdieo</h1>
          <p className="text-emerald-100 text-lg">Your automated golf shot capture platform</p>
        </div>

        <Card className="glass-card border-0 shadow-2xl max-w-md mx-auto">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold text-emerald-800">Sign In</CardTitle>
            <CardDescription className="text-emerald-600">
              Enter your credentials to access your golf rounds
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User Type Selection */}
              <div className="space-y-3">
                <label className="text-emerald-700 font-medium block">
                  Login As
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLoginData({...loginData, userType: 'user'})}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      loginData.userType === 'user'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">👤</div>
                      <div className="font-medium">User</div>
                      <div className="text-xs opacity-75">Golf player access</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginData({...loginData, userType: 'admin'})}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      loginData.userType === 'admin'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">👨‍💼</div>
                      <div className="font-medium">Admin</div>
                      <div className="text-xs opacity-75">Full system access</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-emerald-800 font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600 h-5 w-5" />
                  <Input
                    id="email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    className="golf-input pl-12"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-emerald-800 font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600 h-5 w-5" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    className="golf-input pl-12 pr-12"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-golf-primary group relative overflow-hidden"
              >
                {loading ? (
                  <div className="loading-golf"></div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-emerald-700">
                Don't have an account?{' '}
                <Link to="/register" className="font-semibold text-emerald-800 hover:text-emerald-900 underline">
                  Sign up here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-emerald-100">
          <p className="text-sm">
            Automated golf shot capture • Real-time identification • Instant sharing
          </p>
        </div>
      </div>
    </div>
  );
};