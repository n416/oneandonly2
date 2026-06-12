import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UIProvider } from "./contexts/UIContext";
import { TutorialProvider } from "./lib/TutorialContext";
import TutorialOverlay from "./components/TutorialOverlay";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

// Layouts
import AppLayout from "./components/layout/AppLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import CharacterCreate from "./pages/CharacterCreate";
import ScenarioWizard from "./pages/ScenarioWizard";
import Bookshelf from "./pages/Bookshelf";
import Settings from "./pages/Settings";
import ScenarioPlay from "./pages/ScenarioPlay";
import Warehouse from "./pages/Warehouse";
import AvatarEdit from "./pages/AvatarEdit";
import CustomScenario from "./pages/CustomScenario";
import TutorialList from "./pages/TutorialList";

function App() {
  React.useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    const setupCloseListener = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async () => {
          try {
            // Attempt to cleanly shutdown the python sidecar if running
            await tauriFetch('http://127.0.0.1:8000/api/shutdown', { method: 'POST' });
          } catch (e) {
            // Ignore errors if server is already dead or not running locally
          }
        });
      } catch (e) {
        console.warn("Could not attach window close listener", e);
      }
    };
    
    setupCloseListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <UIProvider>
      <Router>
        <TutorialProvider>
          <TutorialOverlay />
          <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/character" element={<CharacterCreate />} />
            <Route path="/scenario" element={<ScenarioWizard />} />
            <Route path="/custom-scenario" element={<CustomScenario />} />
            <Route path="/tutorial" element={<TutorialList />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/avatar" element={<AvatarEdit />} />
            <Route path="/bookshelf" element={<Bookshelf />} />
            <Route path="/play/:scenarioId" element={<ScenarioPlay />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        </TutorialProvider>
      </Router>
    </UIProvider>
  );
}

export default App;
