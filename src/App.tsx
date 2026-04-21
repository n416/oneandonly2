import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UIProvider } from "./contexts/UIContext";
import { TutorialProvider } from "./lib/TutorialContext";
import TutorialOverlay from "./components/TutorialOverlay";

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
