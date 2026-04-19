import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tutorials, Tutorial, TutorialSubStep } from '../data/tutorialData';

interface TutorialContextType {
  activeTutorial: Tutorial | null;
  currentStepIndex: number;
  currentSubStepIndex: number;
  startTutorial: (id: string) => void;
  nextStep: () => void;
  endTutorial: () => void;
  currentSubStep: TutorialSubStep | null;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSubStepIndex, setCurrentSubStepIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const activeTutorial = tutorials.find(t => t.id === activeTutorialId) || null;
  
  const currentStep = activeTutorial?.steps[currentStepIndex] || null;
  const currentSubStep = currentStep?.subSteps[currentSubStepIndex] || null;

  useEffect(() => {
    // ページ遷移時に、チュートリアルの現在のステップが要求するページと異なる場合、自動的に遷移させる
    if (activeTutorial && currentStep) {
      if (location.pathname !== currentStep.match) {
        navigate(currentStep.match);
      }
    }
  }, [activeTutorial, currentStepIndex, location.pathname, navigate]);

  const startTutorial = (id: string) => {
    setActiveTutorialId(id);
    setCurrentStepIndex(0);
    setCurrentSubStepIndex(0);
  };

  const endTutorial = () => {
    setActiveTutorialId(null);
    setCurrentStepIndex(0);
    setCurrentSubStepIndex(0);
  };

  const nextStep = () => {
    if (!activeTutorial || !currentStep) return;

    if (currentSubStepIndex < currentStep.subSteps.length - 1) {
      setCurrentSubStepIndex(prev => prev + 1);
    } else if (currentStepIndex < activeTutorial.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setCurrentSubStepIndex(0);
    } else {
      endTutorial();
    }
  };

  return (
    <TutorialContext.Provider value={{
      activeTutorial,
      currentStepIndex,
      currentSubStepIndex,
      startTutorial,
      nextStep,
      endTutorial,
      currentSubStep
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
