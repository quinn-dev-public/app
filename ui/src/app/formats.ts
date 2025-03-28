export interface Format {
  id: string;
  text: string;
  qualities: Quality[];
}

export interface Quality {
  id: string;
  text: string;
}

export const Formats: Format[] = [
  {
    id: 'mp3',
    text: 'MP3 (Audio)',
    qualities: [
      { id: 'best', text: 'Best' },
      { id: '320', text: '320 kbps' },
      { id: '192', text: '192 kbps' },
      { id: '128', text: '128 kbps' },
    ],
  },
  {
    id: 'mp4',
    text: 'MP4 (Video)',
    qualities: [
      { id: 'best_ios', text: 'Best' },
      { id: '2160', text: '2160p' },
      { id: '1440', text: '1440p' },
      { id: '1080', text: '1080p' },
      { id: '720', text: '720p' },
      { id: '480', text: '480p' },
      { id: 'worst', text: 'Worst' },
    ],
  }
];
