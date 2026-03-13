export type Block = 'Kaler' | 'Karpi' | 'Kurtha' | 'Banshi' | 'Arwal';
export type FacilityType = 'Sadar Hospital' | 'PHC' | 'HSC' | 'Private';

export interface Hospital {
  id: string;
  name: string;
  block: Block;
  type: FacilityType;
  doctors: number;
  staff: number;
}

export const hospitals: Hospital[] = [
  { id: '1', name: 'Sadar Hospital Arwal', block: 'Arwal', type: 'Sadar Hospital', doctors: 15, staff: 45 },
  { id: '2', name: 'PHC Karpi', block: 'Karpi', type: 'PHC', doctors: 3, staff: 12 },
  { id: '3', name: 'PHC Kurtha', block: 'Kurtha', type: 'PHC', doctors: 2, staff: 14 },
  { id: '4', name: 'PHC Kaler', block: 'Kaler', type: 'PHC', doctors: 2, staff: 10 },
  { id: '5', name: 'PHC Banshi', block: 'Banshi', type: 'PHC', doctors: 2, staff: 11 },
  { id: '6', name: 'PHC Arwal Rural', block: 'Arwal', type: 'PHC', doctors: 3, staff: 15 },
  { id: '7', name: 'Maa Netralaya', block: 'Arwal', type: 'Private', doctors: 2, staff: 5 },
  { id: '8', name: 'HSC Kinjar', block: 'Karpi', type: 'HSC', doctors: 0, staff: 2 },
  { id: '9', name: 'HSC Puran', block: 'Karpi', type: 'HSC', doctors: 0, staff: 2 },
  { id: '10', name: 'HSC Manikpur', block: 'Kurtha', type: 'HSC', doctors: 0, staff: 2 },
  { id: '11', name: 'HSC Lari', block: 'Kurtha', type: 'HSC', doctors: 0, staff: 2 },
  { id: '12', name: 'HSC Belkhara', block: 'Kaler', type: 'HSC', doctors: 0, staff: 2 },
  { id: '13', name: 'HSC Sonbhadra', block: 'Banshi', type: 'HSC', doctors: 0, staff: 2 },
  { id: '14', name: 'HSC Khadasin', block: 'Arwal', type: 'HSC', doctors: 0, staff: 2 },
  { id: '15', name: 'HSC Fakharpur', block: 'Arwal', type: 'HSC', doctors: 0, staff: 2 },
  { id: '16', name: 'HSC Bhadasi', block: 'Arwal', type: 'HSC', doctors: 0, staff: 2 },
  { id: '17', name: 'HSC Aiyara', block: 'Karpi', type: 'HSC', doctors: 0, staff: 2 },
  { id: '18', name: 'HSC Pariyari', block: 'Kurtha', type: 'HSC', doctors: 0, staff: 2 },
  { id: '19', name: 'HSC Mehandia', block: 'Kaler', type: 'HSC', doctors: 0, staff: 2 },
  { id: '20', name: 'HSC Karpi Rural', block: 'Karpi', type: 'HSC', doctors: 0, staff: 2 },
];

export const blocks: Block[] = ['Arwal', 'Kaler', 'Karpi', 'Kurtha', 'Banshi'];
