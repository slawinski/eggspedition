import { Link } from '@tanstack/react-router'
import ProductPreview from './ProductPreview'
import styles from './LandingPage.module.css'
import {
  Mail, Users, ShoppingBasket, Zap, Smartphone, Tag, Store,
  Share2, Check, ChevronRight, Plus
} from 'lucide-react'

export default function LandingPage() {
  return (
    <main id="main-content" className={styles.landing}>
      {/* ═══════════ HERO ═══════════ */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.heroKicker}>Squishy. Shared. Seamless.</p>
            <h1 className={styles.heroHeadline}>
              One grocery list.<br />Everyone in sync.
            </h1>
            <p className={styles.heroDesc}>
              Add what you need the moment you remember it. Eggspedition keeps your
              household&rsquo;s list together, organised by category or store, and ready
              on every phone.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/login" className={styles.ctaPrimary}>
                Start your list
              </Link>
              <a href="#how-it-works" className={styles.ctaSecondary}>
                See how it works
              </a>
            </div>
            <p className={styles.heroMagicNote}>
              No password. We&rsquo;ll email you a secure sign-in link.
            </p>
          </div>
          <div className={styles.heroPreview}>
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ═══════════ CAPABILITIES ═══════════ */}
      <section className={styles.capabilities}>
        <div className={styles.sectionInner}>
          <div className={styles.capGrid}>
            {[
              { icon: Share2, label: 'Shared in real time', desc: 'Changes appear across your household list.' },
              { icon: Tag, label: 'Organised your way', desc: 'View the same items by category or store.' },
              { icon: Zap, label: 'Staples in one tap', desc: 'Quick Add the products you buy repeatedly.' },
              { icon: Smartphone, label: 'Made for your phone', desc: 'Install Eggspedition from your browser.' },
            ].map(cap => (
              <div key={cap.label} className={styles.capItem}>
                <cap.icon className={styles.capIcon} aria-hidden="true" />
                <div>
                  <p className={styles.capLabel}>{cap.label}</p>
                  <p className={styles.capDesc}>{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="how-it-works" className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>How it works</p>
          <h2 className={styles.sectionHeading}>
            From &ldquo;we need milk&rdquo; to one shared list.
          </h2>
          <p className={styles.sectionSub}>
            There is no account setup maze. Sign in, connect your household and start adding.
          </p>

          <div className={styles.stepsGrid}>
            {[
              { num: '1', icon: Mail, title: 'Sign in with your email', desc: 'Enter your email and use the secure magic link we send you. No password to create or remember.' },
              { num: '2', icon: Users, title: 'Share your household code', desc: 'Send the household code to the people you shop with so everyone works from the same list.' },
              { num: '3', icon: ShoppingBasket, title: 'Add it. Find it. Tap it done.', desc: 'Add products in seconds, organise the shop and check items off as they reach the basket.' },
            ].map((step, i) => (
              <div key={step.num} className={styles.step}>
                <div className={styles.stepConnector}>
                  <div className={styles.stepBadge}>
                    <span className={styles.stepNum}>{step.num}</span>
                    <step.icon className={styles.stepIcon} aria-hidden="true" />
                  </div>
                  {i < 2 && <div className={styles.stepLine} />}
                </div>
                <div className={styles.stepBody}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section id="features" className={styles.section}>
        <div className={styles.sectionInner}>
          {/* Feature 1: Shared household */}
          <div className={styles.featureRow}>
            <div className={styles.featureText}>
              <p className={styles.eyebrow}>Shared household</p>
              <h2 className={styles.featureHeading}>
                See the same list, not three versions of it.
              </h2>
              <p className={styles.featureDesc}>
                Someone remembers coffee at home. You see it while you&rsquo;re shopping.
                Eggspedition keeps household changes together and shows recent activity so
                nobody has to ask which list is current.
              </p>
              <ul className={styles.featurePoints}>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Shared household space</li>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Live list updates</li>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Recent activity history</li>
              </ul>
            </div>
            <div className={styles.featureVisual} aria-hidden="true">
              <div className={styles.activityDemo}>
                {[
                  { time: '12:42', user: 'Alex', action: 'added', item: 'Coffee', color: 'var(--accent-coral)' },
                  { time: '12:39', user: 'Sam', action: 'checked', item: 'Milk', color: 'var(--accent-mint)' },
                  { time: '12:31', user: 'Alex', action: 'added', item: 'Bananas', color: 'var(--accent-coral)' },
                ].map(entry => (
                  <div key={entry.time} className={styles.activityRow}>
                    <span className={styles.activityTime}>{entry.time}</span>
                    <span className={styles.activityName} style={{ color: entry.color }}>
                      {entry.user}
                    </span>
                    <span className={styles.activityAction}>{entry.action}</span>
                    <span className={styles.activityItem}>{entry.item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 2: Category & store views */}
          <div className={`${styles.featureRow} ${styles.featureRowAlt}`}>
            <div className={styles.featureText}>
              <p className={styles.eyebrow}>One list, two views</p>
              <h2 className={styles.featureHeading}>
                Shop the way the store works.
              </h2>
              <p className={styles.featureDesc}>
                Group the list by category when you want a tidy overview, or switch
                to store view when the same household shops in different places.
                The items stay on one list.
              </p>
              <ul className={styles.featurePoints}>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Group by category</li>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Group by preferred store</li>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Category and store info together</li>
              </ul>
            </div>
            <div className={styles.featureVisual} aria-hidden="true">
              <div className={styles.viewDemo}>
                <div className={styles.viewCol}>
                  <p className={styles.viewLabel}><Tag className={styles.viewIcon} /> Category</p>
                  {['Produce — Bananas, Avocados', 'Dairy — Milk, Yoghurt'].map(s => (
                    <div key={s} className={styles.viewItem}>{s}</div>
                  ))}
                </div>
                <div className={styles.viewCol}>
                  <p className={styles.viewLabel}><Store className={styles.viewIcon} /> Store</p>
                  {['Biedronka — Milk, Bananas', 'Any store — Coffee, Avocados'].map(s => (
                    <div key={s} className={styles.viewItem}>{s}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Quick Add */}
          <div className={styles.featureRow}>
            <div className={styles.featureText}>
              <p className={styles.eyebrow}>Your regulars</p>
              <h2 className={styles.featureHeading}>
                The weekly staples are already waiting.
              </h2>
              <p className={styles.featureDesc}>
                Milk, eggs, coffee, bananas&mdash;the things you buy repeatedly should not
                require repeated typing. Quick Add puts household staples one tap away.
              </p>
              <ul className={styles.featurePoints}>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Household Quick Add templates</li>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Frequently added suggestions</li>
                <li><Check className={styles.pointIcon} aria-hidden="true" /> Category and store metadata included</li>
              </ul>
            </div>
            <div className={styles.featureVisual} aria-hidden="true">
              <div className={styles.chipsDemo}>
                {['Milk', 'Eggs', 'Coffee', 'Bread', 'Bananas'].map(name => (
                  <span key={name} className={styles.demoChip}>
                    <Plus className={styles.demoChipIcon} /> {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ MOBILE / PWA ═══════════ */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Built for the aisle</p>
          <h2 className={styles.sectionHeading}>
            A grocery list should feel at home on your phone.
          </h2>
          <p className={styles.sectionSub}>
            Install Eggspedition from your browser and open it from your Home Screen
            like an app. Large controls, light and dark themes, and visible connection
            status keep the list comfortable to use while you shop.
          </p>

          <div className={styles.pwaDemo}>
            <div className={styles.pwaIcon}>
              <div className={styles.pwaIconInner}>
                <ShoppingBasket className={styles.pwaIconSvg} />
              </div>
            </div>
            <div className={styles.pwaArrow}><ChevronRight className={styles.pwaArrowIcon} /></div>
            <div className={styles.pwaScreen}>
              <div className={styles.pwaScreenInner}>
                <div className={styles.pwaStatus}>9:41</div>
                <div className={styles.pwaAppHeader}>Eggspedition</div>
                <div className={styles.pwaList}>
                  {['Bananas', 'Milk', 'Coffee', 'Eggs'].map(item => (
                    <div key={item} className={styles.pwaItem}>
                      <span className={styles.pwaCheck} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.pwaNav}>
                  {['Home', 'Add', 'Activity'].map(l => (
                    <span key={l} className={styles.pwaNavItem}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className={styles.finalCta}>
        <div className={styles.sectionInner}>
          <div className={styles.finalCtaCard}>
            <h2 className={styles.finalCtaHeading}>
              Make the grocery list the easy part.
            </h2>
            <p className={styles.finalCtaBody}>
              Start a shared household list with just your email.
            </p>
            <Link to="/login" className={styles.ctaPrimary}>
              Start your list
            </Link>
            <p className={styles.finalCtaNote}>No password required.</p>
            <p className={styles.finalCtaLogin}>
              Already use Eggspedition?{' '}
              <Link to="/login" className={styles.finalCtaLoginLink}>Log in</Link>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className={styles.footer}>
        <div className={styles.sectionInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <ShoppingBasket className={styles.footerLogo} aria-hidden="true" />
              <span className={styles.footerName}>Eggspedition</span>
            </div>
            <p className={styles.footerTagline}>A shared grocery list for your household.</p>
          </div>
          <div className={styles.footerBottom}>
            <p className={styles.footerCopy}>&copy; {new Date().getFullYear()} Eggspedition</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
