import type { ReactNode } from 'react';

import SafeRoute from './pages/SafeRoute';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import { ProtectedRoute } from './components/common/ProtectedRoute';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <Login />,
    visible: false
  },
  {
    name: 'SafeRoute',
    path: '/',
    element: <ProtectedRoute><SafeRoute /></ProtectedRoute>,
    visible: true
  },
  {
    name: 'NotFound',
    path: '*',
    element: <NotFound />,
    visible: false
  }
];

export default routes;