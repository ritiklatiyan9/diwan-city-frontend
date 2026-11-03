import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requiredRole, requiredModule }) => {
  const { isAuthenticated, loading, user, hasPermission, currentSite, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-based access check (super_admin has all admin privileges)
  if (requiredRole) {
    const hasRole = user?.role === requiredRole || 
      (requiredRole === 'admin' && user?.role === 'super_admin');
    if (!hasRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Module permission check (for sub-admins)
  if (requiredModule && !hasPermission(requiredModule, 'read')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredModule && !['settings', 'chat'].includes(requiredModule) && !currentSite) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <h1 className="text-lg font-semibold text-slate-800">No available site</h1>
        <p className="text-sm text-slate-500">{isAdmin ? 'Activate a site in Sites to continue.' : 'Your assigned sites are inactive or unavailable. Contact your administrator.'}</p>
        {isAdmin && <Link to="/sites" className="text-sm font-medium text-blue-600 hover:underline">Manage sites</Link>}
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
