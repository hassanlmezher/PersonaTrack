import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PersonaTrace',
    short_name: 'PersonaTrace',
    description: 'Elite OSINT intelligence platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#08090C',
    theme_color: '#08090C',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
