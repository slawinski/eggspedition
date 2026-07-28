import type { ReactNode } from 'react'
import styles from './HouseholdChoiceCard.module.css'

interface HouseholdChoiceCardProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}

export default function HouseholdChoiceCard({
  icon,
  title,
  description,
  onClick,
}: HouseholdChoiceCardProps) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={onClick}
      aria-label={`${title}: ${description}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </button>
  )
}
