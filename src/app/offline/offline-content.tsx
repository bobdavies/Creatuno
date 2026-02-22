'use client'

export function OfflineContent() {
  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        background: '#1B0F28',
        color: '#FBFCFE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1.5rem',
        textAlign: 'center',
        margin: 0,
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 1.5rem',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(254,199,20,0.2), rgba(126,93,167,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={32}
            height={32}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="#FEC714"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#FEC714',
            marginBottom: '0.5rem',
          }}
        >
          Creatuno
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          You&rsquo;re offline
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#A098AE',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
          }}
        >
          It looks like you&rsquo;ve lost your internet connection. Any changes
          you&rsquo;ve made will be synced once you&rsquo;re back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderRadius: 9999,
            border: 'none',
            background: '#FEC714',
            color: '#1B0F28',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          Try Again
        </button>
        <a
          href="/"
          style={{
            display: 'block',
            marginTop: '1rem',
            fontSize: '0.75rem',
            color: '#71717a',
            textDecoration: 'none',
          }}
        >
          Back to homepage
        </a>
      </div>
    </div>
  )
}
