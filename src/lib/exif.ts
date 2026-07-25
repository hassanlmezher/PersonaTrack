import type { ExifData } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extracts EXIF metadata from an image File using the exifr library.
 * Runs entirely client-side — no server round-trip needed.
 */
export async function extractExif(file: File): Promise<ExifData | null> {
  try {
    const exifr = await import('exifr');
    const raw = await exifr.parse(file, {
      gps: true,
      xmp: true,
      iptc: true,
      icc: false,
      jfif: false,
      tiff: true,
      exif: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: false,
    });

    if (!raw) return null;

    // Merge all segments for convenience
    const merged: Record<string, any> = {};
    for (const seg of Object.values(raw)) {
      if (seg && typeof seg === 'object') Object.assign(merged, seg);
    }

    // GPS
    let gps: ExifData['gps'] | undefined;
    if (merged.latitude != null && merged.longitude != null) {
      gps = {
        latitude: Number(merged.latitude.toFixed(6)),
        longitude: Number(merged.longitude.toFixed(6)),
        altitude: merged.GPSAltitude != null ? Number(merged.GPSAltitude.toFixed(1)) : undefined,
        locationName: await reverseGeocode(merged.latitude, merged.longitude),
      };
    }

    // Device
    const device: ExifData['device'] = {};
    if (merged.Make) device.make = String(merged.Make);
    if (merged.Model) device.model = String(merged.Model);
    if (merged.Software) device.software = String(merged.Software);

    // Image
    const image: ExifData['image'] = {};
    if (merged.DateTimeOriginal) {
      image.timestamp = formatExifDate(merged.DateTimeOriginal);
    } else if (merged.DateTime) {
      image.timestamp = formatExifDate(merged.DateTime);
    }
    if (merged.ImageWidth || merged.ExifImageWidth) {
      image.width = merged.ExifImageWidth ?? merged.ImageWidth;
    }
    if (merged.ImageHeight || merged.ExifImageHeight) {
      image.height = merged.ExifImageHeight ?? merged.ImageHeight;
    }
    if (merged.Orientation) image.orientation = merged.Orientation;

    // Author
    const author: ExifData['author'] = {};
    if (merged.Artist) author.artist = String(merged.Artist);
    if (merged.Copyright) author.copyright = String(merged.Copyright);
    if (merged.Creator || merged.ByLine) author.creator = String(merged.Creator ?? merged.ByLine);

    // Camera
    const camera: ExifData['camera'] = {};
    if (merged.FNumber) camera.fNumber = Number(merged.FNumber);
    if (merged.ExposureTime != null) camera.exposureTime = formatExposure(merged.ExposureTime);
    if (merged.ISO || merged.ISOSpeedRatings) camera.iso = merged.ISO ?? merged.ISOSpeedRatings;
    if (merged.FocalLength) camera.focalLength = `${merged.FocalLength}mm`;
    if (merged.Flash != null) camera.flash = merged.Flash === 0 ? 'No Flash' : 'Flash Fired';

    return { gps, device, image, author, camera, raw: merged };
  } catch {
    return null;
  }
}

function formatExifDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  if (typeof value === 'string') {
    // EXIF format: "2024:03:15 14:33:07"
    return value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  }
  return String(value);
}

function formatExposure(val: number): string {
  if (val < 1) {
    const denom = Math.round(1 / val);
    return `1/${denom}s`;
  }
  return `${val}s`;
}

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { 'User-Agent': 'PersonaTrace/1.0' }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const addr = data.address ?? {};
    const parts = [addr.city ?? addr.town ?? addr.village, addr.country].filter(Boolean);
    return parts.join(', ') || data.display_name?.split(',').slice(0, 2).join(',');
  } catch {
    return undefined;
  }
}
