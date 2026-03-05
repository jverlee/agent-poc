export interface Person {
  name: string;
  role: string;
  avatar: string;
  ip: string | null;
  enabled: boolean;
}

export const people: Person[] = [
  {
    name: "Sam",
    role: "CX Specialist",
    avatar: "/avatars/sam.jpg",
    ip: "137.184.72.180",
    enabled: true,
  },
  {
    name: "Kelly",
    role: "Social Media Creator",
    avatar: "/avatars/kelly.jpg",
    ip: null,
    enabled: false,
  },
  {
    name: "Greg",
    role: "Analyst",
    avatar: "/avatars/greg.jpg",
    ip: null,
    enabled: false,
  },
  {
    name: "Alex",
    role: "Designer",
    avatar: "/avatars/alex.jpg",
    ip: null,
    enabled: false,
  },
];

export function findPersonByIndex(index: number): Person | undefined {
  return people[index];
}
