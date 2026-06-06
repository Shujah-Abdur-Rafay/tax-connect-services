export interface User {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'professional' | 'admin';
  avatar?: string;
}

export interface Professional extends User {
  role: 'professional';
  title: string;
  location: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  services: string[];
  bio: string;
  verified: boolean;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: number;
  category: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}