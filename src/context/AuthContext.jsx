import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';
import { apolloClient } from '../graphql/client';
import eventBus from '../utils/eventBus';
import { getAvailableSites, resolveCurrentSite } from '../utils/siteSelection';

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [currentSite, setCurrentSiteState] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentSiteRef = useRef(null);
  const sitesRef = useRef([]);
  const siteRefreshRef = useRef(null);
  const siteRefreshVersionRef = useRef(0);

  const commitCurrentSite = useCallback((site) => {
    const previousId = currentSiteRef.current?.id;
    currentSiteRef.current = site;
    setCurrentSiteState(site);
    if (site) {
      const serialized = JSON.stringify(site);
      if (localStorage.getItem('currentSite') !== serialized) localStorage.setItem('currentSite', serialized);
    }
    else localStorage.removeItem('currentSite');
    if (String(previousId ?? '') !== String(site?.id ?? '')) {
      // Stop cached records from a switched-off site surviving a site change.
      apolloClient.clearStore().catch(err => console.error('Failed to clear site cache:', err));
    }
  }, []);

  const applySites = useCallback((siteList) => {
    const available = getAvailableSites(siteList);
    let previous = currentSiteRef.current;
    if (!previous) {
      try { previous = JSON.parse(localStorage.getItem('currentSite') || 'null'); } catch { /* discard stale storage */ }
    }
    sitesRef.current = available;
    setSites(available);
    const serialized = JSON.stringify(available);
    if (localStorage.getItem('sites') !== serialized) localStorage.setItem('sites', serialized);
    commitCurrentSite(resolveCurrentSite(available, previous));
    return available;
  }, [commitCurrentSite]);

  // Fetch current user + sites from /auth/me
  const fetchMe = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const { user: userData, sites: userSites, permissions: userPerms } = response.data;

      setUser(userData);
      applySites(userSites || []);
      localStorage.setItem('user', JSON.stringify(userData));

      if (userPerms) {
        setPermissions(userPerms);
        localStorage.setItem('permissions', JSON.stringify(userPerms));
      }

    } catch (err) {
      console.error('Failed to fetch user data:', err);
      const status = err?.response?.status;
      // Only force logout on explicit auth failures.
      if (status === 401 || status === 403) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        localStorage.removeItem('sites');
        localStorage.removeItem('currentSite');
        localStorage.removeItem('permissions');
        setUser(null);
        setSites([]);
        commitCurrentSite(null);
        setPermissions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applySites, commitCurrentSite]);

  // Restore session on mount
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const sessionId = localStorage.getItem('sessionId');
      const userData = localStorage.getItem('user');
      const sitesData = localStorage.getItem('sites');
      const permsData = localStorage.getItem('permissions');

      if (accessToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        // Set sessionId in headers if it exists
        if (sessionId) {
          api.defaults.headers.common['X-Session-ID'] = sessionId;
        }

        try {
          if (userData) {
            setUser(JSON.parse(userData));
          }
          if (sitesData) {
            applySites(JSON.parse(sitesData));
          }
          if (permsData) {
            setPermissions(JSON.parse(permsData));
          }
          // Fetch latest details (including permissions) from backend so they are up-to-date
          await fetchMe();
        } catch (err) {
          // fetchMe already handles clearing state and local storage on error
          console.error('Error during initial auth fetchMe:', err);
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
    return undefined;
  }, [fetchMe, applySites]);


  const setCurrentSite = (site) => {
    const available = sites.find(candidate => String(candidate.id) === String(site?.id));
    commitCurrentSite(available || null);
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      if (data.sessionId) {
        localStorage.setItem('sessionId', data.sessionId);
      } else {
        localStorage.removeItem('sessionId');
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
      if (data.sessionId) {
        api.defaults.headers.common['X-Session-ID'] = data.sessionId;
      } else {
        delete api.defaults.headers.common['X-Session-ID'];
      }

      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.permissions) {
        localStorage.setItem('permissions', JSON.stringify(data.permissions));
        setPermissions(data.permissions);
      }

      setUser(data.user);
      applySites(data.sites || []);

      return data.user;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await api.post('/auth/logout', { sessionId });
      } else {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      localStorage.removeItem('sites');
      localStorage.removeItem('currentSite');
      localStorage.removeItem('permissions');

      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['X-Session-ID']; // Remove sessionId header
      setUser(null);
      setSites([]);
      commitCurrentSite(null);
      setPermissions([]);
      setLoading(false);
    }
  };

  // 15-minute inactivity auto-logout
  const inactivityTimer = useRef(null);
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const updateProfile = async (formData) => {
    try {
      setError(null);
      setLoading(true);

      const response = await api.put('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Profile update failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Refresh sites list (after creating/updating sites)
  const refreshSites = useCallback(async ({ force = false } = {}) => {
    if (force) siteRefreshVersionRef.current += 1;
    if (siteRefreshRef.current) {
      if (!force) return siteRefreshRef.current;
      await siteRefreshRef.current;
    }
    const version = siteRefreshVersionRef.current;
    const token = localStorage.getItem('accessToken');
    if (!token) return Promise.resolve([]);
    siteRefreshRef.current = api.get('/sites', { params: { nocache: true } })
      .then(response => {
        if (token !== localStorage.getItem('accessToken') || version !== siteRefreshVersionRef.current) return [];
        return applySites(response.data.sites || []);
      })
      .catch(err => { console.error('Failed to refresh sites:', err); })
      .finally(() => { siteRefreshRef.current = null; });
    return siteRefreshRef.current;
  }, [applySites]);

  // Other sessions and browser tabs must also stop using a disabled site.
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') refreshSites(); };
    const unavailable = ({ siteId } = {}) => {
      const available = sitesRef.current.filter(site => String(site.id) !== String(siteId));
      applySites(available);
      refreshSites({ force: true });
    };
    const onStorage = event => {
      if (event.key === 'sites') refreshSites();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', refresh);
    eventBus.on('site-unavailable', unavailable);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', refresh);
      eventBus.off('site-unavailable', unavailable);
    };
  }, [user, applySites, refreshSites]);

  // Permission helper: returns true if user has the given action for the given module
  const hasPermission = useCallback((module, action) => {
    // Admin and super_admin always have full access
    if (user?.role === 'admin' || user?.role === 'super_admin') return true;

    // Find the permission for this module
    const perm = permissions.find(p => p.module === module);
    if (!perm) {
      // No permission record found — deny delete by default, allow others
      return action !== 'delete';
    }

    return perm[`can_${action}`] === true;
  }, [user, permissions]);

  const value = {
    user,
    sites,
    currentSite,
    setCurrentSite,
    permissions,
    setPermissions,
    loading,
    error,
    login,
    logout,
    updateProfile,
    fetchMe,
    refreshSites,
    hasPermission,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    canManage: user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'sub_admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
