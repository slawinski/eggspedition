import styles from './Skeleton.module.css'

type SkeletonVariant = 'text' | 'card' | 'circle' | 'chip'

interface SkeletonProps {
  variant: SkeletonVariant
  /** CSS width override (e.g. "100%", "200px"). Defaults to variant sensible sizes. */
  width?: string
  /** CSS height override. */
  height?: string
}

const variantDefaults: Record<SkeletonVariant, { width: string; height: string }> = {
  text:   { width: '100%', height: '1em' },
  card:   { width: '100%', height: '120px' },
  circle: { width: '3rem', height: '3rem' },
  chip:   { width: '6rem', height: '2rem' },
}

/**
 * Skeleton — a clay-styled loading placeholder.
 *
 * Hidden from the accessibility tree (`aria-hidden`) because it
 * carries no meaningful content for assistive technologies.
 * Respects `prefers-reduced-motion` by rendering a static block.
 */
export default function Skeleton({
  variant,
  width,
  height,
}: SkeletonProps) {
  const defaults = variantDefaults[variant]

  return (
    <span
      className={`${styles.skeleton} ${styles[variant]}`}
      style={{
        width: width ?? defaults.width,
        height: height ?? defaults.height,
      }}
      aria-hidden="true"
      data-skeleton
    />
  )
}
