import type { Coordinate } from './map-geometry';

type MapZone = { name: string; reference: string; coordinate: Coordinate; source: string };

/** Representative transit points from the bundled OSM extract, not pickup addresses. */
export const mapZones: Record<string, MapZone> = {
  BANANI: {
    name: 'Banani', reference: 'Kakoli / Banani bus stop, near Kamal Ataturk Avenue',
    coordinate: [90.4014531, 23.794317], source: 'node/12073100375',
  },
  MOHAKHALI: {
    name: 'Mohakhali', reference: 'Mohakhali bus station, near the rail gate',
    coordinate: [90.3981453, 23.7781798], source: 'node/3499295181',
  },
  GULSHAN_1: {
    name: 'Gulshan 1', reference: 'Gulshan bus stop, by Gulshan 1 Circle',
    coordinate: [90.4162986, 23.7802946], source: 'node/1777690993',
  },
  GULSHAN_2: {
    name: 'Gulshan 2', reference: 'Gulshan 2 Circle, eastern side',
    coordinate: [90.414589, 23.794935], source: 'way/144567401',
  },
  MIRPUR_10: {
    name: 'Mirpur 10', reference: 'Mirpur 10 Circle bus stop, eastern side',
    coordinate: [90.3690055, 23.8070291], source: 'node/13264843050',
  },
  UTTARA: {
    name: 'Uttara', reference: 'Azampur bus stop on the Airport Road corridor',
    coordinate: [90.4004821, 23.8680114], source: 'node/4737732860',
  },
};
