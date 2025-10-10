import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/auth-store';

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    const hasAuth = checkAuth();
    if (!hasAuth) {
      navigate('/login', { replace: true });
    }
  }, [checkAuth, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return children;
};

export default ProtectedRoute;