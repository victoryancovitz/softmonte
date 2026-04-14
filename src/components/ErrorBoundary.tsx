'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Algo deu errado</h3>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message || 'Erro inesperado na aplicação.'}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark">
              Recarregar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
