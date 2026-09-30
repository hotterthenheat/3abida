/*
  PAPER · THE RUNNER'S PLACE — mounted once in the terminal's shell (AppShell), beside the alerts' watcher, so a paper
  account's working orders meet the market on every page (data/paper/store.ts `startPaperRunner`). Renders nothing.
*/

import { useEffect } from 'react';
import { startPaperRunner } from '../../data/paper/store';

const PaperRunner = () => {
  useEffect(() => startPaperRunner(), []);
  return null;
};

export default PaperRunner;
