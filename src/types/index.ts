export interface Zone {
  id: string;
  name: string;
  towns: string[];
  description: string;
  keyIngredients: string[];
  image: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  sustainabilityNotes: string;
  category: 'starter' | 'main' | 'dessert' | 'drink';
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'student';
  status: 'pending' | 'approved';
  createdAt: string;
}

export interface Project {
  id: string;
  teamName: string;
  zoneId: string;
  members: TeamMember[];
  milestones: Milestone[];
  menu: Dish[];
  createdAt: string;
}
