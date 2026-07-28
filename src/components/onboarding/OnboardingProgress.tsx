import styles from './OnboardingProgress.module.css'

interface OnboardingProgressProps {
  currentStep: 1 | 2
  totalSteps: 2
}

export default function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <nav className={styles.wrapper} aria-label="Onboarding progress">
      <span className={`${styles.step} ${currentStep >= 1 ? styles.stepActive : ''}`}>
        <span className={`${styles.dot} ${currentStep >= 1 ? styles.dotActive : ''}`} aria-hidden="true" />
        Household
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={`${styles.step} ${currentStep >= 2 ? styles.stepActive : ''}`}>
        <span className={`${styles.dot} ${currentStep >= 2 ? styles.dotActive : ''}`} aria-hidden="true" />
        Done
      </span>
    </nav>
  )
}
