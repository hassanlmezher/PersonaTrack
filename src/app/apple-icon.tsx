import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#08090C',
          borderRadius: '110px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '280px',
            height: '280px',
            backgroundColor: 'rgba(59, 126, 248, 0.15)',
            borderRadius: '60px',
            border: '8px solid rgba(59, 126, 248, 0.3)',
          }}
        >
          <svg
            width="140"
            height="140"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B7EF8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
