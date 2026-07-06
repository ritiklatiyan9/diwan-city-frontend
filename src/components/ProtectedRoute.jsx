import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requiredRole, requiredModule }) => {
  const { isAuthenticated, loading, user, hasPermission } = useAuth();

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

  return children;
};

export default ProtectedRoute;
