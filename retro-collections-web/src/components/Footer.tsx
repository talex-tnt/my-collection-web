import { getRelativeTimeString } from '../utils';

declare const __BUILD_DATE__: string;
declare const __GIT_HASH__: string;

function Footer() {
  const buildDateObject = new Date(__BUILD_DATE__);

  const buildDate = buildDateObject.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const relativeTime = getRelativeTimeString(buildDateObject);

  return (
    <footer className="border-t border-base-300 bg-base-100 py-4 text-center text-sm text-base-content/60">
      <p>
        Build: {buildDate} ({relativeTime}) | Commit:{' '}
        <code className="font-mono">{__GIT_HASH__}</code>
      </p>
    </footer>
  );
}

export default Footer;
