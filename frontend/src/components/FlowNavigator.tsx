import React from 'react';
import './FlowNavigator.css';

interface Step {
  id: string;
  title: string;
  description: string;
}

interface FlowNavigatorProps {
  steps: Step[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
}

const FlowNavigator: React.FC<FlowNavigatorProps> = ({ 
  steps, 
  currentStep, 
  onStepClick 
}) => {
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="flow-navigator">
      <div className="flow-navigator-container">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.id === currentStep;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <div
              key={step.id}
              className={`flow-step ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && onStepClick(step.id)}
            >
              <div className="step-indicator">
                <div className="step-number">
                  {isCompleted ? '✓' : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`step-line ${isCompleted ? 'completed' : ''}`} />
                )}
              </div>
              <div className="step-content">
                <div className="step-title">{step.title}</div>
                <div className="step-description">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlowNavigator;