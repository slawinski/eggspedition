import { useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import styles from './ManageTagsButton.module.css'

/**
 * Footer shortcut placed at the bottom of category/store picker dropdowns.
 * Jumps to the management page where entries can be renamed, merged or
 * deleted — right where typos are born. Navigating unmounts any open
 * dialog, whose cleanup closes it (no stuck backdrops).
 */
export default function ManageTagsButton({ label }: { label: string }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={styles.manageBtn}
      onClick={() => navigate({ to: '/settings/tags' })}
    >
      <Settings size={14} aria-hidden="true" className={styles.manageIcon} />
      {label}
    </button>
  )
}
