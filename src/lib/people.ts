export interface Person {
  name: string;
  role: string;
  avatar: string;
  appName: string;
  machineId: string;
}

export const people: Person[] = [
  {
    name: "Sam",
    role: "CX Specialist",
    avatar: "/avatars/sam.jpg",
    appName: "agent-a",
    machineId: "185924c433dd78",
  },
  {
    name: "Kelly",
    role: "Social Media Creator",
    avatar: "/avatars/kelly.jpg",
    appName: "ai-vite-poc",
    machineId: "17817d62b54248",
  },
  {
    name: "Greg",
    role: "Analyst",
    avatar: "/avatars/greg.jpg",
    appName: "manifest-1234",
    machineId: "18577d5c01de28",
  },
];

export function findPerson(appName: string, machineId: string): Person | undefined {
  return people.find((p) => p.appName === appName && p.machineId === machineId);
}
