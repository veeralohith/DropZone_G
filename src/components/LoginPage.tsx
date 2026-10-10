import React, { useState, useEffect } from 'react';
import { loginUser, registerUser, fetchTestAccounts, TestAccount, AuthResponse } from '../services/api';
import { Eye, EyeOff, Lock, Mail, User, Shield, AlertCircle, ArrowRight, CheckCircle2, Sparkles, MapPin, Radio, Users } from 'lucide-react';
import campusHeroImage from '../assets/images/hackathon_campus_pavilion_1791629378415.jpg';

interface LoginPageProps {
  onLoginSuccess: (auth: AuthResponse) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);

  useEffect(() => {
    fetchTestAccounts().then(setTestAccounts).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (isRegisterMode && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegisterMode) {
        const auth = await registerUser(name.trim(), email.trim().toLowerCase(), password);
        setSuccessMessage('Account created successfully! Logging you in...');
        setTimeout(() => {
          onLoginSuccess(auth);
        }, 300);
      } else {
        const auth = await loginUser(email.trim().toLowerCase(), password);
        onLoginSuccess(auth);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTestAccount = (account: TestAccount) => {
    setIsRegisterMode(false);
    setEmail(account.email);
    setPassword(account.hintPassword);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row text-[#0F172A] selection:bg-[#2563EB] selection:text-white">
      {/* Left Column: Brand Experience & Showcase Hero */}
      <div className="relative hidden lg:flex lg:w-1/2 bg-[#0B1528] text-white flex-col justify-between p-12 overflow-hidden border-r border-slate-800">
        {/* Background Campus Image with Measured Gradient Scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src={campusHeroImage}
            alt="University Innovation Pavilion Hackathon Arena"
            className="w-full h-full object-cover opacity-45 transform scale-105 transition-transform duration-1000 ease-out hover:scale-100"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1528] via-[#0B1528]/70 to-[#0B1528]/40" />
        </div>

        {/* Brand Top Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg text-lg tracking-wider">
            DZ
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>DropZone</span>
              <span className="text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                SAMARTHA 2026
              </span>
            </div>
            <div className="text-xs text-slate-400">Zone-Aware Hyperlocal Community Network</div>
          </div>
        </div>

        {/* Hero Copy & Value Props */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto py-12">
          <div className="inline-flex items-center gap-2 text-xs text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Active Zone: IIT Delhi Innovation Pavilion</span>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight text-balance">
            Real-time physical coordination for hackathons and campus teams.
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            DropZone connects participants within verified event geofences without recording or storing precise GPS coordinates. Rapidly broadcast requirements, resolve lost items, and coordinate prototypes in private team channels.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white tabular-nums">500m</div>
              <div className="text-xs text-slate-400">Verified Proximity Perimeter</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white tabular-nums">24h TTL</div>
              <div className="text-xs text-slate-400">Automatic Message Expiry</div>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-6">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Zero Persistent GPS Storage</span>
          </div>
          <div>PostgreSQL & Prisma Engine</div>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-16 lg:w-1/2">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Brand Mark */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-base">
              DZ
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">DropZone</div>
              <div className="text-xs text-slate-500">SAMARTHA Hackathon Network</div>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isRegisterMode ? 'Create a Participant Account' : 'Welcome to DropZone'}
            </h1>
            <p className="mt-1.5 text-xs text-slate-600 leading-normal">
              {isRegisterMode
                ? 'Register with your team email to join your event geofence.'
                : 'Sign in to access community announcements, team channels, and lost & found.'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setIsRegisterMode(false); setErrorMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isRegisterMode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegisterMode(true); setErrorMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isRegisterMode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="font-medium leading-tight">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="font-medium leading-tight">{successMessage}</div>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aarav Sharma"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@hackathon.samartha.org"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                {!isRegisterMode && (
                  <span className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-11 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Create Account' : 'Sign In to Event'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Evaluation Test Accounts Drawer */}
          {testAccounts.length > 0 && !isRegisterMode && (
            <div className="pt-5 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Evaluation Personas</span>
                </div>
                <span className="text-[11px] text-slate-400">Click to fill</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {testAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectTestAccount(acc)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 bg-white text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-slate-500 capitalize flex items-center justify-between mt-0.5">
                      <span>{acc.role}</span>
                      <span className="text-[10px] text-blue-500 font-mono">Fill</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-xs text-slate-500 pt-2 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>End-to-End verified sessions via Supabase PostgreSQL</span>
          </div>
        </div>
      </div>
    </div>
  );
};
