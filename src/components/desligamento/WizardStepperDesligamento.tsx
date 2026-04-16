'use client'

import {
  AlertTriangle, HardHat, Wrench, Stethoscope,
  FileText, Calculator, ClipboardCheck, Send, Check,
} from 'lucide-react'

const STEPS = [
  { num: 1, label: 'Aviso Prévio', icon: AlertTriangle },
  { num: 2, label: 'EPI', icon: HardHat },
  { num: 3, label: 'Ferramentas', icon: Wrench },
  { num: 4, label: 'Exame', icon: Stethoscope },
  { num: 5, label: 'Baixa CTPS', icon: FileText },
  { num: 6, label: 'Rescisão', icon: Calculator },
  { num: 7, label: 'Homologação', icon: ClipboardCheck },
  { num: 8, label: 'eSocial', icon: Send },
] as const

interface Props {
  currentStep: number
  completedSteps: number[]
  onStepClick: (step: number) => void
}

export default function WizardStepperDesligamento({ currentStep, completedSteps, onStepClick }: Props) {
  return (
    <nav className="w-full overflow-x-auto py-2 px-2">
      <ol className="flex items-center justify-between min-w-[600px] max-w-4xl mx-auto">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.num)
          const isCurrent = currentStep === step.num
          const isFuture = !isCompleted && !isCurrent
          const canClick = isCompleted || isCurrent

          const showLine = idx < STEPS.length - 1
          const nextCompleted = completedSteps.includes(step.num) && completedSteps.includes(STEPS[idx + 1]?.num)

          const Icon = step.icon

          return (
            <li key={step.num} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                disabled={isFuture}
                onClick={() => canClick && onStepClick(step.num)}
                className={`flex flex-col items-center gap-1.5 group relative ${
                  isFuture ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm font-bold ${
                    isCompleted
                      ? 'bg-green-500 text-white group-hover:bg-green-600'
                      : isCurrent
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="md:hidden">{step.num}</span>
                  )}
                  {!isCompleted && <Icon className="w-4 h-4 hidden md:block" />}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-tight text-center hidden md:block ${
                    isCompleted
                      ? 'text-green-600'
                      : isCurrent
                        ? 'text-red-600'
                        : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                <span
                  className={`text-[10px] font-semibold md:hidden ${
                    isCompleted
                      ? 'text-green-600'
                      : isCurrent
                        ? 'text-red-600'
                        : 'text-gray-400'
                  }`}
                >
                  {step.num}
                </span>
              </button>

              {showLine && (
                <div className="flex-1 mx-1.5 mt-[-18px] md:mt-[-14px]">
                  <div
                    className={`h-0.5 w-full rounded-full ${
                      nextCompleted
                        ? 'bg-green-400'
                        : isCompleted
                          ? 'bg-green-300'
                          : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
