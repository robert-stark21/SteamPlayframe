import { useEffect, useId, useState } from 'react';
import QRCode from 'qrcode';
import { CoffeeIcon } from '../icons.tsx';

/**
 * "Buy me a coffee": a short line, a QR code and a link.
 * Set in .env (read at build time):
 *   VITE_DONATE_URL       the donate page; the QR is drawn from it
 *   VITE_DONATE_QR_IMAGE  optional image in public/ (e.g. /donate-qr.png) shown instead,
 *                         for a bank or wallet QR that is not a web link
 * With neither set, nothing renders.
 */
const DONATE_URL = (import.meta.env.VITE_DONATE_URL as string | undefined)?.trim() || '';
const QR_IMAGE = (import.meta.env.VITE_DONATE_QR_IMAGE as string | undefined)?.trim() || '';

export const donateEnabled = Boolean(DONATE_URL || QR_IMAGE);

export function Donate({ variant }: { variant: 'sidebar' | 'footer' }) {
  const id = useId();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (QR_IMAGE || !DONATE_URL) return;
    let alive = true;
    QRCode.toString(DONATE_URL, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!donateEnabled) return null;
  const host = DONATE_URL ? DONATE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';

  return (
    <section className={`donate donate--${variant}`} aria-labelledby={`${id}-h`}>
      <div className="donate__text">
        <h2 className="donate__title" id={`${id}-h`}>
          <CoffeeIcon size={20} />
          Buy me a coffee
        </h2>
        <p className="donate__line">PLAYFRAME is free, with no ads. A coffee keeps the catalog updated.</p>
        {DONATE_URL && (
          <a className="donate__btn" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <CoffeeIcon size={18} />
            Buy me a coffee
          </a>
        )}
      </div>
      {(QR_IMAGE || svg) && (
        <figure className="donate__qr">
          {QR_IMAGE ? (
            <img src={QR_IMAGE} alt="Donate QR code" width={160} height={160} loading="lazy" />
          ) : (
            <span role="img" aria-label={`QR code for ${host}`} dangerouslySetInnerHTML={{ __html: svg! }} />
          )}
          <figcaption className="donate__cap">Scan to donate</figcaption>
        </figure>
      )}
    </section>
  );
}

/** The header's "Buy me a coffee" link (only when a donate URL is set). */
export function DonateButton() {
  if (!DONATE_URL) return null;
  return (
    <a className="coffee" href={DONATE_URL} target="_blank" rel="noopener noreferrer" aria-label="Buy me a coffee (opens in a new tab)">
      <CoffeeIcon size={18} />
      <span className="coffee__long">Buy me a coffee</span>
      <span className="coffee__short" aria-hidden="true">Coffee</span>
    </a>
  );
}
