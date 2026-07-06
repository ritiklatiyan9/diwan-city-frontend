import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Building2, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2 bg-background font-sans overflow-hidden">
      {/* ── Left Panel (branding) ── */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900 flex-col justify-between p-8 lg:p-12 text-white">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 inline-flex">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Account<span className="text-primary"> Software</span></span>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg mb-12">
          <h2 className="text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">Modernize your real estate accountancy framework.</h2>
          <p className="text-base lg:text-lg text-slate-400">Streamline multi-site finances, organize your documents, and maintain 100% control over roles and permissions securely.</p>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
             <ShieldCheck className="w-5 h-5 text-primary" />
             End-to-end encrypted access control
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Account Software. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Panel (form) ── */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 relative w-full">
        <div className="absolute inset-0 bg-slate-50/50 dark:bg-transparent -z-10" />
        
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-4 mb-2">
            <Link to="/" className="flex items-center gap-2.5 justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            </Link>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Account Software</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Sign in to your dashboard</p>
          </div>

          <Card className="border-border/50 shadow-lg shadow-black/5 dark:shadow-none w-full">
            <CardHeader className="space-y-2 text-center pb-4 sm:pb-6 px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
              <CardDescription className="text-xs sm:text-base text-muted-foreground hidden sm:block">
                Sign in to your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {error && (
                <Alert variant="destructive" className="mb-6 bg-destructive/5 text-destructive border-destructive/20 rounded-xl text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground text-xs sm:text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-10 sm:h-11 rounded-lg bg-background text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground text-xs sm:text-sm">Password</Label>
                  </div>
                  <div className="relative relative-group">
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-10 sm:h-11 rounded-lg bg-background pr-10 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                      onClick={() => setShowPass(!showPass)}
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium rounded-lg mt-2 sm:mt-4"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col border-t border-border/50 pt-4 sm:pt-6 mt-2 px-4 sm:px-6 pb-4 sm:pb-6">
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                Don't have an account? <br className="sm:hidden" />
                <span className="hidden sm:inline"> </span>
                Contact your administrator.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;

