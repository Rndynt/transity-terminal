import { Check } from 'lucide-react';

interface RoundTripStepperProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { id: 1, label: 'Pergi' },
  { id: 2, label: 'Pulang' },
  { id: 3, label: 'Penumpang' },
  { id: 4, label: 'Selesai' },
];

export default function RoundTripStepper({ currentStep }: RoundTripStepperProps) {
  return (
    <div
      className="w-full px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
      data-testid="round-trip-stepper"
    >
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;

        return (
          <div key={step.id} className="flex items-center gap-1.5 shrink-0">
            <div
              className={`
                flex items-center gap-1.5 h-7 rounded-full px-2.5 transition-all duration-200
                ${isActive ? 'bg-blue-600 text-white shadow-sm' : ''}
                ${isCompleted ? 'bg-emerald-50 text-emerald-600' : ''}
                ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400' : ''}
              `}
              data-testid={`rt-step-${step.id}`}
            >
              <span
                className={`
                  flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0
                  ${isActive ? 'bg-white/20' : ''}
                  ${isCompleted ? 'bg-emerald-100' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-200' : ''}
                `}
              >
                {isCompleted ? <Check className="w-2.5 h-2.5" /> : step.id}
              </span>
              <span className="text-[11px] font-semibold leading-none">{step.label}</span>
            </div>

            {index < STEPS.length - 1 && (
              <div
                className={`w-3 h-px shrink-0 rounded-full transition-colors duration-300 ${
                  isCompleted ? 'bg-emerald-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
