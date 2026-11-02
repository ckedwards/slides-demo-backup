import {
  type DesignSystem,
  type Page,
  type SlideMeta,
  type SlideTransition,
  Step,
  Steps,
  useIsActivePage,
  useSlidePageNumber,
} from '@open-slide/core';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';

export const design: DesignSystem = {
  palette: { bg: '#070707', text: '#ffffff', accent: '#cc0000' },
  fonts: {
    display: 'Anton, Impact, "Arial Narrow Bold", sans-serif',
    body: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
  },
  typeScale: { hero: 250, body: 38 },
  radius: 6,
};

// ---------------------------------------------------------------------------
// Extra palette (outside the DesignSystem shape)
// ---------------------------------------------------------------------------
const LED = '#ff2b2b';
const LED_WHITE = '#fff4e8';
const muted = '#8a8a8a';
const dim = '#3a3a3a';
const panel = '#0f0f0f';

// ---------------------------------------------------------------------------
// Webfonts + keyframes — injected once, keyed to this slide
// ---------------------------------------------------------------------------
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:ital,wght@0,500;0,700;1,800&display=swap';
const FONT_LINK_ID = 'osd-webfont-nc-state-goat';
const STYLE_ID = 'osd-styles-nc-state-goat';

const css = `
@keyframes ncs-slam {
  0%   { opacity: 0; transform: scale(1.9); filter: blur(14px); }
  55%  { opacity: 1; transform: scale(0.95); filter: blur(0); }
  75%  { transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ncs-rise {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ncs-wipe {
  from { opacity: 0; transform: translateX(-60px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ncs-ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes ncs-flare {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
@keyframes ncs-flicker {
  0%, 100% { opacity: 0.9; }
  47%      { opacity: 0.9; }
  48%      { opacity: 0.6; }
  49%      { opacity: 0.95; }
}
@keyframes ncs-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.15; }
}
@keyframes ncs-sweep-l {
  0%, 100% { transform: rotate(-38deg); }
  50%      { transform: rotate(-8deg); }
}
@keyframes ncs-sweep-r {
  0%, 100% { transform: rotate(38deg); }
  50%      { transform: rotate(8deg); }
}
@keyframes ncs-chant {
  0%, 44%   { opacity: 1; transform: scale(1.06); }
  50%, 94%  { opacity: 0.18; transform: scale(0.96); }
  100%      { opacity: 1; transform: scale(1.06); }
}
@keyframes ncs-sheen {
  0%, 60% { transform: translateX(-120%) skewX(-20deg); }
  100%    { transform: translateX(260%) skewX(-20deg); }
}
@keyframes ncs-glowpulse {
  0%, 100% { filter: blur(22px) brightness(1); }
  50%      { filter: blur(30px) brightness(1.5); }
}
[data-osd-step="revealed"] .ncs-row {
  animation: ncs-wipe 420ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
`;

if (typeof document !== 'undefined') {
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== FONT_HREF) link.href = FONT_HREF;

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Entrance animations play only on the page the audience is watching. */
const useEntrance = () => {
  const active = useIsActivePage();
  return (animation: string): CSSProperties => (active ? { animation } : {});
};

const SLAM = (delay = 0) => `ncs-slam 700ms cubic-bezier(0.2, 0.9, 0.3, 1) ${delay}ms both`;
const RISE = (delay = 0) => `ncs-rise 600ms cubic-bezier(0, 0, 0.2, 1) ${delay}ms both`;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Scoreboard-style count-up from 0, only on the active page. */
const CountUp = ({ to, duration = 1500, delay = 0 }: { to: number; duration?: number; delay?: number }) => {
  const active = useIsActivePage();
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, duration, delay]);
  return <>{value.toLocaleString('en-US')}</>;
};

const dotMask: CSSProperties = {
  WebkitMaskImage: 'radial-gradient(circle, #000 0 2.7px, transparent 3.3px)',
  WebkitMaskSize: '8px 8px',
  maskImage: 'radial-gradient(circle, #000 0 2.7px, transparent 3.3px)',
  maskSize: '8px 8px',
};

/** Dot-matrix jumbotron digits with an LED bloom behind them. */
const Led = ({
  children,
  size,
  color = LED,
  style,
}: {
  children: ReactNode;
  size: number;
  color?: string;
  style?: CSSProperties;
}) => (
  <span
    style={{
      position: 'relative',
      display: 'inline-block',
      fontFamily: 'var(--osd-font-display)',
      fontSize: size,
      lineHeight: 1,
      color,
      ...style,
    }}
  >
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.7,
        filter: 'blur(22px)',
        animation: 'ncs-glowpulse 2.4s ease-in-out infinite',
      }}
    >
      {children}
    </span>
    <span style={{ position: 'relative', display: 'inline-block', ...dotMask }}>{children}</span>
  </span>
);

const Eyebrow = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontFamily: 'var(--osd-font-body)',
      fontStyle: 'italic',
      fontWeight: 800,
      fontSize: 32,
      lineHeight: 1.2,
      letterSpacing: '0.18em',
      color: 'var(--osd-accent)',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      ...style,
    }}
  >
    <span style={{ width: 56, height: 6, background: 'var(--osd-accent)', transform: 'skewX(-24deg)' }} />
    {children}
  </div>
);

const headline: CSSProperties = {
  fontFamily: 'var(--osd-font-display)',
  fontWeight: 400,
  textTransform: 'uppercase',
  margin: 0,
  color: 'var(--osd-text)',
  textShadow: '0 6px 0 #000, 0 0 40px rgba(204,0,0,0.35)',
};

const bodyText: CSSProperties = {
  fontFamily: 'var(--osd-font-body)',
  fontWeight: 500,
  fontSize: 'var(--osd-size-body)',
  lineHeight: 1.4,
  color: '#d6d6d6',
  margin: 0,
};

// ---------------------------------------------------------------------------
// Arena chrome: ticker, stadium lights, LED grid, scanlines, footer
// ---------------------------------------------------------------------------
const TICKER =
  '  GO PACK  ★  WOLFPACK UNLIMITED  ★  NOT EVEN CLOSE  ★  RED & WHITE FOREVER  ★  WOLF!  PACK!  ★  THE TRIANGLE IS RED  ★';

const Ticker = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      background: 'var(--osd-accent)',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      borderBottom: '4px solid #000',
      boxShadow: '0 0 40px rgba(204,0,0,0.6)',
      zIndex: 3,
    }}
  >
    <div
      style={{
        display: 'flex',
        whiteSpace: 'pre',
        fontFamily: 'var(--osd-font-body)',
        fontStyle: 'italic',
        fontWeight: 800,
        fontSize: 36,
        letterSpacing: '0.08em',
        color: '#fff',
        animation: 'ncs-ticker 28s linear infinite',
      }}
    >
      <span>{TICKER.repeat(3)}</span>
      <span>{TICKER.repeat(3)}</span>
    </div>
  </div>
);

const Footer = () => {
  const { current, total } = useSlidePageNumber();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        padding: '0 120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `2px solid ${dim}`,
        background: 'linear-gradient(180deg, #0c0c0c, #000)',
        fontFamily: 'var(--osd-font-body)',
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: '0.2em',
        color: muted,
        zIndex: 3,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: LED,
            boxShadow: `0 0 12px ${LED}`,
            animation: 'ncs-blink 1.2s ease-in-out infinite',
          }}
        />
        <span style={{ color: '#fff' }}>LIVE</span>
        <span>· NC STATE WOLFPACK · CARTER-FINLEY</span>
      </span>
      <span>
        PLAY{' '}
        <span style={{ color: LED }}>
          {String(current).padStart(2, '0')}
        </span>{' '}
        OF {String(total).padStart(2, '0')}
      </span>
    </div>
  );
};

const Arena = ({ children, beams = false }: { children: ReactNode; beams?: boolean }) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--osd-bg)',
      color: 'var(--osd-text)',
      fontFamily: 'var(--osd-font-body)',
    }}
  >
    {/* LED panel grid */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1.2px, transparent 1.8px)',
        backgroundSize: '10px 10px',
      }}
    />
    {/* Red floor glow */}
    <div
      style={{
        position: 'absolute',
        left: -200,
        right: -200,
        bottom: -420,
        height: 800,
        background: 'radial-gradient(ellipse at center, rgba(204,0,0,0.45), transparent 65%)',
      }}
    />
    {/* Stadium light flares */}
    <div
      style={{
        position: 'absolute',
        top: -260,
        left: -220,
        width: 900,
        height: 700,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.32), rgba(255,80,80,0.08) 40%, transparent 70%)',
        animation: 'ncs-flare 3.2s ease-in-out infinite',
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: -260,
        right: -220,
        width: 900,
        height: 700,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.32), rgba(255,80,80,0.08) 40%, transparent 70%)',
        animation: 'ncs-flare 3.2s ease-in-out 1.6s infinite',
      }}
    />
    {beams && <Beams />}
    <Ticker />
    <div style={{ position: 'absolute', top: 160, bottom: 120, left: 120, right: 120, zIndex: 2 }}>
      {children}
    </div>
    <Footer />
    {/* Scanlines + vignette */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
        background:
          'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 4px), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65))',
        animation: 'ncs-flicker 5s steps(1) infinite',
      }}
    />
  </div>
);

const Beam = ({ side }: { side: 'left' | 'right' }) => (
  <div
    style={{
      position: 'absolute',
      bottom: -40,
      [side]: 160,
      width: 260,
      height: 1500,
      transformOrigin: '50% 100%',
      background: 'linear-gradient(0deg, rgba(255,255,255,0.35), rgba(255,60,60,0.12) 45%, transparent 85%)',
      clipPath: 'polygon(42% 100%, 58% 100%, 100% 0, 0 0)',
      filter: 'blur(6px)',
      animation: `${side === 'left' ? 'ncs-sweep-l' : 'ncs-sweep-r'} 4.5s ease-in-out infinite`,
    }}
  />
);

const Beams = () => (
  <>
    <Beam side="left" />
    <Beam side="right" />
  </>
);

// ---------------------------------------------------------------------------
// 1 — Cover
// ---------------------------------------------------------------------------
const Cover: Page = () => {
  const enter = useEntrance();
  return (
    <Arena>
      {/* Giant outlined #1 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -40,
          top: -40,
          fontFamily: 'var(--osd-font-display)',
          fontSize: 820,
          lineHeight: 0.9,
          color: 'transparent',
          WebkitTextStroke: '4px rgba(204,0,0,0.55)',
          transform: 'skewX(-8deg)',
          ...enter(RISE(500)),
        }}
      >
        #1
      </div>
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Eyebrow style={enter(RISE(0))}>The official, airtight case</Eyebrow>
        <div style={{ transform: 'skewX(-8deg)', transformOrigin: 'left', marginTop: 24 }}>
          <h1
            style={{
              ...headline,
              fontSize: 'var(--osd-size-hero)',
              lineHeight: 0.92,
              position: 'relative',
              display: 'inline-block',
              overflow: 'hidden',
              ...enter(SLAM(150)),
            }}
          >
            NC State
            {/* sheen */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '30%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                mixBlendMode: 'overlay',
                animation: 'ncs-sheen 3.5s ease-in-out infinite',
              }}
            />
          </h1>
          <h2
            style={{
              ...headline,
              fontSize: 150,
              lineHeight: 0.95,
              color: 'var(--osd-accent)',
              textShadow: '0 6px 0 #000, 0 0 60px rgba(255,0,0,0.6)',
              ...enter(SLAM(450)),
            }}
          >
            Greatest of all time.
          </h2>
        </div>
        <p style={{ ...bodyText, fontSize: 42, marginTop: 44, maxWidth: 1100, ...enter(RISE(900)) }}>
          Especially in the ACC. And honestly?{' '}
          <span style={{ color: '#fff', fontWeight: 700, fontStyle: 'italic' }}>It's not even close.</span>
        </p>
      </div>
    </Arena>
  );
};

// ---------------------------------------------------------------------------
// 2 — We founded the ACC
// ---------------------------------------------------------------------------
const YearChip = ({ year }: { year: string }) => (
  <div
    style={{
      padding: '8px 14px',
      border: `2px solid ${LED}`,
      borderRadius: 'var(--osd-radius)',
      fontFamily: 'var(--osd-font-body)',
      fontWeight: 800,
      fontStyle: 'italic',
      fontSize: 30,
      lineHeight: 1.2,
      color: '#fff',
      background: 'rgba(255,43,43,0.12)',
      boxShadow: `0 0 16px rgba(255,43,43,0.35)`,
    }}
  >
    {year}
  </div>
);

const Founders: Page = () => {
  const enter = useEntrance();
  return (
    <Arena>
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 60 }}>
        <div style={{ width: 900 }}>
          <Eyebrow style={enter(RISE(0))}>Exhibit A · Est. 1953</Eyebrow>
          <h2
            style={{
              ...headline,
              fontSize: 124,
              lineHeight: 0.95,
              marginTop: 24,
              transform: 'skewX(-6deg)',
              transformOrigin: 'left',
            }}
          >
            <span style={{ display: 'block', ...enter(SLAM(100)) }}>We didn't join</span>
            <span style={{ display: 'block', ...enter(SLAM(250)) }}>the ACC.</span>
            <span style={{ display: 'block', color: 'var(--osd-accent)', ...enter(SLAM(450)) }}>
              We founded it.
            </span>
          </h2>
          <p style={{ ...bodyText, marginTop: 40, maxWidth: 820, ...enter(RISE(800)) }}>
            Charter member since day one. Everybody else is just living in the house we built.
          </p>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            ...enter(SLAM(600)),
          }}
        >
          <Led size={500} style={{ lineHeight: 0.95 }}>7</Led>
          <div
            style={{
              fontFamily: 'var(--osd-font-body)',
              fontWeight: 800,
              fontStyle: 'italic',
              fontSize: 44,
              letterSpacing: '0.16em',
              marginTop: 8,
            }}
          >
            ACC CHAMPIONSHIPS
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            <YearChip year="'57" />
            <YearChip year="'63" />
            <YearChip year="'64" />
            <YearChip year="'65" />
            <YearChip year="'68" />
            <YearChip year="'73" />
            <YearChip year="'79" />
          </div>
        </div>
      </div>
    </Arena>
  );
};

// ---------------------------------------------------------------------------
// 3 — Four straight over UNC
// ---------------------------------------------------------------------------
const GameRow = ({ year, us, them, note }: { year: string; us: number; them: number; note?: string }) => (
  <div
    className="ncs-row"
    style={{
      height: 120,
      display: 'grid',
      gridTemplateColumns: '130px 1fr 1fr 110px',
      alignItems: 'center',
      gap: 20,
      padding: '0 28px',
      background: 'linear-gradient(90deg, rgba(204,0,0,0.22), rgba(255,255,255,0.03))',
      borderLeft: '8px solid var(--osd-accent)',
      borderRadius: 'var(--osd-radius)',
    }}
  >
    <div style={{ fontFamily: 'var(--osd-font-body)', fontWeight: 800, fontStyle: 'italic', fontSize: 40 }}>
      {year}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <span style={{ fontWeight: 700, fontSize: 28, letterSpacing: '0.14em', color: '#fff' }}>NCSU</span>
      <Led size={88}>{us}</Led>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <span style={{ fontWeight: 700, fontSize: 28, letterSpacing: '0.14em', color: muted }}>UNC</span>
      <Led size={88} color="#5a5a5a" style={{ opacity: 0.8 }}>
        {them}
      </Led>
      {note && (
        <span style={{ fontWeight: 700, fontSize: 24, color: muted, letterSpacing: '0.1em' }}>{note}</span>
      )}
    </div>
    <div
      style={{
        justifySelf: 'end',
        width: 76,
        height: 76,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--osd-accent)',
        fontFamily: 'var(--osd-font-display)',
        fontSize: 52,
        color: '#fff',
        transform: 'skewX(-10deg)',
        boxShadow: '0 0 24px rgba(255,0,0,0.7)',
      }}
    >
      W
    </div>
  </div>
);

const Rivalry: Page = () => {
  const enter = useEntrance();
  return (
    <Arena>
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 80 }}>
        <div style={{ width: 720 }}>
          <Eyebrow style={enter(RISE(0))}>Exhibit B · The Triangle</Eyebrow>
          <h2
            style={{
              ...headline,
              fontSize: 140,
              lineHeight: 0.95,
              marginTop: 24,
              transform: 'skewX(-6deg)',
              transformOrigin: 'left',
              ...enter(SLAM(100)),
            }}
          >
            Four
            <br />
            straight
            <br />
            <span style={{ color: 'var(--osd-accent)' }}>over UNC.</span>
          </h2>
          <p style={{ ...bodyText, marginTop: 36, ...enter(RISE(500)) }}>
            Light blue is a lovely color. For the sky.
          </p>
        </div>
        <div
          style={{
            flex: 1,
            padding: 32,
            background: panel,
            border: `2px solid ${dim}`,
            borderRadius: 'calc(var(--osd-radius) * 2)',
            boxShadow: '0 0 0 6px #000, 0 30px 80px rgba(0,0,0,0.8), 0 0 80px rgba(204,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <Steps>
            <div
              style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: '0.24em',
                color: muted,
              }}
            >
              <span>RIVALRY SCOREBOARD</span>
              <span style={{ color: LED, animation: 'ncs-blink 1.4s ease-in-out infinite' }}>● FINALS</span>
            </div>
            <Step duration={240}>
              <GameRow year="2021" us={34} them={30} />
            </Step>
            <Step duration={240}>
              <GameRow year="2022" us={30} them={27} note="2OT" />
            </Step>
            <Step duration={240}>
              <GameRow year="2023" us={39} them={20} />
            </Step>
            <Step duration={240}>
              <GameRow year="2024" us={35} them={30} />
            </Step>
          </Steps>
        </div>
      </div>
    </Arena>
  );
};

// ---------------------------------------------------------------------------
// 4 — Talent factory
// ---------------------------------------------------------------------------
const PlayerCard = ({
  name,
  stat,
  caption,
  delay,
}: {
  name: string;
  stat: ReactNode;
  caption: string;
  delay: number;
}) => {
  const enter = useEntrance();
  return (
    <div
      style={{
        padding: 28,
        background: 'linear-gradient(180deg, #161616, #0a0a0a)',
        border: `2px solid ${dim}`,
        borderTop: '10px solid var(--osd-accent)',
        borderRadius: 'var(--osd-radius)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7), inset 0 0 60px rgba(204,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        ...enter(RISE(delay)),
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontStyle: 'italic',
          fontSize: 36,
          letterSpacing: '0.08em',
          lineHeight: 1.2,
        }}
      >
        {name}
      </div>
      <div style={{ height: 150, display: 'flex', alignItems: 'center', marginTop: 20 }}>
        <Led size={96}>{stat}</Led>
      </div>
      <p style={{ ...bodyText, fontSize: 30, lineHeight: 1.35, marginTop: 16, color: '#bdbdbd' }}>{caption}</p>
    </div>
  );
};

const Talent: Page = () => {
  const enter = useEntrance();
  return (
    <Arena>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
        <Eyebrow style={enter(RISE(0))}>Exhibit C · The talent factory</Eyebrow>
        <h2
          style={{
            ...headline,
            fontSize: 120,
            lineHeight: 1,
            marginTop: 24,
            transform: 'skewX(-6deg)',
            transformOrigin: 'left',
            ...enter(SLAM(100)),
          }}
        >
          The NFL shops in <span style={{ color: 'var(--osd-accent)' }}>Raleigh.</span>
        </h2>
        <p style={{ ...bodyText, marginTop: 20, ...enter(RISE(400)) }}>
          Quarterbacks, pass rushers, receivers. We build them. You watch them on Sundays.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, marginTop: 56 }}>
          <PlayerCard
            name="PHILIP RIVERS"
            stat={<CountUp to={13484} delay={600} />}
            caption="Career passing yards. 51 straight starts."
            delay={500}
          />
          <PlayerCard
            name="MARIO WILLIAMS"
            stat="#1"
            caption="Overall pick, 2006 NFL Draft. Ahead of everyone."
            delay={650}
          />
          <PlayerCard
            name="RUSSELL WILSON"
            stat="XLVIII"
            caption="Super Bowl champion. The story started in Raleigh."
            delay={800}
          />
          <PlayerCard
            name="TORRY HOLT"
            stat="7×"
            caption="Pro Bowler. The Greatest Show on Turf's go-to guy."
            delay={950}
          />
        </div>
      </div>
    </Arena>
  );
};

// ---------------------------------------------------------------------------
// 5 — Gator Bowl
// ---------------------------------------------------------------------------
const TeamScore = ({
  team,
  score,
  winner,
}: {
  team: string;
  score: number;
  winner?: boolean;
}) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
    <div
      style={{
        fontWeight: 800,
        fontStyle: 'italic',
        fontSize: 52,
        letterSpacing: '0.12em',
        color: winner ? '#fff' : muted,
      }}
    >
      {team}
    </div>
    <Led size={260} color={winner ? LED : '#5a5a5a'} style={{ opacity: winner ? 1 : 0.8 }}>
      {winner ? <CountUp to={score} delay={500} duration={1200} /> : score}
    </Led>
  </div>
);

const GatorBowl: Page = () => {
  const enter = useEntrance();
  return (
    <Arena>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
        <Eyebrow style={enter(RISE(0))}>Exhibit D · Jan 1, 2003 · Gator Bowl</Eyebrow>
        <h2
          style={{
            ...headline,
            fontSize: 116,
            lineHeight: 1,
            marginTop: 24,
            transform: 'skewX(-6deg)',
            transformOrigin: 'left',
            ...enter(SLAM(100)),
          }}
        >
          Ask <span style={{ color: 'var(--osd-accent)' }}>Notre Dame</span> how it went.
        </h2>
        <div
          style={{
            marginTop: 56,
            height: 430,
            position: 'relative',
            background: panel,
            border: `2px solid ${dim}`,
            borderRadius: 'calc(var(--osd-radius) * 2)',
            boxShadow: '0 0 0 6px #000, 0 30px 80px rgba(0,0,0,0.8), 0 0 100px rgba(204,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            padding: '70px 60px 0',
            ...enter(RISE(300)),
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 28px',
              background: 'var(--osd-accent)',
              fontFamily: 'var(--osd-font-display)',
              fontSize: 36,
              letterSpacing: '0.3em',
              color: '#fff',
            }}
          >
            FINAL
          </div>
          <TeamScore team="NC STATE" score={28} winner />
          <div style={{ width: 4, height: 260, background: `linear-gradient(${dim}, ${LED}, ${dim})` }} />
          <TeamScore team="NOTRE DAME" score={6} />
        </div>
        <p style={{ ...bodyText, marginTop: 40, ...enter(RISE(900)) }}>
          The cherry on top of a{' '}
          <span style={{ color: '#fff', fontWeight: 700, fontStyle: 'italic' }}>school-record 11-win</span> 2002
          season.
        </p>
      </div>
    </Arena>
  );
};

// ---------------------------------------------------------------------------
// 6 — The verdict
// ---------------------------------------------------------------------------
const ChantWord = ({ word, delay }: { word: string; delay: number }) => (
  <span style={{ display: 'inline-block', animation: `ncs-chant 1.2s steps(1) ${delay}ms infinite` }}>
    <Led size={150} color={LED_WHITE}>
      {word}
    </Led>
  </span>
);

const Verdict: Page = () => {
  const enter = useEntrance();
  return (
    <Arena beams>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Eyebrow style={enter(RISE(0))}>The verdict</Eyebrow>
        <h2
          style={{
            ...headline,
            fontSize: 210,
            lineHeight: 0.9,
            marginTop: 24,
            transform: 'skewX(-8deg)',
            textShadow: '0 8px 0 #000, 0 0 80px rgba(255,0,0,0.7)',
          }}
        >
          <span style={{ display: 'block', ...enter(SLAM(150)) }}>It's not</span>
          <span style={{ display: 'block', color: 'var(--osd-accent)', ...enter(SLAM(450)) }}>even close.</span>
        </h2>
        <div style={{ display: 'flex', gap: 80, marginTop: 40, ...enter(RISE(900)) }}>
          <ChantWord word="WOLF!" delay={0} />
          <ChantWord word="PACK!" delay={600} />
        </div>
        <p style={{ ...bodyText, fontSize: 40, marginTop: 28, color: '#fff', ...enter(RISE(1200)) }}>
          Wolfpack Unlimited. Go Pack. 🐺
        </p>
      </div>
    </Arena>
  );
};

// ---------------------------------------------------------------------------
// Transition — one bloom DNA for the whole deck
// ---------------------------------------------------------------------------
export const transition: SlideTransition = {
  duration: 240,
  exit: { duration: 240, easing: 'cubic-bezier(0.4, 0, 1, 1)', keyframes: [{ opacity: 1 }, { opacity: 1 }] },
  enter: {
    duration: 240,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    keyframes: [
      { opacity: 0, transform: 'scale(0.97)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
  },
};

export const meta: SlideMeta = {
  title: 'NC State: Greatest of All Time',
  createdAt: '2026-11-02T13:04:11.546Z',
};

export const notes: (string | undefined)[] = [
  'Lights down. Let the ticker run for a beat, then: "I have prepared a presentation. Please hold your questions — there will be none."',
  'NC State was one of the seven charter members of the ACC in 1953. Seven conference titles. Point at the chips one at a time if anyone looks skeptical.',
  'Press → for each game. 2021, 2022 in double overtime in Chapel Hill, 2023, 2024. Pause after each W for crowd noise.',
  'Rivers: 13,484 career passing yards and 51 straight starts. Mario Williams went #1 overall in 2006. Russell Wilson: Super Bowl XLVIII. Torry Holt: seven Pro Bowls.',
  'Jan 1, 2003 Gator Bowl: NC State 28, Notre Dame 6. Capped an 11–3 season, still the most wins in school history.',
  'Lead the chant. Do not take questions. Go Pack.',
];

export default [Cover, Founders, Rivalry, Talent, GatorBowl, Verdict] satisfies Page[];
