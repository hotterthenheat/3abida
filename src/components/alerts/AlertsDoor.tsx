/*
==================================================
  SLAYER TERMINAL - THE ALERTS' ADDRESS (components/alerts/AlertsDoor.tsx)

  Alerts are not a page: they live in one drawer over whatever page you are on (data/alertsDrawer.ts). But the menu
  names them as a product (Slayer Logo System, 06 · Menu and rail) and a product needs an address — /alerts opens the
  terminal on Pulse with the drawer open.
==================================================
*/

import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { openAlertsDrawer } from '../../data/alertsDrawer';

const AlertsDoor = () => {
  useEffect(() => {
    openAlertsDrawer();
  }, []);
  return <Navigate to="/pulse" replace />;
};

export default AlertsDoor;
