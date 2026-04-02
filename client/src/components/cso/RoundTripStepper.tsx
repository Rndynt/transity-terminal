import { Check } from 'lucide-react';

interface RoundTripStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
}

const STEPS = [
  { id: 1, name: 'Pergi' },
  { id: 2, name: 'Pulang' },
  { id: 3, name: 'Penumpang' },
  { id: 4, name: 'Bayar' },
  { id: 5, name: 'Selesai' }
];

export default function RoundTripStepper({ currentStep }: RoundTripStepperProps) {
  return (
    <div className="w-full py-4 px-6 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar" data-testid="round-trip-stepper">
      <div className="flex items-center justify-between min-w-[500px] max-w-3xl mx-auto">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isPending = step.id > currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                    ${isActive ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md' : ''}
                    ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                    ${isPending ? 'bg-gray-100 text-gray-400 border border-gray-200' : ''}
                  `}
                  data-testid={`rt-step-${step.id}`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <span
                  className={`
                    text-[10px] font-bold uppercase tracking-wider whitespace-nowrap
                    ${isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-gray-400'}
                  `}
                >
                  {step.name}
                </span>
              </div>
              
              {index < STEPS.length - 1 && (
                <div className="flex-1 px-4 mb-5">
                  <div className={`h-0.5 w-full rounded-full transition-colors duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-gray-100'}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
