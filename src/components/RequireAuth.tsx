import React from 'react';

interface RequireAuthProps {
  isAuthenticated: boolean;
  isLoading: boolean;
  serviceName: string;
  loginUI: React.ReactNode;
  children: React.ReactNode;
}

// Gates a single route behind one service's auth, instead of blocking the whole app.
// Doesn't know or care HOW a service authenticates (OAuth redirect vs. device flow) —
// the caller builds whatever loginUI fits that service and hands it in.
export const RequireAuth: React.FC<RequireAuthProps> = ({ isAuthenticated, isLoading, serviceName, loginUI, children }) => {
  if (isLoading) {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Connecting to {serviceName}...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{loginUI}</>;
  }

  return <>{children}</>;
};
