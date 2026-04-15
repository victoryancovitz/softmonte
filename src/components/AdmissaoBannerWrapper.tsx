'use client'

import { useState } from 'react'
import AdmissaoBanner from './AdmissaoBanner'

interface Props {
  funcName: string
  stepLabel: string
}

export default function AdmissaoBannerWrapper({ funcName, stepLabel }: Props) {
  const [panelVisible, setPanelVisible] = useState(true)

  function handleToggle() {
    // Scroll to the panel on mobile or toggle visibility
    const panel = document.querySelector('[data-admissao-panel]')
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <AdmissaoBanner
      funcName={funcName}
      stepLabel={stepLabel}
      onTogglePanel={handleToggle}
    />
  )
}
